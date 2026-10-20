/**
 * An audio map: what a track does over time, measured once (`scripts/analyse-audio.mjs`) and
 * published beside it, so a camera timed to the music can find its cues by name instead of by
 * hand-measured seconds. Loudness is EBU R128 short-term (LUFS) and brightness the spectral
 * centroid (Hz), both one sample per `step` seconds; cues are found here, from those alone, so
 * a map and the programme that names its cues can be checked without the audio.
 */

export type AudioCueKind =
  | "start"
  | "rise"
  | "quiet"
  | "swell"
  | "breath"
  | "bright"
  | "surge"
  | "peak"
  | "fade"
  | "end";

export type AudioCue = {
  /** `kind`, or `kind-n` when a track has several (`breath-2`), counted in time order. */
  id: string;
  kind: AudioCueKind;
  /** Seconds into the track. */
  at: number;
};

export type AudioMap = {
  version: 1;
  /** The track's file slug. */
  track: string;
  /** Seconds the file lasts. */
  duration: number;
  /** Seconds the track plays before it loops: the duration less the player's crossfade. */
  period: number;
  /** Seconds between samples. */
  step: number;
  /** Short-term loudness, LUFS, one per step; silence reads −70. */
  loudness: number[];
  /** Spectral centroid, Hz, one per step. */
  brightness: number[];
  cues: AudioCue[];
};

/** The loudness a silent sample reads, LUFS. */
const SILENCE = -70;
/** The envelope is smoothed over this many seconds before cues are read off it. */
const SMOOTH = 9;
/** A swell or breath stands this much, LU, from the music around it; a bright passage this fraction above the median centroid. */
const SWELL_LU = 2.5;
const BREATH_LU = 4;
const BRIGHT_FRACTION = 0.15;
/** The first climb of at least RISE_LU over RISE_WINDOW seconds is the rise; the steepest within SURGE_WINDOW of the peak the surge. */
const RISE_LU = 8;
const RISE_WINDOW = 10;
const SURGE_LU = 6;
const SURGE_WINDOW = 40;
/** A fade is a final decline of at least this much, LU. */
const FADE_LU = 4;
/** Cues of one kind closer than this, seconds, are one cue; at most this many of a kind are named. */
const MIN_GAP = 15;
const MAX_NAMED = 3;
/** The running median spans this many seconds either side. */
const CONTEXT = 30;

const median = (values: readonly number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
};

/** A centred moving average over `width` samples. */
function smooth(values: readonly number[], width: number) {
  const half = Math.floor(width / 2);
  return values.map((_, i) => {
    const from = Math.max(0, i - half);
    const to = Math.min(values.length, i + half + 1);
    let sum = 0;
    for (let j = from; j < to; j++) sum += values[j]!;
    return sum / (to - from);
  });
}

/**
 * Local extrema of `values` (`sign` +1 for maxima) that stand at least `contrast` from the
 * median of the `context` samples around them, the most prominent `limit` of them, in time
 * order; extrema within `gap` samples of each other count once, and those `skip` names (the
 * peak, the quiet) are left out before the most prominent are chosen.
 */
function extrema(
  values: readonly number[],
  sign: 1 | -1,
  contrast: number,
  context: number,
  gap: number,
  limit: number,
  skip: (i: number) => boolean = () => false,
) {
  const found: { i: number; prominence: number }[] = [];
  for (let i = 1; i < values.length - 1; i++) {
    const v = values[i]! * sign;
    if (v < values[i - 1]! * sign || v <= values[i + 1]! * sign) continue;
    const around = values.slice(Math.max(0, i - context), Math.min(values.length, i + context + 1));
    const prominence = v - median(around) * sign;
    if (prominence < contrast) continue;
    const last = found[found.length - 1];
    if (last && i - last.i < gap) {
      if (prominence > last.prominence) found[found.length - 1] = { i, prominence };
      continue;
    }
    found.push({ i, prominence });
  }
  return found
    .filter((f) => !skip(f.i))
    .sort((a, b) => b.prominence - a.prominence)
    .slice(0, limit)
    .map((f) => f.i)
    .sort((a, b) => a - b);
}

/**
 * The cues in a loudness and brightness envelope (one sample per `step` seconds, over a track of
 * `period` playing seconds), read off the envelope smoothed over SMOOTH seconds: `start` and
 * `end` always; `peak` and `quiet`, the loudest and quietest moments; `rise`, the first climb of
 * RISE_LU over RISE_WINDOW seconds (the music's entrance); `surge`, the steepest climb into the
 * peak; `fade`, where the final decline begins; and the most prominent `swell-n`, `breath-n`
 * (louder and quieter than the music around them) and `bright-n` (brightest timbre), numbered
 * in time order. Silent lead-in and tail carry no cues; a level track has only its ends and peak.
 */
export function detectCues(
  loudness: readonly number[],
  brightness: readonly number[],
  step: number,
  period: number,
): AudioCue[] {
  const n = Math.min(loudness.length, Math.floor(period / step));
  const raw = loudness.slice(0, n).map((v) => (v <= SILENCE ? SILENCE : v));
  const cues: AudioCue[] = [{ id: "start", kind: "start", at: 0 }];
  const end: AudioCue = { id: "end", kind: "end", at: period };
  /* Samples that are sound: the lead-in and tail of silence carry no cues. */
  const first = raw.findIndex((v) => v > SILENCE + 10);
  let last = n - 1;
  while (last > first && raw[last]! <= SILENCE + 10) last--;
  if (first < 0 || last - first < 2) return [...cues, end];
  const width = Math.max(1, Math.round(SMOOTH / step));
  const sound = smooth(raw.slice(first, last + 1), width);
  const bright = smooth(brightness.slice(first, last + 1), width);
  const samples = (seconds: number) => Math.max(1, Math.round(seconds / step));
  const time = (i: number) => Math.round((first + i) * step * 10) / 10;
  const push = (kind: AudioCueKind, i: number) => cues.push({ id: kind, kind, at: time(i) });

  let peak = 0;
  let quiet = 0;
  for (let i = 1; i < sound.length; i++) {
    if (sound[i]! > sound[peak]!) peak = i;
    if (sound[i]! < sound[quiet]!) quiet = i;
  }
  push("peak", peak);
  if (sound[peak]! - sound[quiet]! >= BREATH_LU) push("quiet", quiet);

  /* The rise: the first climb of RISE_LU within RISE_WINDOW, cued where it begins. */
  const riseWindow = samples(RISE_WINDOW);
  for (let i = 0; i + riseWindow < sound.length; i++) {
    if (sound[i + riseWindow]! - sound[i]! < RISE_LU) continue;
    push("rise", i);
    break;
  }
  /* The surge: the steepest climb within SURGE_WINDOW before the peak. */
  let surge = -1;
  let climb = 0;
  for (let i = Math.max(0, peak - samples(SURGE_WINDOW)); i + riseWindow <= peak; i++) {
    const d = sound[Math.min(peak, i + riseWindow)]! - sound[i]!;
    if (d > climb) {
      climb = d;
      surge = i;
    }
  }
  if (surge >= 0 && climb >= SURGE_LU) push("surge", surge);

  const named = (kind: AudioCueKind, indices: number[]) =>
    indices.forEach((i, k) =>
      cues.push({ id: indices.length > 1 ? `${kind}-${k + 1}` : kind, kind, at: time(i) }),
    );
  const context = samples(CONTEXT);
  const gap = samples(MIN_GAP);
  named(
    "swell",
    extrema(sound, 1, SWELL_LU, context, gap, MAX_NAMED, (i) => Math.abs(i - peak) < gap),
  );
  named(
    "breath",
    extrema(sound, -1, BREATH_LU, context, gap, MAX_NAMED, (i) => Math.abs(i - quiet) < gap),
  );
  const brightMedian = median(bright);
  named(
    "bright",
    extrema(
      bright,
      1,
      brightMedian * BRIGHT_FRACTION,
      context,
      gap,
      2,
      (i) => bright[i]! < brightMedian * (1 + BRIGHT_FRACTION),
    ),
  );

  /* The fade: the top of the final descent, from the last moment still FADE_LU above the end. */
  const ending = sound[sound.length - 1]!;
  let fade = sound.length - 1;
  while (fade > 0 && sound[fade]! < ending + FADE_LU) fade--;
  if (fade > 0 && fade < sound.length - 1) {
    while (fade > 0 && sound[fade - 1]! > sound[fade]! + 0.05) fade--;
    push("fade", fade);
  }

  cues.push(end);
  const order = (cue: AudioCue) => (cue.kind === "start" ? -1 : cue.kind === "end" ? 1 : 0);
  return cues.sort((a, b) => a.at - b.at || order(a) - order(b) || a.id.localeCompare(b.id));
}

/** A map from measured envelopes: the cues found, the period after the player's crossfade. */
export function buildAudioMap(input: {
  track: string;
  duration: number;
  crossfade: number;
  step: number;
  loudness: number[];
  brightness: number[];
}): AudioMap {
  const period = Math.round(Math.max(1, input.duration - input.crossfade) * 10) / 10;
  const round = (v: number) => Math.round(v * 10) / 10;
  const loudness = input.loudness.map(round);
  const brightness = input.brightness.map(round);
  return {
    version: 1,
    track: input.track,
    duration: round(input.duration),
    period,
    step: input.step,
    loudness,
    brightness,
    cues: detectCues(loudness, brightness, input.step, period),
  };
}

const KINDS: readonly AudioCueKind[] = [
  "start",
  "rise",
  "quiet",
  "swell",
  "breath",
  "bright",
  "surge",
  "peak",
  "fade",
  "end",
];
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const isNumbers = (v: unknown): v is number[] =>
  Array.isArray(v) && v.every((x) => typeof x === "number" && Number.isFinite(x));
const isKind = (v: unknown): v is AudioCueKind =>
  typeof v === "string" && (KINDS as readonly string[]).includes(v);

/**
 * The map a published JSON holds, or null when it is not one this version reads. A cue of a
 * kind this version does not know is left out, so a newer map still serves an older page.
 */
export function parseAudioMap(json: unknown): AudioMap | null {
  if (!isRecord(json)) return null;
  const m = json;
  if (m.version !== 1 || typeof m.track !== "string") return null;
  if (typeof m.duration !== "number" || typeof m.period !== "number" || typeof m.step !== "number")
    return null;
  if (!(m.period > 0) || !(m.step > 0)) return null;
  if (!isNumbers(m.loudness) || !isNumbers(m.brightness) || !Array.isArray(m.cues)) return null;
  const cues: AudioCue[] = [];
  for (const cue of m.cues as unknown[]) {
    if (!isRecord(cue)) return null;
    if (typeof cue.id !== "string" || typeof cue.kind !== "string" || typeof cue.at !== "number")
      return null;
    if (isKind(cue.kind)) cues.push({ id: cue.id, kind: cue.kind, at: cue.at });
  }
  return {
    version: 1,
    track: m.track,
    duration: m.duration,
    period: m.period,
    step: m.step,
    loudness: m.loudness,
    brightness: m.brightness,
    cues,
  };
}

/** Seconds into the track of the cue `id`, or undefined when the map has none. */
export function cueTime(map: AudioMap, id: string) {
  return map.cues.find((cue) => cue.id === id)?.at;
}

/**
 * Fetches a published map; null when it is missing, malformed or the network fails, so a camera
 * falls back to the timing it was written with. `fetcher` stands in for `fetch` in tests.
 */
export async function loadAudioMap(
  url: string,
  fetcher: (url: string) => Promise<{ ok: boolean; json(): Promise<unknown> }> = (u) => fetch(u),
): Promise<AudioMap | null> {
  try {
    const res = await fetcher(url);
    if (!res.ok) return null;
    return parseAudioMap(await res.json());
  } catch {
    return null;
  }
}

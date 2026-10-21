import { mainSequencePhotosphere, SEQUENCE_RANGE, starPhotosphere } from "./atmospheres";
import { ELEMENT_IDS, type ElementId, type Line } from "./atoms";
import {
  reportLine,
  synthesize,
  synthesizeWithout,
  type Observation,
  type StarObservation,
} from "./spectrum";
import { SEQUENCE_TEMPERATURES, spectralClass, STARS, type StarId } from "./stars";
import type { ViewId } from "./view-ids";

/**
 * What each view looks at, as plain settings the store keeps and the spectrum is computed from.
 */

/** The visible range the spectrograph covers, nm: every window lies inside it. */
export const FULL_RANGE = [380, 770] as const;
/** Resolving powers λ / Δλ the spectrograph offers, and the one a visit starts at. */
export const RESOLUTION_RANGE = [300, 100_000] as const;
export const DEFAULT_RESOLUTION = 20_000;
/** Microturbulence of the main-sequence models, km/s: the ATLAS9 grid's own. */
const SEQUENCE_MICROTURBULENCE = 2;

/** The lab bench: a lamp, a gas and a spectrograph. */
export type Bench = {
  /** The lamp's temperature, K; 0 when it is off. */
  lamp: number;
  /** The gas's temperature, K. */
  gas: number;
  /** log₁₀ of the atoms of each chosen element in a column through the gas, m⁻². */
  column: number;
  /** The elements in the gas. */
  elements: readonly ElementId[];
};

export const BENCH_DEFAULT: Bench = { lamp: 3000, gas: 2000, column: 18, elements: ["Na"] };
/** The lamp (a filament up to an arc), the gas (a flame up to an arc) and the column. */
export const BENCH_RANGE = {
  lamp: [1500, 20_000],
  gas: [1500, 12_000],
  column: [12, 26],
} as const;

/**
 * Teaching choices for the bench gas: an electron pressure like a stellar photosphere's
 * (10 Pa), so a gas on the bench ionizes as a star's does at the same temperature; a tenth of
 * an atmosphere of gas for collisions; no turbulence.
 */
const BENCH_GAS = { electronPressure: 10, gasPressure: 1e4, microturbulence: 0 };

/** Which star the Stars view shows: a named one, or any main-sequence star. */
export type StarChoice = StarId | "sequence";

/**
 * Puzzles: a spectrum whose source and velocity are hidden. Each case is drawn afresh: a flame
 * or a gas in front of a lamp on the bench, a main-sequence star of class B to K, or a K giant,
 * at its own temperature, with its own elements or radial velocity.
 */
export type Mystery =
  | { kind: "flame"; temperature: number; elements: readonly ElementId[] }
  | { kind: "cell"; lamp: number; temperature: number; elements: readonly ElementId[] }
  | { kind: "dwarf"; teff: number; velocity: number }
  | { kind: "giant"; star: "arcturus" | "aldebaran"; velocity: number };

export { spectralClass };

/** What a case can be, and the span each is drawn from. */
const DRAWS = {
  flame: { temperature: [2000, 2500], elements: ["Li", "Na", "K", "Ca"], count: [2, 3] },
  cell: {
    lamp: [4500, 7500],
    temperature: [1600, 2400],
    elements: ["Li", "Na", "K", "Ca"],
    count: [1, 2],
  },
  B: [12_000, 22_000],
  A: [7750, 9750],
  F: [6250, 7100],
  G: [5400, 5900],
  K: [4300, 5100],
  giant: ["arcturus", "aldebaran"],
} as const;

type DrawKind = keyof typeof DRAWS;
const DRAW_KINDS: readonly DrawKind[] = ["flame", "cell", "B", "A", "F", "G", "K", "giant"];
const BENCH_KINDS: readonly DrawKind[] = ["flame", "cell"];

/** Cases in one deck. */
const DECK_SIZE = 5;

type Random = () => number;
const between = (random: Random, [lo, hi]: readonly [number, number], step: number) =>
  Math.round((lo + random() * (hi - lo)) / step) * step;
const pick = <T>(random: Random, items: readonly T[]) =>
  items[Math.min(items.length - 1, Math.floor(random() * items.length))]!;

function shuffled<T>(random: Random, items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** A star's radial velocity: 8 to 120 km/s either way, so there is always a shift to find. */
const drawVelocity = (random: Random) => (random() < 0.5 ? -1 : 1) * between(random, [8, 120], 1);

function drawCase(kind: DrawKind, random: Random): Mystery {
  switch (kind) {
    case "flame":
    case "cell": {
      const draw = DRAWS[kind];
      const count = between(random, draw.count, 1);
      const elements = shuffled(random, draw.elements).slice(0, count);
      const temperature = between(random, draw.temperature, 50);
      return kind === "flame"
        ? { kind, temperature, elements }
        : { kind, lamp: between(random, DRAWS.cell.lamp, 100), temperature, elements };
    }
    case "giant":
      return { kind, star: pick(random, DRAWS.giant), velocity: drawVelocity(random) };
    default:
      return {
        kind: "dwarf",
        teff: between(random, DRAWS[kind], 50),
        velocity: drawVelocity(random),
      };
  }
}

/**
 * A deck of cases in random order, each a different kind, at least one of them on the bench.
 * `random` is `Math.random` unless a test needs the same deck twice.
 */
export function drawDeck(random: Random = Math.random, size = DECK_SIZE): Mystery[] {
  const kinds = shuffled(random, DRAW_KINDS).slice(0, size);
  if (!kinds.some((k) => BENCH_KINDS.includes(k))) kinds[size - 1] = pick(random, BENCH_KINDS);
  return shuffled(random, kinds).map((kind) => drawCase(kind, random));
}

/** A gas's columns: each element at 10^`log` atoms per m² of column. */
const columnsOf = (elements: readonly ElementId[], log: number) =>
  Object.fromEntries(elements.map((id) => [id, 10 ** log]));

const star = (observation: Omit<StarObservation, "kind">): StarObservation => ({
  kind: "star",
  ...observation,
});

/** A named star in its own model, with its own microturbulence. */
const namedStar = (id: StarId, velocity: number, airmass: number, resolution: number) =>
  star({
    photosphere: starPhotosphere(id),
    microturbulence: STARS[id].microturbulence,
    velocity,
    airmass,
    resolution,
  });

/** A main-sequence star at an effective temperature, from the model grid. */
const sequenceStar = (teff: number, velocity: number, airmass: number, resolution: number) =>
  star({
    photosphere: mainSequencePhotosphere(teff),
    microturbulence: SEQUENCE_MICROTURBULENCE,
    velocity,
    airmass,
    resolution,
  });

function mysteryObservation(m: Mystery, resolution: number, airmass: number): Observation {
  switch (m.kind) {
    /* Bunsen's flame test: metals glowing in a flame against the dark. */
    case "flame":
      return {
        kind: "slab",
        gas: { ...BENCH_GAS, temperature: m.temperature, columns: columnsOf(m.elements, 16) },
        background: null,
        velocity: 0,
        airmass: 0,
        resolution,
      };
    /* Kirchhoff's experiment: a cool gas takes its lines out of a hotter lamp's light. */
    case "cell":
      return {
        kind: "slab",
        gas: { ...BENCH_GAS, temperature: m.temperature, columns: columnsOf(m.elements, 18) },
        background: m.lamp,
        velocity: 0,
        airmass: 0,
        resolution,
      };
    case "dwarf":
      return sequenceStar(m.teff, m.velocity, airmass, resolution);
    case "giant":
      return namedStar(m.star, m.velocity, airmass, resolution);
  }
}

/** The case's hidden velocity, km/s: a bench source is at rest. */
export const mysteryVelocity = (m: Mystery) =>
  m.kind === "dwarf" || m.kind === "giant" ? m.velocity : 0;

/** The case's temperature, K: the gas's, or the star's effective temperature. */
export const mysteryTemperature = (m: Mystery) =>
  m.kind === "dwarf" ? m.teff : m.kind === "giant" ? STARS[m.star].teff.kelvin : m.temperature;

export type Settings = {
  view: ViewId;
  star: StarChoice;
  /** The main-sequence star's effective temperature, K. */
  sequenceTemperature: number;
  /**
   * km/s. The Sun and the stars: the source's own velocity. A mystery: the shift the visitor
   * gives the laboratory markers while matching them to the lines.
   */
  velocity: number;
  /** Earth's air in the beam (the Sun, the stars and the mysteries; never the bench). */
  air: boolean;
  resolution: number;
  bench: Bench;
  mystery: Mystery;
};

export const SEQUENCE_DEFAULT = 9500;
export { SEQUENCE_RANGE };

/** The source's own velocity for a view's default: the star's measured one, else at rest. */
export function defaultVelocity(view: ViewId, choice: StarChoice) {
  return view === "stars" && choice !== "sequence" ? STARS[choice].velocity : 0;
}

/** The observation a view shows. */
export function observationFor(s: Settings): Observation {
  const airmass = s.air ? 1 : 0;
  switch (s.view) {
    case "kirchhoff":
      return {
        kind: "slab",
        gas: {
          ...BENCH_GAS,
          temperature: s.bench.gas,
          columns: columnsOf(s.bench.elements, s.bench.column),
        },
        background: s.bench.lamp > 0 ? s.bench.lamp : null,
        velocity: 0,
        airmass: 0,
        resolution: s.resolution,
      };
    case "sun":
      return namedStar("sun", s.velocity, airmass, s.resolution);
    case "stars":
      return s.star === "sequence"
        ? sequenceStar(s.sequenceTemperature, s.velocity, airmass, s.resolution)
        : namedStar(s.star, s.velocity, airmass, s.resolution);
    case "mystery":
      return mysteryObservation(s.mystery, s.resolution, airmass);
  }
}

/** The star in view's effective temperature, K; null on the bench. */
export function temperatureInView(
  s: Pick<Settings, "view" | "star" | "sequenceTemperature">,
  obs: Observation,
) {
  if (obs.kind !== "star") return null;
  if (s.view === "sun") return STARS.sun.teff.kelvin;
  if (s.view === "stars")
    return s.star === "sequence" ? s.sequenceTemperature : STARS[s.star].teff.kelvin;
  return obs.photosphere.teff;
}

/**
 * The sequence chart is drawn at the finest resolving power, so a line's run down the main
 * sequence does not change with the visitor's spectrograph.
 */
const SEQUENCE_RESOLUTION = RESOLUTION_RANGE[1];

/** This line's equivalent width down the main sequence, nm, at `SEQUENCE_TEMPERATURES`. */
export function sequenceWidths(line: Line): [number, number][] {
  return SEQUENCE_TEMPERATURES.map((teff) => [
    teff,
    reportLine(line, sequenceStar(teff, 0, 0, SEQUENCE_RESOLUTION))?.equivalentWidth ?? 0,
  ]);
}

/** How far the laboratory markers are shifted: only in a mystery, where finding it is the task. */
export const markerVelocity = (s: Pick<Settings, "view" | "velocity">) =>
  s.view === "mystery" ? s.velocity : 0;

/**
 * How much each element shapes a mystery's spectrum, as the visitor sees it (their resolving
 * power, with or without Earth's air): the largest change, against the continuum (or the
 * brightest line, for a glowing gas), that removing the element makes across `FULL_RANGE`.
 */
function mysteryChanges(m: Mystery, resolution: number, airmass: number) {
  const obs = mysteryObservation(m, resolution, airmass);
  const samples = 3000;
  const base = synthesize(obs, ...FULL_RANGE, samples);
  const elements = ELEMENT_IDS.filter((e) => obs.kind === "star" || obs.gas.columns[e]);
  const changes = new Map<ElementId, number>();
  for (const [element, other] of synthesizeWithout(obs, ...FULL_RANGE, samples, elements)) {
    let change = 0;
    for (let i = 0; i < samples; i++) {
      const scale = base.continuum[i]! > 0 ? base.continuum[i]! : base.peak;
      change = Math.max(change, Math.abs(base.flux[i]! - other.flux[i]!) / scale);
    }
    changes.set(element, change);
  }
  return changes;
}

/**
 * An element is clearly shown when it changes the spectrum by a tenth of the continuum, and
 * faintly from 3 %: a faint one counts when found but is not required.
 */
const SHOWN = { clear: 0.1, faint: 0.03 } as const;

export type MysteryAnswer = { clear: ReadonlySet<ElementId>; faint: ReadonlySet<ElementId> };

/** Answers by case and by the settings they were seen under; they go with their deck. */
const answers = new WeakMap<Mystery, Map<string, MysteryAnswer>>();

/** The elements a mystery shows as the visitor sees it; computed once per case and settings. */
export function mysteryAnswer(m: Mystery, resolution: number, airmass: number): MysteryAnswer {
  let seen = answers.get(m);
  if (!seen) answers.set(m, (seen = new Map()));
  const key = `${resolution}|${airmass}`;
  const known = seen.get(key);
  if (known) return known;
  const clear = new Set<ElementId>();
  const faint = new Set<ElementId>();
  for (const [element, change] of mysteryChanges(m, resolution, airmass))
    if (change > SHOWN.clear) clear.add(element);
    else if (change > SHOWN.faint) faint.add(element);
  const answer = { clear, faint };
  seen.set(key, answer);
  return answer;
}

/**
 * How one element chip fares. A star has every element in its gas (the Sun's mix); what
 * counts is whether its lines show in this spectrum, so an element marked without visible
 * lines is "unseen" (not detected here), not absent.
 */
export type Verdict = "found" | "missed" | "unseen" | null;

/** How one element chip fares against the answer. */
export function verdict(answer: MysteryAnswer, element: ElementId, marked: boolean): Verdict {
  if (answer.clear.has(element)) return marked ? "found" : "missed";
  if (answer.faint.has(element)) return marked ? "found" : null;
  return marked ? "unseen" : null;
}

/** How close a matched velocity must be, km/s. */
const VELOCITY_MATCH = 10;

export type Outcome = "solved" | "close" | "missed";

/** A checked case: what the visitor answered and how it fared. */
export type MysteryResult = {
  answer: MysteryAnswer;
  marked: readonly ElementId[];
  velocity: number;
  /** Clearly shown elements found, of `total`. */
  found: number;
  total: number;
  /** Elements marked whose lines this spectrum does not show. */
  unseen: number;
  velocityMatched: boolean;
  outcome: Outcome;
};

/**
 * Scores an answer: solved with every clear element found, none unseen and the velocity
 * matched; close with either half right (or most elements and none unseen); else missed.
 */
export function grade(
  m: Mystery,
  answer: MysteryAnswer,
  marked: readonly ElementId[],
  velocity: number,
): MysteryResult {
  const found = [...answer.clear].filter((e) => marked.includes(e)).length;
  const total = answer.clear.size;
  const unseen = marked.filter((e) => verdict(answer, e, true) === "unseen").length;
  const velocityMatched = Math.abs(velocity - mysteryVelocity(m)) <= VELOCITY_MATCH;
  const elements = found === total && unseen === 0;
  const most = unseen === 0 && found * 2 >= total && found > 0;
  const outcome: Outcome =
    elements && velocityMatched
      ? "solved"
      : elements || velocityMatched || most
        ? "close"
        : "missed";
  return { answer, marked, velocity, found, total, unseen, velocityMatched, outcome };
}

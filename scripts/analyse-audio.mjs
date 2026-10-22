/**
 * Measures the ambient tracks and writes each one's audio map: short-term loudness (EBU R128,
 * LUFS) and spectral centroid (Hz) per second, the period the track plays before the player
 * loops it, and the cues a camera timed to the music names (`@horizon/toolkit/audio`,
 * `detectCues`). Needs ffmpeg on the PATH. Each map is written twice: to `cdn/audio/` to
 * upload beside its track (the page reads only the published copy), and to
 * `bench/fixtures/audio-maps/` for the bench and the tests.
 * Run by hand after a track is added or re-cut:
 *
 *   node --import tsx scripts/analyse-audio.mjs [slug ...]
 *
 * then upload the maps (an R2 token scoped to `horizon-cdn`, see README):
 *
 *   aws s3 cp cdn/audio/ s3://horizon-cdn/audio/ --recursive --exclude "*" --include "*.map.json" \
 *     --content-type application/json --cache-control "public, max-age=3600" --profile horizon-cdn
 */
import { execFile } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

import { buildAudioMap } from "@horizon/toolkit/audio";

import { ambientMusic } from "../src/components/shell/ambient-music.ts";
import { fetchCached } from "./lib/net.mjs";

const run = promisify(execFile);
const CDN_DIR = new URL("../cdn/audio/", import.meta.url).pathname;
const DATA_DIR = new URL("../bench/fixtures/audio-maps/", import.meta.url).pathname;
/** Seconds per sample. */
const STEP = 1;

function slugOf(track) {
  const src = track.sources.find((s) => s.src.endsWith(".m4a")) ?? track.sources[0];
  return { slug: path.basename(new URL(src.src).pathname, path.extname(src.src)), url: src.src };
}

/** Short-term loudness per STEP seconds, from ffmpeg's ebur128 meter (100 ms samples averaged). */
async function loudness(file) {
  const { stderr } = await run(
    "ffmpeg",
    ["-nostats", "-i", file, "-af", "ebur128=peak=none", "-f", "null", "-"],
    { maxBuffer: 64 << 20 },
  );
  const samples = [];
  for (const line of stderr.split("\n")) {
    const m = /t:\s*([\d.]+)\s+TARGET.*?\bS:\s*(-?[\d.]+|-inf)/.exec(line);
    if (m) samples.push([Number(m[1]), m[2] === "-inf" ? -70 : Math.max(-70, Number(m[2]))]);
  }
  return bin(samples, () => -70);
}

/** Spectral centroid per STEP seconds, from ffmpeg's aspectralstats on one-second mono frames. */
async function brightness(file) {
  /* ametadata's `file=-` prints the frames to stdout, apart from ffmpeg's own log on stderr. */
  const { stdout } = await run(
    "ffmpeg",
    [
      "-nostats",
      "-i",
      file,
      "-af",
      "aformat=channel_layouts=mono,asetnsamples=48000,aspectralstats=measure=centroid,ametadata=mode=print:file=-",
      "-f",
      "null",
      "-",
    ],
    { maxBuffer: 64 << 20 },
  );
  const samples = [];
  let at = null;
  for (const line of stdout.split("\n")) {
    const frame = /pts_time:([\d.]+)/.exec(line);
    if (frame) at = Number(frame[1]);
    const value = /centroid=([\d.]+)/.exec(line);
    if (value && at !== null) samples.push([at, Number(value[1])]);
  }
  /* A bin without a reading keeps the last centroid: silence has no brightness of its own. */
  return bin(samples, (previous) => previous ?? 0);
}

/** Means of (time, value) samples per STEP-second bin, in order; `empty(previous)` fills a bin without samples. */
function bin(samples, empty) {
  const sums = [];
  for (const [t, v] of samples) {
    const i = Math.floor(t / STEP);
    sums[i] ??= [0, 0];
    sums[i][0] += v;
    sums[i][1] += 1;
  }
  const bins = [];
  for (let i = 0; i < sums.length; i++) {
    const s = sums[i];
    bins.push(s ? s[0] / s[1] : empty(bins[i - 1]));
  }
  return bins;
}

async function duration(file) {
  const { stdout } = await run("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=nw=1:nk=1",
    file,
  ]);
  return Number(stdout.trim());
}

const wanted = new Set(process.argv.slice(2));
mkdirSync(CDN_DIR, { recursive: true });
mkdirSync(DATA_DIR, { recursive: true });
for (const track of ambientMusic.tracks) {
  const { slug, url } = slugOf(track);
  if (wanted.size && !wanted.has(slug)) continue;
  const file = await fetchCached(url, CDN_DIR);
  const [seconds, loud, bright] = await Promise.all([
    duration(file),
    loudness(file),
    brightness(file),
  ]);
  const map = buildAudioMap({
    track: slug,
    duration: seconds,
    crossfade: ambientMusic.crossfade,
    step: STEP,
    loudness: loud,
    brightness: bright,
  });
  const json = `${JSON.stringify(map)}\n`;
  writeFileSync(path.join(CDN_DIR, `${slug}.map.json`), json);
  writeFileSync(path.join(DATA_DIR, `${slug}.json`), json);
  console.log(
    `${slug}: ${map.duration}s, period ${map.period}s, cues ${map.cues
      .map((c) => `${c.id}@${c.at}`)
      .join(" ")}`,
  );
}

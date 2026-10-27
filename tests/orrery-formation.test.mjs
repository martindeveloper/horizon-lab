import assert from "node:assert/strict";
import test from "node:test";

import { parseAudioMap } from "@horizon/toolkit/audio";

import interstellarDriftMap from "../bench/fixtures/audio-maps/interstellar-drift.json" with { type: "json" };
import { DRIFT } from "../src/features/orrery/lib/drift.ts";
import { TIMELINE } from "../src/features/orrery/lib/model/catalogue/timeline.ts";
import {
  advancePlay,
  epochOf,
  noteOf,
  sliderToYearsAgo,
} from "../src/features/orrery/lib/model/timeline.ts";
import { timedDrift } from "../src/lib/drift.ts";
import { freeFallTime } from "../src/space/solar-system/model/equations.ts";
import {
  COLLAPSE_BEGINS,
  coreRadius,
  FORMATION_BEGINS,
  FREE_FALL,
  freeFallRadius,
  PROTOSTAR_LIT,
  protostarPhase,
  sunExists,
} from "../src/space/solar-system/model/formation.ts";
import {
  CORE_DENSITY_CM3,
  PROTOSTAR_BEFORE_SOLIDS,
  SUN_BIRTH,
} from "../src/space/solar-system/model/parameters.ts";
import { close } from "./toolkit-helpers.mjs";

test("a core at the catalogued density falls in in about a hundred thousand years", () => {
  assert.ok(FREE_FALL > 9e4 && FREE_FALL < 1.1e5, `${FREE_FALL}`);
  /* Four times denser falls in half the time: t_ff ∝ 1/√ρ. */
  close(freeFallTime.compute({ n: 4 * CORE_DENSITY_CM3 }), FREE_FALL / 2, 1e-6, "scaling");
  assert.equal(TIMELINE.formation.freeFall.value, FREE_FALL);
  assert.equal(TIMELINE.formation.coreDensity.value, CORE_DENSITY_CM3);
});

test("the fall is slow at first and all at once at the end", () => {
  assert.equal(freeFallRadius(0), 1);
  assert.equal(freeFallRadius(1), 0);
  assert.ok(freeFallRadius(0.5) > 0.8, "half the time in, most of the radius left");
  assert.ok(freeFallRadius(0.9) < 0.4, "the last tenth takes the rest");
  let last = 1;
  for (let k = 1; k <= 100; k += 1) {
    const r = freeFallRadius(k / 100);
    assert.ok(r < last, `shrinks at ${k}`);
    last = r;
  }
  assert.equal(coreRadius(FORMATION_BEGINS), 1);
  assert.equal(coreRadius(COLLAPSE_BEGINS), 1);
  assert.equal(coreRadius(PROTOSTAR_LIT), 0);
  assert.equal(coreRadius(SUN_BIRTH), 0);
});

test("the protostar lights one Class 0 phase before the first solids and is the Sun from then on", () => {
  assert.equal(PROTOSTAR_LIT, SUN_BIRTH + PROTOSTAR_BEFORE_SOLIDS);
  assert.equal(protostarPhase(PROTOSTAR_LIT), 0);
  close(protostarPhase(SUN_BIRTH + PROTOSTAR_BEFORE_SOLIDS / 2), 0.5, 1e-9, "halfway");
  assert.equal(protostarPhase(SUN_BIRTH), 1);
  assert.equal(protostarPhase(0), 1);
  assert.ok(sunExists(PROTOSTAR_LIT) && sunExists(0));
  assert.ok(!sunExists(PROTOSTAR_LIT + 1) && !sunExists(FORMATION_BEGINS));
});

test("the timeline gives the formation a segment, its notes and a pace of seconds", () => {
  const onSlider = new Set(
    Array.from({ length: 1001 }, (_, k) => noteOf(sliderToYearsAgo(k / 1000))),
  );
  for (const note of ["core", "collapse", "protostar"])
    assert.ok(onSlider.has(note), `${note} is reachable on the slider`);
  assert.equal(noteOf(FORMATION_BEGINS + 1), "ingredients");
  assert.equal(noteOf(COLLAPSE_BEGINS + 1), "core");
  assert.equal(noteOf(COLLAPSE_BEGINS - 1), "collapse");
  assert.equal(noteOf(SUN_BIRTH + 1), "protostar");
  assert.equal(epochOf(FORMATION_BEGINS), "birth");
  assert.equal(epochOf(FORMATION_BEGINS + 1), "sketch");
  /* Playback never skips the formation: a long frame stops where it begins, and the fall then
     takes seconds of frames, not one. */
  assert.equal(advancePlay(FORMATION_BEGINS + 1e7, 1), FORMATION_BEGINS);
  let yearsAgo = COLLAPSE_BEGINS;
  let seconds = 0;
  while (yearsAgo > PROTOSTAR_LIT) {
    yearsAgo = advancePlay(yearsAgo, 1 / 60);
    seconds += 1 / 60;
  }
  assert.ok(seconds > 3 && seconds < 5, `the fall plays in ${seconds} s`);
  assert.equal(advancePlay(SUN_BIRTH + 10, 1), SUN_BIRTH);
});

test("the drift's fall into the formation reaches today before its next visit", () => {
  const timed = timedDrift(DRIFT, parseAudioMap(interstellarDriftMap));
  const { shots, starts, loop } = timed;
  const fall = shots.findIndex((shot) => "timeline" in shot && shot.timeline);
  assert.ok(fall >= 0, "one shot sets the timeline");
  const next = shots.findIndex((shot, i) => i > fall && "closeUp" in shot);
  const visit = next >= 0 ? next : shots.findIndex((shot) => "closeUp" in shot);
  const until = (next >= 0 ? 0 : loop) + starts[visit] - starts[fall];
  let yearsAgo = shots[fall].timeline.yearsAgo;
  let seconds = 0;
  while (yearsAgo > 0) {
    yearsAgo = advancePlay(yearsAgo, 1 / 60);
    seconds += 1 / 60;
  }
  assert.ok(seconds < until, `today in ${seconds} s, the next visit after ${until} s`);
});

test("the natal cloud is whole through the fall, gone at the first solids, and the sky's dimming never jumps", async () => {
  const { natalCloud, skyEpoch } = await import("../src/features/orrery/lib/graphics/sky.ts");
  assert.equal(natalCloud(FORMATION_BEGINS + 1e8), 0, "no cloud in the interstellar era");
  assert.equal(natalCloud(FORMATION_BEGINS), 1);
  assert.equal(natalCloud(COLLAPSE_BEGINS), 1);
  assert.equal(natalCloud(PROTOSTAR_LIT), 1, "whole as the protostar lights");
  assert.equal(natalCloud(SUN_BIRTH), 0, "thinned away by the first solids");
  /* Extinction is continuous across the protostar's lighting and the first solids. */
  for (const moment of [PROTOSTAR_LIT, SUN_BIRTH]) {
    const before = skyEpoch(moment + 1).dim;
    const after = skyEpoch(moment - 1).dim;
    close(before, after, 1e-3, `sky dim at ${moment}`);
  }
  assert.ok(skyEpoch(COLLAPSE_BEGINS).dim < 0.4, "dark inside the cloud");
  assert.ok(skyEpoch(SUN_BIRTH - 1e7).dim > 0.99, "clear once the disk era is well under way");
});

test("playback's dilation reads 0 at its fastest pace and 1 at its slowest, rising as the pace drops", async () => {
  const { playDilation, playRate } = await import("../src/features/orrery/lib/model/timeline.ts");
  assert.equal(playDilation(1e9), 0, "the ages since the clearing play fastest");
  close(playDilation(SUN_BIRTH - 1), 1, 1e-6, "the first solids play slowest");
  const formation = playDilation(COLLAPSE_BEGINS);
  assert.ok(formation > 0.6 && formation < 0.9, `the fall is well slowed: ${formation}`);
  const moments = [
    1e9,
    FORMATION_BEGINS + 1,
    4.47e9,
    4.52e9,
    COLLAPSE_BEGINS,
    SUN_BIRTH - 1e6,
    SUN_BIRTH - 1,
  ];
  for (const a of moments)
    for (const b of moments)
      if (playRate(a) > playRate(b))
        assert.ok(playDilation(a) < playDilation(b), `slower pace, more dilation: ${a} vs ${b}`);
});

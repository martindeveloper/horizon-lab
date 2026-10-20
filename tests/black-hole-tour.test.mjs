import assert from "node:assert/strict";
import test from "node:test";

import {
  BENCH_SCENES,
  benchMotion,
  benchPose,
} from "../src/features/black-hole/lib/bench-scenes.ts";
import { holeById } from "../src/features/black-hole/lib/holes/index.ts";
import { holdPose, tourAt, tourEnd, tourPose } from "../src/features/black-hole/lib/tour-flight.ts";

const close = (actual, expected, tolerance = 1e-6) =>
  assert.ok(Math.abs(actual - expected) < tolerance, `${actual} != ${expected}`);
const samePose = (a, b, tolerance) => {
  for (const key of ["azimuth", "inclination", "distance", "roll"])
    close(a[key], b[key], tolerance);
};

test("the engine's frame-by-frame flights land where the bench samples the tour", () => {
  const scene = BENCH_SCENES.find((s) => s.motion?.kind === "tour");
  const beats = holeById(scene.presetId).tour;
  const home = benchPose(scene);
  const total = beats.reduce((sum, beat) => sum + beat.duration, 0);
  // The engine: each beat flies from the camera's pose at its start, t advancing per frame.
  const dt = 1 / 120;
  let camera = home;
  let start = 0;
  for (const beat of beats) {
    const from = camera;
    let t = 0;
    while (t < 1) {
      t = Math.min(1, t + dt / beat.duration);
      camera = tourPose(beat, from, t);
      // The bench asks for the same moment by elapsed time.
      const elapsed = start + t * beat.duration;
      samePose(camera, benchMotion(scene, elapsed / total, elapsed).pose, 1e-9);
    }
    samePose(camera, tourEnd(beat, from), 1e-12);
    start += beat.duration;
  }
  samePose(camera, tourAt(beats, home, total + 5), 1e-9);
  // Beats join without a jump: the end of one is the start of the next.
  let from = home;
  start = 0;
  for (const beat of beats) {
    samePose(tourAt(beats, home, start), from, 1e-9);
    from = tourEnd(beat, from);
    start += beat.duration;
  }
});

test("a hold starts where the flight landed and drifts the way the beat turned", () => {
  const beat = { ...holeById("m87").tour[1], drift: undefined };
  const landed = tourEnd(beat, { azimuth: 0.3, inclination: 0.4, distance: 40, roll: 0 });
  samePose(holdPose(beat, landed, 0), landed, 1e-12);
  const later = holdPose(beat, landed, 12);
  assert.equal(Math.sign(later.azimuth - landed.azimuth), Math.sign(beat.yaw));
  assert.ok(later.distance < landed.distance, "the push creeps inward");
  assert.equal(later.roll, landed.roll);
});

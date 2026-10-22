import assert from "node:assert/strict";
import test from "node:test";

import { Matrix4 } from "three";

import { writeCameraMatrix } from "@horizon/toolkit/camera";

import {
  cameraOf,
  createUniforms,
  sceneCamera,
  sceneWriter,
  traceKeyWriter,
  writeOrbitCamera,
} from "../src/features/black-hole/lib/frame.ts";
import { diskFlowVelocity } from "../src/features/black-hole/lib/physics.ts";
import { close } from "./toolkit-helpers.mjs";

const SPIN = 0.9;
const POSE = {
  azimuth: 0.55,
  inclination: 0.3,
  distance: 14,
  roll: 0.1,
  look: { yaw: 0.2, pitch: -0.05 },
  ride: 0.6,
};
const SCENE = {
  presetId: "lensed",
  spin: SPIN,
  exposure: 1,
  diskBrightness: 1,
  starIntensity: 1,
  tempScale: 1,
  gravity: true,
};

/** Turns a vector about the spin axis as the orbit's azimuth does: +Z towards +X. */
const turn = ([x, y, z], azimuth) => [
  x * Math.cos(azimuth) + z * Math.sin(azimuth),
  y,
  z * Math.cos(azimuth) - x * Math.sin(azimuth),
];

test("an orbit that only turns or animates traces the same rays, and its scene camera turns", () => {
  const uniforms = createUniforms();
  const key = traceKeyWriter(uniforms);
  const writeScene = sceneWriter(uniforms);
  writeScene(SCENE, 0, 192);
  writeOrbitCamera(uniforms, POSE, SPIN);
  const traced = [...key([])];

  for (const azimuth of [-2, 1.3, 7.9, 40]) {
    const pose = { ...POSE, azimuth };
    writeScene(SCENE, azimuth * 3, 192);
    writeOrbitCamera(uniforms, pose, SPIN);
    // Equal to the bit, so the recorded march can be replayed.
    assert.deepEqual(key([]), traced, `azimuth ${azimuth}`);

    const world = writeCameraMatrix(new Float64Array(16), cameraOf(pose, SPIN));
    sceneCamera(uniforms, new Matrix4()).elements.forEach((v, i) => close(v, world[i], 1e-9));
    // The riding camera's velocity turns with it: the gas's flow where the camera really is.
    const position = world.slice(12, 15);
    const flow = diskFlowVelocity(position, SPIN).map((v) => v * POSE.ride);
    const velocity = turn(uniforms.uCamVelocity.value.toArray(), uniforms.uAzimuth.value);
    velocity.forEach((v, i) => close(v, flow[i], 1e-12));
  }

  // Anything else that steers the march re-traces.
  const changed = (write) => {
    write();
    const differs = key([]).some((v, i) => v !== traced[i]);
    writeScene(SCENE, 0, 192);
    writeOrbitCamera(uniforms, POSE, SPIN);
    uniforms.uResolution.value.set(1, 1);
    return differs;
  };
  assert.ok(changed(() => writeOrbitCamera(uniforms, { ...POSE, distance: 15 }, SPIN)));
  assert.ok(changed(() => writeOrbitCamera(uniforms, { ...POSE, inclination: 0.31 }, SPIN)));
  assert.ok(changed(() => writeOrbitCamera(uniforms, { ...POSE, roll: 0 }, SPIN)));
  assert.ok(changed(() => writeScene({ ...SCENE, spin: 0.5 }, 0, 192)));
  assert.ok(changed(() => writeScene({ ...SCENE, gravity: false }, 0, 192)));
  assert.ok(changed(() => writeScene(SCENE, 0, 256)));
  assert.ok(changed(() => uniforms.uResolution.value.set(640, 360)));
  // The clock and the star and display scales only shade.
  assert.ok(!changed(() => writeScene({ ...SCENE, starIntensity: 2, exposure: 3 }, 9, 192)));
});

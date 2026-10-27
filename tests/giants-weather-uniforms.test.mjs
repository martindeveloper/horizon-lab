import assert from "node:assert/strict";
import test from "node:test";

import { weatherUniforms } from "../src/features/giants/lib/graphics/weather-uniforms.ts";
import { weatherAt } from "../src/features/giants/lib/model/activity.ts";
import { LOOKS } from "../src/features/giants/lib/model/looks.ts";
import { rungIndex } from "../src/features/giants/lib/model/rungs.ts";
import { FLARE_K } from "../src/features/giants/lib/parameters.ts";
import { stellarContinuum } from "../src/space/sun/graphics/atmosphere.ts";
import { closeRelative } from "./toolkit-helpers.mjs";

const weather = () => {
  const look = LOOKS[rungIndex("sun")];
  return weatherAt("solar", { ...look, temperature: look.equatorK }, 30);
};

test("cached region axes preserve spot orientation, handedness and polar behaviour", () => {
  const data = weather();
  const upload = weatherUniforms();
  try {
    for (const [centre, tilt, axis, side] of [
      [[0, 0, 1], 0, [1, 0, 0], [0, 1, 0]],
      [[0, 0, 1], Math.PI / 2, [0, 1, 0], [-1, 0, 0]],
      [[0, 1, 0], 0, [1, 0, 0], [0, 0, -1]],
      [[0, -1, 0], 0, [1, 0, 0], [0, 0, 1]],
    ]) {
      Object.assign(data.regions[0], { centre, tilt, strength: 1 });
      upload.fill(data);
      upload.uniforms.uRegionAxis.value[0].toArray().forEach((n, c) => closeRelative(n, axis[c]));
      upload.uniforms.uRegionSide.value[0].toArray().forEach((n, c) => closeRelative(n, side[c]));
    }
    upload.fill(null);
    assert.ok(upload.uniforms.uRegionState.value.every((state) => state.x === 0));
  } finally {
    upload.dispose();
  }
});

test("cached ejection directions wrap continuously and retain their angular opening", () => {
  const data = weather();
  const upload = weatherUniforms();
  try {
    for (const angle of [-Math.PI, -0.8, 0, 0.8, Math.PI]) {
      Object.assign(data.ejections[0], { angle, front: 2, spread: 0.3, brightness: 1 });
      upload.fill(data);
      const d = upload.uniforms.uEjectionDirection.value[0];
      closeRelative(Math.hypot(d.x, d.y), 1);
      closeRelative(Math.cos(Math.atan2(d.y, d.x) - angle), 1);
      closeRelative(Math.acos(d.z), 0.36);
    }
    Object.assign(data.ejections[0], { spread: 3 });
    upload.fill(data);
    closeRelative(upload.uniforms.uEjectionDirection.value[0].z, -1);
    upload.fill(null);
    assert.ok(upload.uniforms.uEjection.value.every((e) => e.w === 0));
  } finally {
    upload.dispose();
  }
});

test("cached emission preserves the spectrum, host-star exposure and dust scattering geometry", () => {
  const data = weather();
  const upload = weatherUniforms();
  const emission = () => Array.from(upload.uniforms.uOutflows.value.image.data.slice(8, 11));
  try {
    const flare = stellarContinuum(FLARE_K);
    upload.uniforms.uFlareColour.value
      .toArray()
      .forEach((v, c) => closeRelative(v, flare[c], 0.0006));
    const cloud = data.outflows[0];
    Object.assign(cloud, {
      centre: [0, 0, 2],
      width: 0.2,
      gas: 0.8,
      dust: 0,
      temperature: 3400,
      seed: 0.5,
    });
    assert.throws(() => upload.fill(data), /reference temperature/);
    for (const host of [3600, 4200]) {
      upload.fill(data, host);
      const gas = stellarContinuum(cloud.temperature),
        face = stellarContinuum(host);
      emission().forEach((v, c) =>
        closeRelative(v, 0.35 * cloud.gas * gas[c] * Math.exp(gas[3] - face[3]), 0.0006),
      );
    }
    Object.assign(cloud, { gas: 0, dust: 0.7 });
    upload.fill(data, 3600);
    const front = emission();
    const face = stellarContinuum(3600);
    front.forEach((v, c) => closeRelative(v, (0.04 * cloud.dust * face[c]) / 4));
    cloud.centre = [0, 0, 4];
    upload.fill(data, 3600);
    emission().forEach((v, c) => closeRelative(v * 4, front[c]));
    cloud.centre = [0, 0, -2];
    upload.fill(data, 3600);
    emission().forEach((v, c) => closeRelative(v * 4, front[c]));
  } finally {
    upload.dispose();
  }
});

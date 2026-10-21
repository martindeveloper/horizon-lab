import assert from "node:assert/strict";
import test from "node:test";

/**
 * The truncated ELP-2000 lunar theory against Meeus's worked example, and the Moon's place in
 * the scene against two eclipses: at a solar eclipse the Moon stands at the Sun, at a lunar
 * one opposite it, to within the parallax a geocentric place allows.
 */
import { keplerPosition, lunarPosition, lunarPositionJ2000 } from "@horizon/toolkit/bodies";
import { AU_KM } from "@horizon/toolkit/science";

import { planetElements } from "../src/space/solar-system/model/elements.ts";
import { moonOffset } from "../src/space/solar-system/model/moon-orbits.ts";

test("Meeus example 47.a: 1992 April 12 0h TD", () => {
  const { longitude, latitude, distanceKm } = lunarPosition(2448724.5);
  assert.ok(Math.abs(longitude - 133.162655) < 2e-6, `${longitude}`);
  assert.ok(Math.abs(latitude - -3.229126) < 2e-6, `${latitude}`);
  assert.ok(Math.abs(distanceKm - 368409.7) < 0.05, `${distanceKm}`);
});

const angle = (a, b) => {
  const dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  return (Math.acos(dot / (Math.hypot(...a) * Math.hypot(...b))) * 180) / Math.PI;
};

/** The direction from Earth to the Sun in the scene frame at a date. */
function sunFromEarth(date) {
  const earth = keplerPosition(planetElements("earth", 1, 0, date), [0, 0, 0]);
  return [-earth[0], -earth[1], -earth[2]];
}

test("the Moon stands at the Sun at the 2024 April 8 solar eclipse and opposite it at the 2025 March 14 lunar one", () => {
  const solar = new Date("2024-04-08T18:17:00Z");
  const moon = moonOffset("moon", solar);
  assert.ok(angle(moon, sunFromEarth(solar)) < 1.2, `${angle(moon, sunFromEarth(solar))}°`);
  const lunar = new Date("2025-03-14T06:59:00Z");
  const full = moonOffset("moon", lunar);
  assert.ok(180 - angle(full, sunFromEarth(lunar)) < 1.2, `${angle(full, sunFromEarth(lunar))}°`);
  /* Distances within the orbit's range, in au. */
  for (const at of [solar, lunar]) {
    const km = Math.hypot(...moonOffset("moon", at)) * AU_KM;
    assert.ok(km > 356_000 && km < 407_000, `${km} km`);
  }
});

test("the J2000 place precesses the longitude of date back and keeps the distance", () => {
  const date = new Date("2026-10-20T00:00:00Z");
  const j2000 = lunarPositionJ2000(date);
  const ofDate = lunarPosition(2461333.5 + 69 / 86_400);
  assert.ok(Math.abs(Math.hypot(...j2000) - ofDate.distanceKm) < 1e-6);
  const lon = (Math.atan2(j2000[1], j2000[0]) * 180) / Math.PI;
  const back = ((ofDate.longitude - lon + 540) % 360) - 180;
  /* A quarter century of general precession: about 0.37°. */
  assert.ok(back > 0.35 && back < 0.4, `${back}°`);
});

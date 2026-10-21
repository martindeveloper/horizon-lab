import assert from "node:assert/strict";
import test from "node:test";

import { AU_KM } from "@horizon/toolkit/science";

/**
 * A planet's centre beside its system's barycentre: the Moon swings Earth by about 4,670 km
 * against the Moon's direction, Charon swings Pluto by about 2,100 km.
 */
import {
  barycentreOffset,
  barycentreShare,
  isBarycentreHost,
} from "../src/features/voyage/lib/model/barycentre.ts";
import { moonOffset } from "../src/space/solar-system/model/moon-orbits.ts";

const km = (v) => Math.hypot(v[0], v[1], v[2]) * AU_KM;
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

test("Earth sits 1/82.3 of the Moon's distance from the barycentre, away from the Moon", () => {
  assert.ok(Math.abs(barycentreShare("earth") - 1 / 82.3) < 1e-4);
  for (const date of [new Date("2026-01-01T00:00:00Z"), new Date("2026-07-15T12:00:00Z")]) {
    const earth = barycentreOffset("earth", date);
    const moon = moonOffset("moon", date);
    /* The Moon's distance runs 356,000–407,000 km, so Earth's swing is 4,330–4,950 km. */
    assert.ok(km(earth) > 4300 && km(earth) < 4950, `${km(earth)} km`);
    assert.ok(dot(earth, moon) < 0);
    assert.ok(Math.abs(km(earth) / km(moon) - barycentreShare("earth")) < 1e-9);
  }
});

test("Pluto's centre is about 2,100 km from the Pluto–Charon barycentre, outside its surface", () => {
  const pluto = barycentreOffset("pluto", new Date("2026-03-01T00:00:00Z"));
  assert.ok(km(pluto) > 2050 && km(pluto) < 2200, `${km(pluto)} km`);
  assert.ok(km(pluto) > 1188);
  assert.equal(isBarycentreHost("pluto"), true);
  assert.equal(isBarycentreHost("mars"), false);
});

import assert from "node:assert/strict";
import { test } from "node:test";

/** Voyage's flights: gravity and its stepping, and the autopilot's schedule against the drive's trip. */
import {
  ALIGN_S,
  progressOf,
  transit,
  transitPhase,
  transitSeconds,
} from "../src/features/voyage/lib/model/autopilot.ts";
import {
  PIECES_PER_DYNAMICAL_TIME,
  circularSpeed,
  createWell,
  dynamicalTime,
  gmOf,
  gravityAt,
} from "../src/features/voyage/lib/model/gravity.ts";
import { DRIVES } from "../src/features/voyage/lib/model/parameters.ts";
import { tripProgress } from "../src/features/voyage/lib/model/relativity.ts";
import { createShip, stepShip } from "../src/features/voyage/lib/model/ship.ts";

const EARTH_KM = 6371;
const close = (a, b, rel) => Math.abs(a - b) <= rel * Math.abs(b);

test("gravity: Earth pulls one g at its surface and orbits there at 7.9 km/s", () => {
  const earth = { ...createWell(), gm: gmOf("earth") };
  const out = [0, 0, 0];
  gravityAt([EARTH_KM, 0, 0], [earth], 0, out);
  assert.ok(close(-out[0] * 1000, 9.82, 0.01), `${-out[0] * 1000} m/s²`);
  assert.ok(close(circularSpeed(EARTH_KM, earth.gm), 7.91, 0.01));
  assert.equal(gmOf("halley"), 0, "small bodies pull nothing");
  /* A well moves along its velocity over the step. */
  const moving = { pos: [0, 0, 0], vel: [1, 0, 0], gm: earth.gm };
  gravityAt([2 * EARTH_KM, 0, 0], [moving], EARTH_KM, out);
  assert.ok(close(-out[0] * 1000, 9.82, 0.01));
});

test("gravity: a leapfrog orbit stepped at the dynamical rule keeps its energy for 20 orbits", () => {
  const gm = gmOf("earth");
  const r = 4 * EARTH_KM;
  const wells = [{ ...createWell(), gm }];
  const ship = createShip();
  ship.x[0] = r;
  ship.u[2] = circularSpeed(r, gm) * 1.1;
  const energy = () => {
    const v2 = ship.u[0] ** 2 + ship.u[1] ** 2 + ship.u[2] ** 2;
    return v2 / 2 - gm / Math.hypot(...ship.x);
  };
  const before = energy();
  const piece = dynamicalTime(r, gm) / PIECES_PER_DYNAMICAL_TIME;
  const gravity = { at: (x, dt, out) => gravityAt(x, wells, dt, out), pieces: 50 };
  const period = 2 * Math.PI * dynamicalTime(r, gm) * 1.4;
  for (let t = 0; t < 20 * period; t += 50 * piece) stepShip(ship, 50 * piece, null, gravity);
  assert.ok(close(energy(), before, 0.01), `${energy()} vs ${before}`);
});

test("autopilot: the transit runs from home to the destination without stepping back", () => {
  const km = 2e8;
  let last = -1;
  for (let i = 0; i <= 200; i += 1) {
    const x = transit(i / 200, km, 25_000, 12_000);
    assert.ok(x >= last, `step ${i}`);
    last = x;
  }
  assert.equal(transit(0, km, 25_000, 12_000), 0);
  assert.ok(close(transit(1, km, 25_000, 12_000), km, 1e-9));
  assert.ok(close(transit(0.5, km, 25_000, 12_000), km / 2, 1e-9));
  assert.ok(transitSeconds(2e19, 2.5e4, 3e18) > transitSeconds(4e5, 2.5e4, 5e3));
});

test("autopilot: each point is the drive's real trip there, and the torch flips halfway", () => {
  const torch = DRIVES.torch;
  const km = 4.1e13; // α Centauri
  for (const s of [0.01, 0.2, 0.5, 0.73, 0.999]) {
    const { covered } = tripProgress(torch, km, s);
    assert.ok(Math.abs(progressOf(torch, km, covered) - s) < 1e-6, `s ${s}`);
  }
  assert.equal(progressOf(DRIVES.voyager, km, 0.3), 0.3);
  assert.equal(transitPhase(torch, 0.2, -1), "burn");
  assert.equal(transitPhase(torch, 0.6, 0.2), "flip");
  assert.equal(transitPhase(torch, 0.6, 5), "brake");
  assert.equal(transitPhase(DRIVES.sail, 0.6, 0.2), "cruise");
  assert.ok(ALIGN_S > 0);
});

test("flight assist: a full burn from rest covers the same share of the height at any scale", async () => {
  const { MANOEUVRE_ACCEL, assistWarp } =
    await import("../src/features/voyage/lib/model/assist.ts");
  for (const h of [2e4, 1.5e8, 9.5e12]) {
    const w = assistWarp(h);
    const covered = 0.5 * MANOEUVRE_ACCEL * (w * 2) ** 2;
    assert.ok(close(covered / h, 0.08, 1e-9), `${h} km: ${covered / h}`);
  }
  assert.ok(assistWarp(2e4) > 200 && assistWarp(2e4) < 400, "a few hundred near Earth");
  assert.equal(assistWarp(-5), assistWarp(50), "never below its floor");
});

test("speed regimes: normal to light speed as seen, cruise to ten thousand c, warp beyond, blending at the edges", async () => {
  const { CRUISE_KM_S, WARP_KM_S, regimeBlend, regimeOf } =
    await import("../src/features/voyage/lib/model/regime.ts");
  const C = 299_792.458;
  assert.equal(regimeOf(30), "normal");
  assert.equal(regimeOf(0.9 * C), "normal");
  assert.equal(regimeOf(1.1 * C), "cruise");
  assert.equal(regimeOf(9_000 * C), "cruise");
  assert.equal(regimeOf(2e4 * C), "warp");
  assert.ok(Math.abs(CRUISE_KM_S - C) < 1e-6 && Math.abs(WARP_KM_S - 1e4 * C) < 1e-3);
  assert.deepEqual(regimeBlend(10), { cruise: 0, warp: 0 });
  assert.ok(Math.abs(regimeBlend(C).cruise - 0.5) < 1e-9, "halfway at the edge");
  assert.deepEqual(regimeBlend(1e6 * C), { cruise: 1, warp: 1 });
});

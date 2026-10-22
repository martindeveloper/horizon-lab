import assert from "node:assert/strict";
/**
 * Special relativity for the ship, checked against independent SI arithmetic and textbook
 * identities (Rindler, Relativity: Special, General, and Cosmological, 2nd ed.), not against
 * the code's own formulas.
 */
import test from "node:test";

import {
  STANDARD_GRAVITY,
  aberrate,
  betaOf,
  blackbodyLut,
  blackbodyLutCoordinate,
  coastTrip,
  gammaOf,
  lorentzFactor,
  properVelocity,
  rapidity,
  relativisticDoppler,
  relativisticDopplerLaw,
  timeDilation,
  torchOneWay,
  torchTrip,
} from "@horizon/toolkit/science";

const C = 299_792.458; // km/s
const LY_KM = 9.4607304725808e12;
const YEAR_S = 365.25 * 86_400;
const near = (a, b, rel = 1e-9) =>
  assert.ok(Math.abs(a - b) <= rel * Math.max(1, Math.abs(b)), `${a} ≠ ${b}`);

test("proper velocity keeps β below 1 and γ(u = c) is √2", () => {
  near(gammaOf(C), Math.SQRT2);
  near(betaOf(C), Math.SQRT1_2);
  near(gammaOf({ x: 0, y: C, z: 0 }), Math.SQRT2);
  near(properVelocity(betaOf(10 * C)), 10 * C);
  assert.ok(betaOf(1e6 * C) < 1 && betaOf(1e6 * C) > 0.9999999);
  const out = betaOf({ x: 3e5, y: 4e5, z: 0 }, { x: 0, y: 0, z: 0 });
  near(Math.hypot(out.x, out.y, out.z), betaOf(5e5));
  near(lorentzFactor.compute({ beta: 0.6 }), 1.25);
  near(timeDilation.compute({ tau: 1, beta: 0.8 }), 5 / 3);
});

test("rapidity is the measure that adds: two boosts of 0.5c make 0.8c", () => {
  near(rapidity.compute({ beta: 0.6 }), Math.atanh(0.6));
  near(Math.tanh(2 * rapidity.compute({ beta: 0.5 })), 0.8);
});

test("the Doppler factor dead ahead is √((1+β)/(1−β)) and abeam is γ", () => {
  const beta = 0.6;
  const gamma = 1 / Math.sqrt(1 - beta * beta);
  near(relativisticDoppler(beta, gamma, 1), Math.sqrt(1.6 / 0.4));
  near(relativisticDoppler(beta, gamma, -1), Math.sqrt(0.4 / 1.6));
  near(relativisticDopplerLaw.compute({ beta, theta: 0 }), 2);
  // Light the source sent straight abeam arrives blueshifted by γ (the transverse Doppler effect).
  near(relativisticDoppler(beta, gamma, 0), gamma);
  // A direction aberrated to the observed frame gives the same D from the observed angle.
  const forward = { x: 0, y: 0, z: 1 };
  const n = { x: Math.sin(1), y: 0, z: Math.cos(1) };
  const seen = aberrate(n, forward, beta, gamma, { x: 0, y: 0, z: 0 });
  near(1 / (gamma * (1 - beta * seen.z)), relativisticDoppler(beta, gamma, n.z));
});

test("aberration keeps forward fixed, keeps unit length, crowds the sky ahead and round-trips", () => {
  const beta = 0.9;
  const gamma = 1 / Math.sqrt(1 - beta * beta);
  const forward = { x: 0, y: 0, z: 1 };
  const out = { x: 0, y: 0, z: 0 };
  aberrate(forward, forward, beta, gamma, out);
  near(out.x, 0);
  near(out.y, 0);
  near(out.z, 1);
  const n = { x: 0.6, y: 0, z: -0.8 };
  aberrate(n, forward, beta, gamma, out);
  near(Math.hypot(out.x, out.y, out.z), 1);
  assert.ok(out.z > n.z, "a star behind moves forward");
  // Textbook: cos θ' = (cos θ + β) / (1 + β cos θ).
  near(out.z, (n.z + beta) / (1 + beta * n.z));
  // In the moving frame the rest frame recedes at −β: aberrating back returns the star.
  const back = aberrate(out, forward, -beta, gamma, { x: 0, y: 0, z: 0 });
  near(back.x, n.x);
  near(back.y, n.y);
  near(back.z, n.z);
  // Writing into the input is allowed.
  aberrate(n, forward, beta, gamma, n);
  near(n.z, out.z);
});

test("a coast to α Centauri at Voyager's speed takes about 77,000 years", () => {
  const trip = coastTrip(4.37 * LY_KM, 17);
  near(trip.t / YEAR_S, (4.37 * C) / 17, 1e-6);
  assert.ok(trip.t / YEAR_S > 76_000 && trip.t / YEAR_S < 78_000, `${trip.t / YEAR_S} yr`);
  assert.ok(trip.tau < trip.t && trip.tau > trip.t * (1 - 1e-8));
});

test("a 1 g torch ship reaches Andromeda in 28.6 years of ship time and 2.5 million outside", () => {
  const trip = torchTrip(2.5e6 * LY_KM, STANDARD_GRAVITY);
  const tau = trip.tau / YEAR_S;
  const t = trip.t / YEAR_S;
  assert.ok(tau > 28.4 && tau < 28.8, `τ = ${tau} yr`);
  assert.ok(t > 2.49e6 && t < 2.51e6, `t = ${t} yr`);
  // Identity check: the half-trip from rest obeys x = (c²/a)(cosh(aτ/c) − 1) with τ/2.
  const c = C * 1e3;
  const a = STANDARD_GRAVITY;
  near(((c * c) / a) * (Math.cosh((a * trip.tau) / 2 / c) - 1), 1.25e6 * LY_KM * 1e3, 1e-9);
  near(trip.gammaMax, Math.cosh((a * trip.tau) / 2 / c));
  // One way at 1 g for a year covers 0.56 light-years, and the ship is at 0.77 c.
  const year = torchOneWay(YEAR_S, STANDARD_GRAVITY);
  near(year.distance * 1e3, ((c * c) / a) * (Math.cosh((a * YEAR_S) / c) - 1));
  assert.ok(
    year.distance / LY_KM > 0.55 && year.distance / LY_KM < 0.58,
    `${year.distance / LY_KM} ly`,
  );
  near(betaOf(year.u), 0.7748, 1e-4);
  near(betaOf(year.u), Math.tanh((a * YEAR_S) / c));
  assert.ok(year.t > YEAR_S);
});

test("the black-body lookup is log-spaced: 5800 K near white, 3000 K red, 20000 K blue", () => {
  const lut = blackbodyLut(256, 1000, 40_000);
  assert.equal(lut.length, 256 * 4);
  const texel = (kelvin) => {
    const i = Math.round(blackbodyLutCoordinate(kelvin, 1000, 40_000) * 255) * 4;
    return [lut[i], lut[i + 1], lut[i + 2], lut[i + 3]];
  };
  const sun = texel(5800);
  assert.ok(
    sun.every((v, k) => (k === 3 ? v === 255 : v > 225)),
    `5800 K ${sun}`,
  );
  const red = texel(3000);
  assert.ok(red[0] === 255 && red[2] < red[0] * 0.6, `3000 K ${red}`);
  const blue = texel(20_000);
  assert.ok(blue[2] === 255 && blue[0] < blue[2] * 0.8, `20000 K ${blue}`);
  // Log spacing: the middle texel is the geometric mean of the range.
  near(blackbodyLutCoordinate(Math.sqrt(1000 * 40_000), 1000, 40_000), 0.5);
  assert.throws(() => blackbodyLut(1, 1000, 40_000), RangeError);
});

test("short torch trips and burns approach Newtonian motion without cancellation", () => {
  for (const metres of [1e-6, 1, 1e3]) {
    const trip = torchTrip(metres / 1000, STANDARD_GRAVITY);
    const seconds = 2 * Math.sqrt(metres / STANDARD_GRAVITY);
    near(trip.t / seconds, 1, 1e-10);
    near(trip.tau / seconds, 1, 1e-10);
    const half = torchOneWay(trip.tau / 2, STANDARD_GRAVITY);
    near((half.distance * 2000) / metres, 1, 1e-10);
  }
  for (const seconds of [1e-6, 0.001, 1]) {
    const burn = torchOneWay(seconds, STANDARD_GRAVITY);
    near((burn.distance * 1000) / (0.5 * STANDARD_GRAVITY * seconds ** 2), 1, 1e-12);
    near(burn.t / seconds, 1, 1e-12);
    near((burn.u * 1000) / (STANDARD_GRAVITY * seconds), 1, 1e-12);
  }
  assert.deepEqual(torchTrip(0, STANDARD_GRAVITY), { t: 0, tau: 0, gammaMax: 1 });
  assert.deepEqual(torchOneWay(0, STANDARD_GRAVITY), { distance: 0, t: 0, u: 0 });
  assert.deepEqual(torchOneWay(10, 0), { distance: 0, t: 10, u: 0 });
});

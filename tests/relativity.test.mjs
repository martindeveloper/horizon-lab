import assert from "node:assert/strict";
/**
 * Black-hole physics checked against independent SI arithmetic and published
 * general-relativity identities, not against the code's own formulas.
 *
 * BPT = Bardeen, Press & Teukolsky (1972), ApJ 178, 347.
 */
import test from "node:test";

import { diskFluxProfile } from "../src/features/black-hole/lib/disk-profile.ts";
import {
  circularOrbitEnergy,
  circularOrbitMomentum,
  innermostStableOrbit,
  keplerAngularVelocity,
  kerrHorizon,
  photonOrbit,
} from "../src/features/black-hole/lib/equations.ts";
import {
  criticalImpactParameters,
  horizonOverM,
  iscoOverM,
  iscoPeriodSeconds,
  massSeconds,
  orbitalPeriodSeconds,
  photonOverM,
  rainDrDt,
  rainRedshift,
  schwarzschildKm,
} from "../src/features/black-hole/lib/physics.ts";

const near = (actual, expected, tolerance, label = "") =>
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${label} ${actual} is not within ${tolerance} of ${expected}`,
  );

/** Independent SI values, typed here on purpose. */
const C = 299_792_458; // m/s, exact
const GM_SUN = 1.3271244e20; // m³/s², IAU 2015 Resolution B3 nominal
const AU = 149_597_870_700; // m, exact
const SPINS = [-0.99, -0.5, 0, 0.3, 0.7, 0.9, 0.99, 0.998];

test("solar-mass scales match the IAU nominal GM☉", () => {
  // Rs = 2GM/c² = 2.9533 km; GM/c³ = 4.9255 µs.
  near(schwarzschildKm(1), (2 * GM_SUN) / C ** 2 / 1e3, 1e-3, "Rs");
  near(massSeconds(1), GM_SUN / C ** 3, 1e-10, "GM/c³");
  // Scaling is linear in mass: Sgr A* (4.3 × 10⁶ M☉) and M87* (6.5 × 10⁹ M☉).
  near(schwarzschildKm(4.3e6) / 1e6, 12.7, 0.05, "Sgr A* Rs, million km");
  // M87*: horizon diameter ~38 billion km, ~250 au, as the atlas copy says.
  const diameter = 2 * schwarzschildKm(6.5e9);
  near(diameter / 1e9, 38.4, 0.2, "M87* diameter, billion km");
  near((diameter * 1e3) / AU, 257, 2, "M87* diameter, au");
});

test("the Schwarzschild ISCO period equals Kepler's law at r = 6GM/c²", () => {
  // In Schwarzschild coordinates circular orbits obey Kepler exactly: T = 2π√(r³/GM).
  for (const mass of [10, 4.3e6, 6.5e9]) {
    const gm = GM_SUN * mass;
    const r = (6 * gm) / C ** 2;
    const kepler = 2 * Math.PI * Math.sqrt(r ** 3 / gm);
    near(iscoPeriodSeconds(mass, 0) / kepler, 1, 1e-4, `${mass} M☉`);
  }
  near(orbitalPeriodSeconds(10, 6, 0), 0.004549, 0.000002);
  near(orbitalPeriodSeconds(20, 6, 0), 2 * orbitalPeriodSeconds(10, 6, 0), 1e-12);
  // Sgr A*'s ISCO period is about half an hour.
  near(iscoPeriodSeconds(4.3e6, 0) / 60, 32.6, 0.2, "Sgr A* minutes");
});

test("Kerr radii solve their defining equations at every spin", () => {
  for (const a of SPINS) {
    // Horizon: r² − 2r + a² = 0.
    const rh = kerrHorizon.compute({ a });
    near(rh * rh - 2 * rh + a * a, 0, 1e-12, `horizon a=${a}`);
    // Photon orbit: circular orbits there need infinite energy, so the
    // denominator r^(3/2) − 3r^(1/2) + 2a of E and L vanishes (BPT 2.18).
    const rph = photonOrbit.compute({ a });
    near(rph ** 1.5 - 3 * Math.sqrt(rph) + 2 * a, 0, 1e-9, `photon a=${a}`);
    assert.ok(rph > rh, `photon orbit outside the horizon a=${a}`);
    // ISCO: marginally stable, so E(r) is stationary there (BPT 2.21).
    const risco = innermostStableOrbit.compute({ a });
    const h = 1e-4;
    const dE =
      (circularOrbitEnergy.compute({ r: risco + h, a }) -
        circularOrbitEnergy.compute({ r: risco - h, a })) /
      (2 * h);
    near(dE, 0, 1e-6, `dE/dr at ISCO a=${a}`);
    // And its energy is E = √(1 − 2/(3 r_ISCO)) (BPT 2.23).
    near(circularOrbitEnergy.compute({ r: risco, a }), Math.sqrt(1 - 2 / (3 * risco)), 1e-12);
    assert.ok(risco > rph, `ISCO outside the photon orbit a=${a}`);
  }
});

test("Kerr radii reach their extremal and Schwarzschild limits", () => {
  near(kerrHorizon.compute({ a: 0 }), 2, 1e-15);
  near(photonOrbit.compute({ a: 0 }), 3, 1e-12);
  near(innermostStableOrbit.compute({ a: 0 }), 6, 1e-12);
  near(kerrHorizon.compute({ a: 1 }), 1, 1e-12);
  near(photonOrbit.compute({ a: 1 }), 1, 1e-9);
  near(innermostStableOrbit.compute({ a: 1 }), 1, 1e-9);
  near(photonOrbit.compute({ a: -1 }), 4, 1e-9);
  near(innermostStableOrbit.compute({ a: -1 }), 9, 1e-9);
  // The app clamps spin below 1; the clamped helpers agree with the formulas.
  near(horizonOverM(-0.9), horizonOverM(0.9), 1e-12);
  near(iscoOverM(-0.998), 8.994374455, 1e-8);
  near(innermostStableOrbit.compute({ a: 0.998 }), 1.236970655, 1e-8);
  near(horizonOverM(0.5), kerrHorizon.compute({ a: 0.5 }), 1e-15);
  near(photonOverM(0.5), photonOrbit.compute({ a: 0.5 }), 1e-15);
  near(iscoOverM(0.5), innermostStableOrbit.compute({ a: 0.5 }), 1e-15);
});

test("accretion efficiency matches the classic values", () => {
  // 1 − E_ISCO: 5.72 % for Schwarzschild, 32 % at Thorne's limit a = 0.998.
  const efficiency = (a) => 1 - circularOrbitEnergy.compute({ r: iscoOverM(a), a });
  near(efficiency(0), 1 - Math.sqrt(8 / 9), 1e-12, "a = 0");
  near(efficiency(0.998), 0.321, 0.002, "a = 0.998");
  // Schwarzschild ISCO: L = 2√3.
  near(circularOrbitMomentum.compute({ r: 6, a: 0 }), 2 * Math.sqrt(3), 1e-12);
  // Far out, orbits turn Keplerian: Ω → r^(−3/2), E → 1 − 1/(2r).
  near(keplerAngularVelocity.compute({ r: 1e6, a: 0.9 }) * 1e9, 1, 1e-6);
  near(circularOrbitMomentum.compute({ r: 1e6, a: 0.5 }) / 1e3, 1, 1e-3);
  near(1 - circularOrbitEnergy.compute({ r: 1e4, a: 0 }), 1 / (2 * 1e4), 1e-7);
});

test("the shadow's critical impact parameters follow Bardeen (1973)", () => {
  const zero = criticalImpactParameters(0);
  near(zero.prograde, 3 * Math.sqrt(3), 1e-9);
  near(zero.retrograde, 3 * Math.sqrt(3), 1e-9);
  // As a → 1 the prograde edge tends to 2 M and the retrograde edge to 7 M.
  const fast = criticalImpactParameters(0.999);
  near(fast.prograde, 2, 0.1, "prograde");
  near(fast.retrograde, 7, 0.01, "retrograde");
  // Monotone in between: the prograde edge moves in, the retrograde edge out.
  let previous = criticalImpactParameters(0.01);
  for (const a of [0.2, 0.4, 0.6, 0.8, 0.95]) {
    const b = criticalImpactParameters(a);
    assert.ok(b.prograde < previous.prograde && b.retrograde > previous.retrograde, `a=${a}`);
    previous = b;
  }
});

test("falling clocks keep proper time along a rain geodesic", () => {
  // Integrated, τ(r₀ → r₁) = (√2 / 3)(r₀^(3/2) − r₁^(3/2)).
  const r0 = 22;
  const r1 = 3;
  let tau = 0;
  const steps = 100_000;
  const dr = (r0 - r1) / steps;
  for (let k = 0; k < steps; k += 1) {
    const r = r0 - (k + 0.5) * dr;
    tau += dr / (-rainDrDt(r) / rainRedshift(r));
  }
  near(tau, (Math.SQRT2 / 3) * (r0 ** 1.5 - r1 ** 1.5), 1e-6, "proper time");
});

test("the Page–Thorne disk flux vanishes at the ISCO and peaks near 9.55 M", () => {
  // Zero-torque inner edge; for a = 0 the flux maximum is at r ≈ 9.55 M.
  const inner = 6;
  const outer = 15.6;
  const flux = diskFluxProfile(0, inner, outer, 512);
  assert.equal(flux[0], 0);
  let peak = 0;
  for (let i = 1; i < flux.length; i += 1) if (flux[i] > flux[peak]) peak = i;
  near(inner + ((outer - inner) * peak) / (flux.length - 1), 9.55, 0.05, "peak radius");
  // Spin moves the inner edge and the peak inward.
  const fast = diskFluxProfile(0.9, iscoOverM(0.9), outer, 512);
  let fastPeak = 0;
  for (let i = 1; i < fast.length; i += 1) if (fast[i] > fast[fastPeak]) fastPeak = i;
  const fastRadius = iscoOverM(0.9) + ((outer - iscoOverM(0.9)) * fastPeak) / (fast.length - 1);
  assert.ok(fastRadius < 6, `a = 0.9 peak at ${fastRadius} M`);
});

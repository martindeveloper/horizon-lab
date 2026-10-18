import assert from "node:assert/strict";
import test from "node:test";

import { circularOrbit, diskFluxProfile } from "../src/features/black-hole/lib/disk-profile.ts";
import {
  photonOverM,
  iscoOverM,
  criticalImpactParameters,
  rainRedshift,
  rainDrDt,
} from "../src/features/black-hole/lib/physics.ts";
import {
  renderBudget,
  renderScale,
  framedRayFov,
} from "../src/features/black-hole/lib/render-policy.ts";
import {
  dragStreamline,
  shadowCurve,
  shadowScale,
} from "../src/features/black-hole/lib/sketches.ts";

const close = (actual, expected, tolerance = 1e-8) =>
  assert.ok(Math.abs(actual - expected) < tolerance, `${actual} != ${expected}`);
test("rain-clock rates are coordinate-time ratios, and conserve unit specific energy", () => {
  for (const r of [2.06, 3, 6, 20, 100]) {
    const f = 1 - 2 / r;
    close(rainRedshift(r), f);
    close(rainDrDt(r) / rainRedshift(r), -Math.sqrt(2 / r));
    // E² = (dr/dτ)² + (1−2/r), for radial free fall from rest at infinity.
    close((rainDrDt(r) / rainRedshift(r)) ** 2 + f, 1);
  }
});
test("disk orbit energies and flux converge independently of texture resolution", () => {
  close(circularOrbit(6, 0).energy, Math.sqrt(8 / 9));
  close(circularOrbit(6, 0).momentum, Math.sqrt(12));
  for (const spin of [0, 0.82, 0.94, 0.998]) {
    const inner = iscoOverM(spin);
    const coarse = diskFluxProfile(spin, inner, 15.6, 512);
    const fine = diskFluxProfile(spin, inner, 15.6, 8177); // 16 subdivisions per coarse interval
    assert.equal(coarse[0], 0);
    assert.ok(coarse.every((v) => Number.isFinite(v) && v >= 0));
    const peak = Math.max(...fine);
    let error = 0;
    for (let i = 0; i < coarse.length; i++)
      error = Math.max(error, Math.abs(coarse[i] - fine[i * 16]) / peak);
    assert.ok(error < 0.005, `spin=${spin}: relative peak flux error ${error}`);
  }
  // Newtonian large-r limit: F r³ → 3/2 in this unnormalized convention.
  const outer = 1e6;
  const far = diskFluxProfile(0, 6, outer, 100001);
  close(far.at(-1) * outer ** 3, 1.5, 0.03);
});
test("render budgets bound high-DPI desktops and phones without battery API support", () => {
  for (const quality of ["economy", "standard", "cinema"]) {
    for (const constrained of [false, true]) {
      for (const [w, h, dpr] of [
        [3840, 2160, 3],
        [390, 844, 3],
        [1280, 756, 2],
      ]) {
        const budget = renderBudget(quality, constrained, true);
        const scale = renderScale(quality, w, h, dpr, constrained);
        const density = Math.min(dpr, budget.dprCap);
        assert.ok(w * h * (scale * density) ** 2 <= budget.pixels + 1);
        assert.ok(budget.fps <= 60);
        if (quality !== "cinema" || constrained) assert.ok(budget.fps <= 30);
      }
    }
  }
  const base = (50 * Math.PI) / 180;
  close(Math.tan(framedRayFov(base, 0.5) / 2) * 0.5, Math.tan(framedRayFov(base, 1) / 2));
});

test("guide sketches draw the Bardeen shadow and Kerr frame dragging", () => {
  const width = (curve) => {
    const xs = curve.map(([x]) => x);
    return [Math.min(...xs), Math.max(...xs)];
  };
  for (const [x, y] of shadowCurve(0, 1)) close(Math.hypot(x, y), 3 * Math.sqrt(3), 1e-9);
  // Edge-on near-extremal Kerr: prograde edge at α ≈ −2, retrograde at α ≈ 7.
  const [lo, hi] = width(shadowCurve(0.998, Math.PI / 2));
  close(lo, -2, 0.15);
  close(hi, 7, 0.05);
  assert.ok(shadowScale(30) < 1 && shadowScale(30) > 0.95);
  // Zero-angular-momentum infall co-rotates, and more so at higher spin.
  const swept = (a) => dragStreamline(a).at(-1)[1];
  assert.equal(swept(0), 0);
  assert.ok(swept(0.998) > swept(0.7) && swept(0.7) > 0);
});

test("negative spin describes a retrograde disk", () => {
  close(iscoOverM(-0.999), 9, 0.05);
  close(photonOverM(-0.999), 4, 0.05);
  assert.ok(iscoOverM(-0.5) > 6 && photonOverM(-0.5) > 3);
  // Prograde and retrograde impact parameters belong to the hole, not the sign of a.
  assert.deepEqual(criticalImpactParameters(-0.7), criticalImpactParameters(0.7));
  const flux = diskFluxProfile(-0.9, iscoOverM(-0.9));
  assert.ok(flux.every(Number.isFinite) && Math.max(...flux) > 0);
});

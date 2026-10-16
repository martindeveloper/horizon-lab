import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { circularOrbit, diskFluxProfile } from "../src/features/black-hole/lib/disk-profile.ts";
import {
  DISK_OUTER_RADIUS,
  DUST_CONE,
  DUST_OUTER,
  DUST_SLOPE,
  ESCAPE_RADIUS,
  NEAR_CAMERA_RADIUS,
  STRAIGHT_IMPACT,
} from "../src/features/black-hole/lib/parameters.ts";
import {
  horizonOverM,
  photonOverM,
  iscoOverM,
  criticalImpactParameters,
  schwarzschildKm,
  massSeconds,
  orbitalPeriodSeconds,
  rainRedshift,
  rainDrDt,
} from "../src/features/black-hole/lib/physics.ts";
import { QUALITY_STEPS } from "../src/features/black-hole/lib/presets.ts";
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
test("Schwarzschild and Kerr landmarks match analytic limits and published benchmark values", () => {
  close(horizonOverM(0), 2);
  close(photonOverM(0), 3);
  close(iscoOverM(0), 6);
  close(iscoOverM(0.998), 1.236970655, 1e-8);
  close(horizonOverM(-0.9), horizonOverM(0.9));
  close(iscoOverM(-0.998), 8.994374455, 1e-8);
  close(schwarzschildKm(1), 2.9533, 0.001);
  close(massSeconds(1), 4.9256e-6, 1e-9);
  close(orbitalPeriodSeconds(10, 6, 0), 0.004549, 0.000002);
  close(orbitalPeriodSeconds(20, 6, 0), 2 * orbitalPeriodSeconds(10, 6, 0));
});
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

const shader = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("blackbody colours use Helland's published coefficients in every branch", () => {
  const source = shader("packages/toolkit/src/shaders/temperature.glsl");
  const constants = [...source.matchAll(/\d+\.\d{6,}/g)].map((match) => Number(match[0]));
  for (const published of [
    99.4708025861, 161.1195681661, 329.698727446, 288.1221695283, 138.5177312231, 305.0447927307,
  ])
    assert.ok(
      constants.some((value) => Math.abs(value - published / 255) < 1e-6),
      `${published}/255 missing`,
    );
});

test("filament texture lattice closes seamlessly around the disk", () => {
  // JavaScript mirror of gasPatch's sheared periodic lattice (any hash works).
  const hash = ([x, y]) => {
    const h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return h - Math.floor(h);
  };
  const lattice = ([x, y], [px, py]) => {
    const turns = Math.floor(x / px);
    return hash([x - turns * px, y - turns * py]);
  };
  const noise = ([x, y], period) => {
    const ix = Math.floor(x),
      iy = Math.floor(y);
    const fx = x - ix,
      fy = y - iy;
    const sx = fx * fx * (3 - 2 * fx),
      sy = fy * fy * (3 - 2 * fy);
    const mix = (a, b, t) => a + (b - a) * t;
    return mix(
      mix(lattice([ix, iy], period), lattice([ix + 1, iy], period), sx),
      mix(lattice([ix, iy + 1], period), lattice([ix + 1, iy + 1], period), sx),
      sy,
    );
  };
  const period = [12, 16];
  const sample = (angle, rho) =>
    noise(
      [
        (angle * period[0]) / (2 * Math.PI),
        ((angle + 4 * Math.log(rho)) * period[1]) / (2 * Math.PI),
      ],
      period,
    );
  for (const rho of [3, 6.4, 11, 15])
    for (const offset of [0, 0.37, 2])
      close(sample(Math.PI + offset, rho), sample(-Math.PI + offset, rho), 1e-9);
});

test("ray march resolves the zero-spin shadow and lenses the sky to infinity", () => {
  // JavaScript mirror of main()'s a = 0 march: rays are planar, so 2D suffices.
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
  const len = (a) => Math.hypot(a[0], a[1]);
  const acc = (p, v) => {
    const r = len(p);
    const L = p[0] * v[1] - p[1] * v[0];
    return [(-3 * L * L * p[0]) / r ** 5, (-3 * L * L * p[1]) / r ** 5];
  };
  const stepSize = (r, v) => Math.min(Math.max(((r < 8 ? 0.07 : 0.1) * r) / len(v), 0.012), 48);
  // Camera on +y; a static observer's ray at impact parameter b, as in main().
  const launch = (cam, b) => {
    const sin = (b * Math.sqrt(1 - 2 / cam)) / cam;
    const cos = Math.sqrt(1 - sin * sin);
    return { p: [0, cam], v: [sin / Math.sqrt(1 - 2 / cam), -cos], rd: [sin, -cos] };
  };
  // Without a jet, outbound rays hand over to lensTail() past the dust cone's far corner.
  const exitR = Math.min(
    DISK_OUTER_RADIUS * DUST_OUTER * Math.hypot(1, DUST_SLOPE + DUST_CONE),
    ESCAPE_RADIUS,
  );
  const march = (cam, b, budget) => {
    let { p, v } = launch(cam, b);
    let r = len(p);
    let a = acc(p, v);
    for (let i = 0; i < budget; i++) {
      if (r < 2) return null;
      if (r > exitR && dot(p, v) > 0) return { p, v };
      const dt = stepSize(r, v);
      const mid = [v[0] + 0.5 * dt * a[0], v[1] + 0.5 * dt * a[1]];
      p = [p[0] + mid[0] * dt, p[1] + mid[1] * dt];
      r = len(p);
      a = acc(p, mid);
      v = [mid[0] + 0.5 * dt * a[0], mid[1] + 0.5 * dt * a[1]];
    }
    return null;
  };
  // Mirror of lensTail(), returned as the outgoing angle.
  const lensTail = (p, v) => {
    const d = [v[0] / len(v), v[1] / len(v)];
    const s = dot(p, d);
    const toward = [s * d[0] - p[0], s * d[1] - p[1]];
    const b = len(toward);
    const share = 0.25 * (2 - (s * (2 * s * s + 3 * b * b)) / (b * b + s * s) ** 1.5);
    const bend = (4 / b + (15 * Math.PI) / (4 * b * b)) * share;
    const out = [
      d[0] * Math.cos(bend) + (toward[0] * Math.sin(bend)) / b,
      d[1] * Math.cos(bend) + (toward[1] * Math.sin(bend)) / b,
    ];
    return Math.atan2(out[1], out[0]);
  };
  // Converged reference: classical RK4 with 0.4% steps, out to 20,000 M.
  const reference = (cam, b) => {
    let { p, v } = launch(cam, b);
    const f = (q, w) => [w, acc(q, w)];
    const axpy = (x, y, s) => [x[0] + y[0] * s, x[1] + y[1] * s];
    while (len(p) < 20_000 || dot(p, v) < 0) {
      const dt = 0.004 * len(p);
      const [p1, v1] = f(p, v);
      const [p2, v2] = f(axpy(p, p1, dt / 2), axpy(v, v1, dt / 2));
      const [p3, v3] = f(axpy(p, p2, dt / 2), axpy(v, v2, dt / 2));
      const [p4, v4] = f(axpy(p, p3, dt), axpy(v, v3, dt));
      p = axpy(
        p,
        [p1[0] + 2 * p2[0] + 2 * p3[0] + p4[0], p1[1] + 2 * p2[1] + 2 * p3[1] + p4[1]],
        dt / 6,
      );
      v = axpy(
        v,
        [v1[0] + 2 * v2[0] + 2 * v3[0] + v4[0], v1[1] + 2 * v2[1] + 2 * v3[1] + v4[1]],
        dt / 6,
      );
    }
    return Math.atan2(v[1], v[0]);
  };
  const critical = 3 * Math.sqrt(3);
  for (const cam of [26, 60, 200, 480]) {
    // Rays that exhaust the budget are drawn dark: they must not widen the shadow.
    for (const [quality, budget] of Object.entries(QUALITY_STEPS)) {
      let lo = critical;
      let hi = 12;
      for (let k = 0; k < 40; k++) {
        const mid = (lo + hi) / 2;
        if (march(cam, mid, budget)) hi = mid;
        else lo = mid;
      }
      assert.ok(hi < critical * 1.02, `${quality} at ${cam} M: shadow edge ${hi}`);
    }
    // Marched or not, the sky direction must match the converged ray.
    for (const b of [5.4, 8, 16, 24, 33.9, 34.1, 60, 120]) {
      if (b > cam * 0.95) continue;
      const ray = launch(cam, b);
      const marched = cam < NEAR_CAMERA_RADIUS || len(ray.p) * ray.rd[0] < STRAIGHT_IMPACT;
      const out = marched ? march(cam, b, QUALITY_STEPS.cinema) : ray;
      const error = Math.abs(lensTail(out.p, out.v) - reference(cam, b));
      assert.ok(error < (0.25 * Math.PI) / 180, `b=${b} at ${cam} M: ${(error * 180) / Math.PI}°`);
    }
  }
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

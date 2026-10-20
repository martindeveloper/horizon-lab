import assert from "node:assert/strict";
import test from "node:test";

import {
  DISK_OUTER_RADIUS,
  circularOrbit,
  diskFluxProfile,
} from "../src/features/black-hole/lib/disk-profile.ts";
import { orbitBasis } from "../src/features/black-hole/lib/frame.ts";
import {
  cameraRay,
  carterOf,
  criticalCurve,
  diskShift,
  flatDiskShift,
  inversePotential,
  kerrMetric,
  kerrStep,
  plungeShift,
  traceFlatRay,
  traceRay,
  blRadius,
} from "../src/features/black-hole/lib/kerr-rays.ts";
import { DISK_PEAK_FLUX, PLUNGE_GLOW } from "../src/features/black-hole/lib/parameters.ts";
import {
  cameraFloor,
  horizonOverM,
  photonOverM,
  iscoOverM,
  criticalImpactParameters,
  rainRedshift,
  rainDrDt,
} from "../src/features/black-hole/lib/physics.ts";
import {
  BLACK_HOLE_QUALITY,
  renderBudget,
  renderScale,
} from "../src/features/black-hole/lib/quality.ts";
import { framedRayFov } from "../src/features/black-hole/lib/render-policy.ts";
import { dragStreamline, shadowScale } from "../src/features/black-hole/lib/sketches.ts";
import { close } from "./toolkit-helpers.mjs";

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
  for (const quality of ["economy", "standard", "cinema", "max"]) {
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
        if (
          quality === "economy" ||
          quality === "standard" ||
          (quality === "cinema" && constrained)
        )
          assert.ok(budget.fps <= 30);
      }
    }
  }
  /* Max spends the most everywhere, but within a phone's means on touch or battery. */
  const phone = renderBudget("max", true, true);
  assert.ok(phone.pixels > renderBudget("cinema", true, true).pixels);
  assert.ok(phone.pixels < renderBudget("max", false, true).pixels);
  assert.ok(renderBudget("max", false, false).pixels > renderBudget("cinema", false, true).pixels);
  const base = (50 * Math.PI) / 180;
  close(Math.tan(framedRayFov(base, 0.5) / 2) * 0.5, Math.tan(framedRayFov(base, 1) / 2));
});

/** Camera where the observatory puts it: distance d, elevation above the disk, azimuth. */
function camera(d, elevation, azimuth = 0.4) {
  const c = Math.cos(elevation);
  const pos = [d * c * Math.sin(azimuth), d * Math.sin(elevation), d * c * Math.cos(azimuth)];
  return { pos, basis: orbitBasis(...pos) };
}
function pixel({ basis }, x, y) {
  const v = basis.fwd.map((f, i) => f + x * basis.right[i] + y * basis.up[i]);
  const l = Math.hypot(...v);
  return v.map((c) => c / l);
}
/** Screen radius (tangent units) along `angle` where rays stop escaping. */
function captureEdge(cam, spin, angle, budget) {
  const [ux, uy] = [Math.cos(angle), Math.sin(angle)];
  const escapes = (t) =>
    traceRay(cam.pos, pixel(cam, ux * t, uy * t), spin, { budget }).outcome === "escaped";
  let lo = 0;
  let hi = 12 / Math.hypot(...cam.pos);
  for (let i = 0; i < 36; i++) {
    const mid = (lo + hi) / 2;
    if (escapes(mid)) hi = mid;
    else lo = mid;
  }
  return (lo + hi) / 2;
}
/** Radius of a closed screen curve along `angle`, where the ray from the centre crosses it. */
function curveRadius(curve, angle) {
  const [ux, uy] = [Math.cos(angle), Math.sin(angle)];
  for (let i = 1; i < curve.length; i++) {
    const [ax, ay] = curve[i - 1];
    const [bx, by] = curve[i];
    // Solve t·u = a + s·(b − a) for 0 ≤ s ≤ 1, t > 0.
    const det = ux * (ay - by) - uy * (ax - bx);
    if (Math.abs(det) < 1e-15) continue;
    const t = (ax * (ay - by) - ay * (ax - bx)) / det;
    const s = (ux * ay - uy * ax) / det;
    if (t > 0 && s >= 0 && s <= 1) return t;
  }
  return NaN;
}

test("the camera's critical curve has the Schwarzschild and Bardeen limits", () => {
  // A static observer at r sees the a = 0 shadow edge at sin α = 3√3 √(1 − 2/r) / r.
  for (const d of [8, 26, 480]) {
    const cam = camera(d, 0.3);
    const edge = Math.tan(Math.asin((3 * Math.sqrt(3) * Math.sqrt(1 - 2 / d)) / d));
    for (const [x, y] of criticalCurve(0, cam.pos, cam.basis)) close(Math.hypot(x, y), edge, 2e-4);
  }
  // Edge-on near-extremal Kerr from far away: prograde edge at α ≈ 2.1 M on the approaching
  // (right) side, retrograde at α ≈ 7.0 M (Bardeen 1973).
  const far = camera(1e5, 0);
  const xs = criticalCurve(0.998, far.pos, far.basis).map(([x]) => x * 1e5);
  close(Math.max(...xs), 2.11, 0.02);
  close(Math.min(...xs), -6.98, 0.02);
});

test("traced Kerr rays are captured exactly inside the camera's critical curve", () => {
  const cases = [
    [0, 480, 0],
    [0, 8, 0.2],
    [0.94, 28, 1.05],
    [0.9, 480, 1.27],
    [0.998, 30, 0.05],
    [0.998, 480, 0],
    [-0.9, 100, 0.35],
  ];
  for (const [spin, d, elevation] of cases) {
    const cam = camera(d, elevation);
    const curve = criticalCurve(spin, cam.pos, cam.basis);
    for (const angle of [0, 0.7, Math.PI / 2, Math.PI, 4.2]) {
      const exact = curveRadius(curve, angle);
      // Converged: an unlimited budget lands on the analytic curve.
      const converged = captureEdge(cam, spin, angle, 4000);
      assert.ok(
        Math.abs(converged / exact - 1) < 0.004,
        `a=${spin} d=${d} θ=${angle}: ${converged * d} vs ${exact * d}`,
      );
      // The standard budget leaves near-critical rays dark, never inside the curve.
      const shipped = captureEdge(cam, spin, angle, BLACK_HOLE_QUALITY.standard.steps);
      assert.ok(
        shipped / exact > 0.999 && shipped / exact < 1.035,
        `a=${spin} d=${d} θ=${angle}: ${shipped * d} vs ${exact * d}`,
      );
    }
  }
});

test("rays that run out of steps are reported apart from captured ones", () => {
  // Just outside the near-extremal prograde edge, light winds many times before escaping.
  const cam = camera(480, 0);
  const x = curveRadius(criticalCurve(0.998, cam.pos, cam.basis), 0) * 1.01;
  const dir = pixel(cam, x, 0);
  assert.equal(traceRay(cam.pos, dir, 0.998, { budget: 4000 }).outcome, "escaped");
  assert.equal(
    traceRay(cam.pos, dir, 0.998, { budget: BLACK_HOLE_QUALITY.economy.steps }).outcome,
    "exhausted",
  );
});

test("integration keeps Carter's constant and the radial potential", () => {
  const cam = camera(30, 0.2);
  for (const spin of [0, 0.7, 0.998]) {
    const edge = curveRadius(criticalCurve(spin, cam.pos, cam.basis), 0.4);
    let ray = cameraRay(
      cam.pos,
      pixel(cam, edge * 1.02 * Math.cos(0.4), edge * 1.02 * Math.sin(0.4)),
      spin,
    );
    const scale = ray.Q + ray.L ** 2 + ray.E ** 2;
    for (let i = 0; i < 400 && ray.u > 1 / 60; i++) {
      ray = kerrStep(ray, spin);
      close(carterOf(ray, spin) / scale, ray.Q / scale, 1e-9);
      assert.ok(Math.abs(ray.ud ** 2 - inversePotential(ray, ray.u, spin)) / scale < 2e-3);
    }
  }
});

test("disk images converge as the step shrinks", () => {
  for (const [spin, elevation] of [
    [0, 0.3],
    [0.94, 1.05],
    [0.998, 0.12],
  ]) {
    const cam = camera(28, elevation);
    for (let i = 0; i < 40; i++) {
      const dir = pixel(
        cam,
        (0.45 * Math.cos(i * 2.4) * ((i % 8) + 1)) / 8,
        (0.45 * Math.sin(i * 2.4) * ((i % 8) + 1)) / 8,
      );
      const coarse = traceRay(cam.pos, dir, spin, { budget: 4000 }).crossing;
      const fine = traceRay(cam.pos, dir, spin, { budget: 40000, refine: 8 }).crossing;
      if (!(fine < DISK_OUTER_RADIUS)) continue;
      assert.ok(Math.abs(coarse / fine - 1) < 0.005, `a=${spin} pixel ${i}: ${coarse} vs ${fine}`);
    }
  }
});

test("disk frequency shifts are measured by the camera, not at infinity", () => {
  // Looking straight down the axis from 26 M: no orbital Doppler, so g is the gas's
  // √(1 − 3/r) times the camera's own blueshift 1/√(1 − 2/26) ≈ 1.041.
  const ray = cameraRay([0, 26, 0], [0, -1, 0], 0);
  for (const r of [6, 10, 15])
    close(diskShift(ray, r, 0), Math.sqrt(1 - 3 / r) / Math.sqrt(1 - 2 / 26), 1e-9);
  close(diskShift(cameraRay([0, 1e7, 0], [0, -1, 0], 0), 6, 0), Math.sqrt(0.5), 1e-6);
  // Plunging gas leaves the ISCO on its circular orbit, so the two shifts meet there.
  for (const spin of [0, 0.9]) {
    const isco = iscoOverM(spin);
    const cam = camera(28, 0.4);
    const probe = cameraRay(cam.pos, pixel(cam, 0.12, -0.05), spin);
    close(plungeShift(probe, isco, -0.01, spin, isco), diskShift(probe, isco, spin), 1e-6);
  }
});

test("plunging gas stays faint beside the disk, even blueshifted edge-on", () => {
  // A zero-torque disk's flux vanishes at the ISCO; the illustrative plunge glow must not
  // outshine it. Compare the brightest g⁴-weighted samples of both across an edge-on view.
  for (const spin of [0.6, 0.94]) {
    const cam = camera(30, 0.04, 0);
    const inner = iscoOverM(spin);
    const flux = diskFluxProfile(spin, inner);
    const peak = Math.max(...flux);
    let disk = 0;
    let plunge = 0;
    for (let j = 0; j < 30; j++)
      for (let i = 0; i < 40; i++) {
        let ray = cameraRay(
          cam.pos,
          pixel(cam, ((i - 20) / 20) * 0.3, ((j - 15) / 20) * 0.3),
          spin,
        );
        for (
          let k = 0;
          k < BLACK_HOLE_QUALITY.standard.steps &&
          ray.u * 28 > 0.5 &&
          ray.u * horizonOverM(spin) < 0.99;
          k++
        ) {
          const next = kerrStep(ray, spin);
          if (ray.s[1] * next.s[1] <= 0) {
            const t = ray.s[1] / (ray.s[1] - next.s[1]);
            const r = 1 / (ray.u + (next.u - ray.u) * t);
            if (r > inner && r < DISK_OUTER_RADIUS) {
              const f =
                flux[Math.round(((r - inner) / (DISK_OUTER_RADIUS - inner)) * (flux.length - 1))];
              disk = Math.max(disk, (DISK_PEAK_FLUX * f * diskShift(ray, r, spin) ** 4) / peak);
              break;
            }
            if (r > horizonOverM(spin) * 1.08 && r < inner) {
              const g = plungeShift(ray, r, ray.ud + (next.ud - ray.ud) * t, spin, inner);
              plunge = Math.max(plunge, PLUNGE_GLOW * g ** 4);
            }
          }
          ray = next;
        }
      }
    assert.ok(plunge > 0 && plunge < 0.1 * disk, `a=${spin}: plunge ${plunge} vs disk ${disk}`);
  }
});

test("the closest camera is still a hovering observer outside the horizon", () => {
  for (const spin of [0, 0.5, 0.94, 0.998, -0.998]) {
    const d = cameraFloor(spin);
    // On the equator, Boyer–Lindquist r is smallest for a given distance.
    const { r, mu } = blRadius([d, 0, 0], spin);
    assert.ok(r > horizonOverM(spin) + 0.29);
    assert.ok(kerrMetric(r, mu, spin).alpha > 0);
  }
});

test("guide sketches occlude by the shadow and follow Kerr frame dragging", () => {
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

test("with gravity off, rays run straight to the disk point they aim at or out to the sky", () => {
  const sub = (p, q) => p.map((v, i) => v - q[i]);
  for (const spin of [0, 0.94, -0.9]) {
    const rh = horizonOverM(spin);
    for (const cam of [camera(28, 0.3), camera(8, 1.0), camera(480, 0.05)]) {
      const d = Math.hypot(...cam.pos);
      for (let i = 0; i < 60; i++) {
        const k = ((i % 10) + 1) / 10;
        const dir = pixel(cam, (k * Math.cos(i * 2.4) * 8) / d, (k * Math.sin(i * 2.4) * 8) / d);
        const b = dir.reduce((sum, v, j) => sum + v * cam.pos[j], 0);
        const meetsBall = b < 0 && d * d - b * b < rh * rh;
        const ray = traceFlatRay(cam.pos, dir, spin, { budget: BLACK_HOLE_QUALITY.economy.steps });
        assert.equal(
          ray.outcome,
          meetsBall ? "captured" : "escaped",
          `a=${spin} d=${d} pixel ${i}`,
        );
        if (meetsBall) continue;
        // Escaped from the initial line, moving outward along the initial direction.
        const along = sub(ray.position, cam.pos);
        const t = Math.hypot(...along);
        if (t > 0) along.forEach((v, j) => close(v / t, dir[j], 1e-9));
        assert.ok(Math.hypot(...ray.position) >= 48 - 1e-6 || t === 0);
      }
      // A ray aimed at an equatorial point crosses the disk plane exactly there.
      for (const rho of [iscoOverM(spin) * 1.1, 6, 11, 15]) {
        for (const phi of [0.3, 2.1, 4.4]) {
          const w = Math.hypot(rho, spin);
          const target = [w * Math.cos(phi), 0, w * Math.sin(phi)];
          const toward = sub(target, cam.pos);
          const dir = toward.map((v) => v / Math.hypot(...toward));
          const ray = traceFlatRay(cam.pos, dir, spin);
          if (ray.outcome === "captured" && Number.isNaN(ray.crossing)) continue; // behind the ball
          close(ray.crossing, rho, 1e-9);
        }
      }
    }
  }
  // Disk light keeps only the special-relativistic Doppler shift.
  const hit = [6, 0, 0];
  const v = 6 / (6 * Math.sqrt(6)); // Ω r, moving along +z
  close(flatDiskShift(hit, [0, -1, 0], 6, 0).g, Math.sqrt(1 - v * v));
  const toward = flatDiskShift(hit, [0, 0, -1], 6, 0).g;
  const away = flatDiskShift(hit, [0, 0, 1], 6, 0).g;
  close(toward * away, 1);
  assert.ok(toward > 1);
});

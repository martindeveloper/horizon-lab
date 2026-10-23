/**
 * Point clouds for the Milky Way map, in light-years. Scene +Y is the north
 * galactic pole, the Sun sits on +X today and the disk turns from +X toward +Z
 * (clockwise from the north), so galactocentric azimuth β grows toward +Z.
 *
 * Today's Galaxy follows the measured structure where it is known and labels the
 * rest a sketch: an exponential thin and thick disk (`THIN_DISK_KPC`, `THICK_DISK_KPC`), a boxy/peanut bulge inside a long bar at 28°,
 * four logarithmic arms at the ~13° mean pitch of multi-tracer studies, anchored to
 * the maser distances of the arms crossing the Sun–centre line, the Local Arm just
 * outside the Sun, dust on the arms' inner edges, the outer warp and a sparse
 * stellar halo. The far side of the disk is extrapolated, as in every map of it.
 */
import { Color } from "three";

import { gaussian, lcg, onSphere } from "@horizon/toolkit/math";
import { createPointWriter, type PointWriter } from "@horizon/toolkit/scene";

import { galacticWarp, spiralArm } from "../model/equations";
import { BAR_ANGLE } from "../model/galactic-orbit";
import {
  ARM_CROSSINGS_KPC,
  ARM_PITCH_DEG,
  ARM_START_KPC,
  KPC_LY,
  REID_R0_KPC,
  SUN_GALACTIC_RADIUS_LY,
  THICK_DISK_KPC,
  THIN_DISK_KPC,
  WARP_START_KPC,
} from "../model/parameters";

const KPC = KPC_LY;
/** The bar's half-length (see `parameters.ts`). */
const ARM_START = ARM_START_KPC * KPC;
const ARM_END = 16 * KPC;
/** Azimuth of an arm at radius R: ln(R / R_k) = −β tan ψ, crossing the Sun–centre line at R_k. */
const armBeta = (crossing: number, R: number) =>
  spiralArm.compute({ R: R / KPC, Rk: crossing / KPC });
/**
 * Scutum–Centaurus, Sagittarius–Carina, Perseus and the Outer arm cross the Sun–centre
 * line where Reid et al. (2019) put them, at the same distance from the Sun. Each starts
 * at azimuth bar angle + k · 90°, so the first and third leave the bar ends, at 3.8–4.9 kpc
 * (bar half-length 3.5–5 kpc). Those two hold most of the old stars (Churchwell et al.
 * 2009); young stars trace all four.
 */
const ARMS = ARM_CROSSINGS_KPC.map((reid, k) => {
  const crossing = SUN_GALACTIC_RADIUS_LY + (reid - REID_R0_KPC) * KPC;
  const start = BAR_ANGLE + (k * Math.PI) / 2;
  return {
    crossing,
    /* Where the arm reaches its starting azimuth: R = R_k e^(−β₀ tan ψ). */
    inner: crossing * Math.exp(-start * Math.tan((ARM_PITCH_DEG * Math.PI) / 180)),
    old: k % 2 === 0 ? 0.34 : 0.16,
  };
});
/** The Local (Orion) Arm: a short arm about 0.3 kpc outside the Sun, pitch ~11°. */
const LOCAL = { r: SUN_GALACTIC_RADIUS_LY + 0.3 * KPC, pitch: Math.tan((11.4 * Math.PI) / 180) };
const WARP_START = WARP_START_KPC * KPC;

type Rnd = () => number;
/** Two-sided exponential: the vertical profile of a disk with scale height h. */
const laplace = (rnd: Rnd, h: number) => {
  const u = Math.max(1e-6, rnd());
  return (rnd() < 0.5 ? -1 : 1) * -h * Math.log(u);
};
/** Outer disk: the warp bends it north toward the direction of rotation, and it flares. */
const warp = (R: number, beta: number) =>
  R > WARP_START ? galacticWarp.compute({ R: R / KPC, beta }) * KPC : 0;
const flare = (R: number) => 1 + Math.max(0, R - 9 * KPC) / (6 * KPC);

/** The modern Milky Way: stars (additive) and dust (drawn over them) as two clouds. */
export function modernGalaxy(count: number) {
  const rnd = lcg(11);
  const gauss = () => gaussian(rnd);
  const stars = createPointWriter(count);
  const dustCount = Math.round(count * 0.32);
  const dust = createPointWriter(dustCount);
  const old = new Color("#ffd49c");
  const bone = new Color("#f3eee4");
  const young = new Color("#a9c3ff");
  const hii = new Color("#ff8db4");
  const soot = new Color("#140d09");
  const cosBar = Math.cos(BAR_ANGLE);
  const sinBar = Math.sin(BAR_ANGLE);

  /* Bar frame (along, across, up) → scene. */
  const bar = (a: number, b: number, y: number, c: Color, brightness: number) =>
    stars.put(a * cosBar - b * sinBar, y, a * sinBar + b * cosBar, c, brightness);
  /* Disk point at radius R and azimuth β, lifted by the warp. */
  const disk = (w: PointWriter, R: number, beta: number, y: number, c: Color, brightness: number) =>
    w.put(R * Math.cos(beta), y + warp(R, beta), R * Math.sin(beta), c, brightness);
  /* Along an arm: distance from its inner end falls off exponentially. */
  const exponentialR = (scale: number, min: number, max: number) => {
    for (;;) {
      const R = -scale * Math.log(Math.max(1e-6, rnd()));
      if (R >= min && R <= max) return R;
    }
  };
  /* Exponential disk: surface density Σ ∝ e^(−R/h), so radii follow R e^(−R/h) (a Gamma(2) draw). */
  const diskR = (scale: number, min: number, max: number) => {
    for (;;) {
      const R = -scale * Math.log(Math.max(1e-12, rnd() * rnd()));
      if (R >= min && R <= max) return R;
    }
  };

  const budget = (share: number) => Math.round(count * share);
  /* Nuclear star cluster and disk around Sgr A*. */
  for (let i = budget(0.012); i > 0; i -= 1)
    bar(gauss() * 0.12 * KPC, gauss() * 0.12 * KPC, gauss() * 0.05 * KPC, bone, 1.1);
  /* Boxy/peanut bulge: thicker away from the centre, the X shape seen edge-on. */
  for (let i = budget(0.15); i > 0; i -= 1) {
    const a = gauss() * 1.25 * KPC;
    const b = gauss() * 0.5 * KPC;
    const y = gauss() * (0.28 * KPC + 0.18 * Math.abs(a));
    bar(a, b, y, old, 0.55 + 0.45 * Math.exp(-Math.hypot(a, b) / (1.4 * KPC)) + rnd() * 0.3);
  }
  /* The thin long bar reaching the arms. */
  for (let i = budget(0.05); i > 0; i -= 1)
    bar(
      (rnd() * 2 - 1) * ARM_START,
      gauss() * 0.28 * KPC,
      gauss() * 0.16 * KPC,
      old,
      0.5 + rnd() * 0.35,
    );
  /* Smooth thin disk, thinned inside the bar where the bar has swept it. */
  for (let i = budget(0.3); i > 0; i -= 1) {
    const R = diskR(THIN_DISK_KPC.length * KPC, 1.2 * KPC, 18 * KPC);
    if (R < 3 * KPC && rnd() < 0.6) {
      i += 1;
      continue;
    }
    const tint = rnd() < 0.55 ? old : bone;
    disk(
      stars,
      R,
      rnd() * Math.PI * 2,
      laplace(rnd, THIN_DISK_KPC.height * KPC * flare(R)),
      tint,
      0.3 + rnd() * 0.45,
    );
  }
  /* Thick disk: older, shorter and puffier. */
  for (let i = budget(0.06); i > 0; i -= 1) {
    const R = diskR(THICK_DISK_KPC.length * KPC, 0.8 * KPC, 15 * KPC);
    const z = laplace(rnd, THICK_DISK_KPC.height * KPC);
    disk(stars, R, rnd() * Math.PI * 2, z, old, 0.22 + rnd() * 0.3);
  }
  /* Arms: old stars mostly in the two bar-end arms, young stars and H II regions in all four. */
  const armPoint = (spread: number, h: number, inner = 0) => {
    const arm = ARMS[Math.min(3, Math.floor(rnd() * 4))]!;
    const R = arm.inner + exponentialR(3.4 * KPC, 0, ARM_END - arm.inner);
    const width = (0.1 + 0.035 * (R / KPC)) * KPC * spread;
    return {
      R: Math.max(arm.inner * 0.9, R + (gauss() - inner) * width),
      beta: armBeta(arm.crossing, R) + gauss() * 0.02,
      y: laplace(rnd, h * flare(R)),
    };
  };
  for (let i = budget(0.08); i > 0; i -= 1) {
    let u = rnd();
    let arm = ARMS[0];
    for (const candidate of ARMS) {
      u -= candidate.old;
      if (u < 0) {
        arm = candidate;
        break;
      }
    }
    if (arm === undefined) {
      continue;
    }
    const R = arm.inner + exponentialR(3 * KPC, 0, ARM_END - arm.inner);
    const width = (0.25 + 0.04 * (R / KPC)) * KPC;
    disk(
      stars,
      R + gauss() * width,
      armBeta(arm.crossing, R),
      laplace(rnd, 0.22 * KPC * flare(R)),
      old,
      0.35 + rnd() * 0.35,
    );
  }
  for (let i = budget(0.23); i > 0; i -= 1) {
    const p = armPoint(1, 0.08 * KPC);
    disk(stars, p.R, p.beta, p.y, rnd() < 0.8 ? young : bone, 0.45 + rnd() * 0.6);
  }
  /* The Local Arm, a short spur the Sun sits just inside. */
  for (let i = budget(0.025); i > 0; i -= 1) {
    const beta = -0.5 + rnd() * 1.2;
    const R = LOCAL.r * Math.exp(-beta * LOCAL.pitch) + gauss() * 0.22 * KPC;
    disk(stars, R, beta, laplace(rnd, 0.08 * KPC), young, 0.35 + rnd() * 0.45);
  }
  /* H II regions: small pink clumps of ionised gas along the arms. */
  for (let i = budget(0.03); i > 0;) {
    const p = armPoint(0.6, 0.05 * KPC);
    for (let k = 0; k < 6 && i > 0; k += 1, i -= 1)
      disk(
        stars,
        p.R + gauss() * 0.05 * KPC,
        p.beta + (gauss() * 0.05 * KPC) / p.R,
        p.y + gauss() * 0.02 * KPC,
        hii,
        0.55 + rnd() * 0.5,
      );
  }
  /* Stellar halo: sparse, slightly flattened, n(r) ∝ r^-3.5 between 1 and 40 kpc. */
  for (let i = budget(0.022); i > 0; i -= 1) {
    const r = KPC / (1 - rnd() * (1 - 1 / Math.sqrt(40))) ** 2;
    const p = onSphere(rnd, r);
    /* The pole of the direction is the galactic pole, y. */
    stars.put(p[0], p[2] * 0.7, p[1], old, 0.25);
  }
  /* Dust lanes sit on the inner, concave edge of each arm, and in a thin layer. */
  while (dust.count < dustCount) {
    const p = armPoint(0.7, 0.05 * KPC, 0.9);
    disk(dust, p.R, p.beta, p.y, soot, 1);
  }

  return { stars: stars.geometry(), dust: dust.geometry() };
}

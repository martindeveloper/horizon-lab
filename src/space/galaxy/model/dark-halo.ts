import type { Facts } from "@/lib/facts";
import { smootherstep } from "@horizon/toolkit/math";
import { CONSTANTS, PLANCK_2018, convert } from "@horizon/toolkit/science";

/**
 * Reviewed 2026-10-22. Feng et al. 2026, MNRAS stag011, Table 2, Mean column.
 * These are INFERRED dark-matter constraints, not individual particle measurements.
 * Reconstruct a spherical NFW profile from the rounded published central values of
 * rho(R_sun) and M_DM(<18 kpc). This is our derived display model, not the authors'
 * posterior samples. Do not propagate the two errors independently: their covariance
 * was not published here. In particular, the continuation beyond 18 kpc is an
 * extrapolation, not a new measurement of the Galaxy's total mass.
 *
 * Update these inputs, sources and caveats together when adopting a newer fit.
 * Brooks et al. 2026 (stag926) and Dado et al. 2026 (stag1865) motivate the
 * explicit outer-halo/LMC and baryonic-model caveats in the UI and README.
 */
export const HALO_INPUTS = {
  localDensity: {
    value: 0.36,
    range: [0.32, 0.4],
    unit: "ratio",
    digits: 2,
    source: "feng2026",
    status: "verified",
    note: "GeV/c²/cm³; Table 2 Mean. Inferred under the adopted baryonic/NFW models.",
  },
  enclosedMass: {
    value: 1.32e11,
    range: [1.17e11, 1.47e11],
    unit: "Msun",
    digits: 3,
    source: "feng2026",
    status: "verified",
    note: "Dark matter within 18 kpc; Table 2 Mean, not total Galactic mass.",
  },
  constraintRadius: { value: 18, unit: "kpc", source: "feng2026", status: "verified" },
  solarRadius: { value: 8.275, unit: "kpc", source: "feng2026", status: "verified" },
  overdensity: {
    value: 200,
    unit: "ratio",
    source: "navarro1997",
    status: "teaching-choice",
    note: "Mean density of the NFW dark component relative to critical; excludes baryons.",
  },
} as const satisfies Facts;

/** NFW integral: M(<r) = 4π rho_s r_s³ [ln(1+x) − x/(1+x)]. */
export const nfwIntegral = (x: number) => Math.log1p(x) - x / (1 + x);
const kpcM = convert(1, "kpc", "m");
const solarKg = convert(1, "Msun", "kg");
// GeV/c²/cm³ -> M_sun/kpc³, using the toolkit's SI constants, not a rounded conversion.
const densityUnit =
  (((1e9 * CONSTANTS.elementaryCharge.value) / CONSTANTS.speedOfLight.value ** 2) *
    1e6 *
    kpcM ** 3) /
  solarKg;
const localDensity = HALO_INPUTS.localDensity.value * densityUnit;

function profileAtScale(rs: number) {
  const x = HALO_INPUTS.solarRadius.value / rs;
  return { rs, rho: localDensity * x * (1 + x) ** 2 };
}
export type HaloProfile = { rs: number; rho: number };
export function haloMass(rKpc: number, profile: HaloProfile) {
  return 4 * Math.PI * profile.rho * profile.rs ** 3 * nfwIntegral(rKpc / profile.rs);
}
export function haloDensity(rKpc: number, profile: HaloProfile) {
  const x = rKpc / profile.rs;
  return profile.rho / (x * (1 + x) ** 2);
}

function fitProfile(): HaloProfile {
  // Rounded constraints permit two branches. Deliberate display choice: the extended
  // branch r_s >= R_sun. This is NOT a unique fit or a replacement for the posterior.
  let lo: number = HALO_INPUTS.solarRadius.value;
  let hi = 200;
  for (let i = 0; i < 80; i++) {
    const mid = Math.sqrt(lo * hi);
    if (
      haloMass(HALO_INPUTS.constraintRadius.value, profileAtScale(mid)) >
      HALO_INPUTS.enclosedMass.value
    )
      hi = mid;
    else lo = mid;
  }
  return profileAtScale(Math.sqrt(lo * hi));
}
export const DARK_HALO = fitProfile();
const h0 = convert(PLANCK_2018.H0, "km/s/Mpc", "Hz");
export const CRITICAL_DENSITY =
  (((3 * h0 ** 2) / (8 * Math.PI * CONSTANTS.gravitationalConstant.value)) * kpcM ** 3) / solarKg;
function densityRadius() {
  let lo = DARK_HALO.rs;
  let hi = 2000;
  for (let i = 0; i < 80; i++) {
    const r = (lo + hi) / 2;
    const mean = haloMass(r, DARK_HALO) / (((4 * Math.PI) / 3) * r ** 3);
    if (mean > HALO_INPUTS.overdensity.value * CRITICAL_DENSITY) lo = r;
    else hi = r;
  }
  return (lo + hi) / 2;
}
/** R200 of this extrapolated dark component. Not the edge, or a total-mass measurement. */
export const HALO_R200_KPC = densityRadius();
/** Render cutoff only: the overlay fades before here; this is not a physical truncation. */
export const HALO_DRAW_RADIUS_KPC = 2 * HALO_R200_KPC;
/** Camera framing choice: leaves room for the optional density-radius circle. */
export const HALO_FRAME_LY = convert(3 * HALO_R200_KPC, "kpc", "ly");
/** Display handoff shared by the renderer, evidence label and selection lifetime. */
export const haloVisibility = (distanceLy: number) =>
  smootherstep((distanceLy - 15_000) / 60_000) *
  (1 - smootherstep((distanceLy - HALO_FRAME_LY) / HALO_FRAME_LY));

export const HALO_FACTS = {
  ...HALO_INPUTS,
  r200: {
    value: HALO_R200_KPC,
    unit: "kpc",
    show: "kpc",
    digits: 2,
    source: "feng2026",
    sources: ["planck2018", "navarro1997"],
    status: "derived",
    note: "Extrapolated spherical NFW dark-component mean density = 200 rho_crit; baryons excluded. Not a measured halo edge.",
  },
  width: {
    value: convert(2 * HALO_R200_KPC, "kpc", "Mly"),
    unit: "Mly",
    digits: 2,
    source: "feng2026",
    status: "derived",
    note: "Twice the same density radius the renderer uses.",
  },
  scaleRadius: {
    value: DARK_HALO.rs,
    unit: "kpc",
    digits: 2,
    source: "feng2026",
    status: "derived",
    note: "Extended NFW branch r_s >= R_sun, solved from rounded mean density/mass; not unique or a posterior median.",
  },
} as const satisfies Facts;

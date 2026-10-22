import type { Facts } from "@/lib/facts";
import { PLANCK_2018, cosmicAgeAtRedshiftGyr } from "@horizon/toolkit/science";

export const DARK_VIEWS = ["halo", "lensing", "expansion"] as const;
export type DarkView = (typeof DARK_VIEWS)[number];

/**
 * Observation/update ledger, reviewed 2026-10-22. Keep the existing Planck+BAO
 * distance cosmology consistent across the atlas. DESI DR2 IV is the latest
 * checked expansion anchor, NOT a new fit to use silently as our cosmology.
 * Its v3 has no journal reference at review: retain the preprint callout until
 * publication is verified. The two quoted errors are marginal, correlated;
 * do not manufacture a joint ellipse or a w0/wa posterior from these alone.
 */
export const EXPANSION_FACTS = {
  redshift: { value: 2.33, unit: "ratio", source: "desiExpansion2026", status: "verified" },
  radial: {
    value: 8.6,
    range: [8.534, 8.666],
    digits: 4,
    unit: "ratio",
    source: "desiExpansion2026",
    status: "verified",
    note: "D_H/r_d at z_eff=2.33; DESI DR2 IV v3 abstract. Inferred from AP+BAO, marginal error.",
  },
  transverse: {
    value: 39.32,
    range: [38.99, 39.65],
    digits: 4,
    unit: "ratio",
    source: "desiExpansion2026",
    status: "verified",
    note: "D_M/r_d at z_eff=2.33; correlated with D_H/r_d.",
  },
} as const satisfies Facts;

export const DARK_SOURCE_STATUS = {
  feng2026: "published",
  brooks2026: "published",
  dado2026: "published",
  cosmosWeb2026: "published",
  planck2018: "published",
  desiExpansion2026: "preprint",
} as const;

/** Past-to-present FLRW background. Bound galaxies are not scaled or moved. */
export function expansionAt(a: number) {
  if (!(a > 0) || !Number.isFinite(a))
    throw new RangeError("Scale factor must be finite and positive");
  const { H0, omegaM, omegaR } = PLANCK_2018;
  const omegaL = 1 - omegaM - omegaR;
  const matter = omegaM / a ** 3;
  const radiation = omegaR / a ** 4;
  const total = matter + radiation + omegaL;
  const z = 1 / a - 1;
  return {
    a,
    z,
    age: cosmicAgeAtRedshiftGyr(z, PLANCK_2018),
    hubble: H0 * Math.sqrt(total),
    matter: matter / total,
    darkEnergy: omegaL / total,
    radiation: radiation / total,
    // Negative q means accelerated expansion; H can still decrease.
    deceleration: (matter / 2 + radiation - omegaL) / total,
  };
}
export const EXPANSION_DOMAIN = { min: 0.25, max: 1 } as const;
export const EXPANSION_CURVE = Array.from({ length: 81 }, (_, i) =>
  expansionAt(EXPANSION_DOMAIN.min + ((EXPANSION_DOMAIN.max - EXPANSION_DOMAIN.min) * i) / 80),
);

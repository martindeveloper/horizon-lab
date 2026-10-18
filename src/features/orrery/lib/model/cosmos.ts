/**
 * Beyond the Milky Way: the Local Group, the Virgo Cluster, the Virgo (Local) Supercluster
 * and Laniakea, and how they change over the timeline. Lengths are in millions of
 * light-years (Mly), in the Galaxy model's axes (+X from the galactic centre to the Sun,
 * +Y the north galactic pole, +Z toward galactic longitude 90°), with the galactic centre at
 * the origin.
 *
 * Named galaxies and clusters sit at their measured directions and distances; the rest is
 * a sketch shaped like each structure. Time is a teaching model on top:
 *
 * - expansion: everything not bound to the Local Group or to its own cluster keeps its
 *   comoving place, so its distance scales with the cosmic scale factor a(t) of flat ΛCDM;
 * - the Local Group: the Milky Way and Andromeda follow the radial timing-argument orbit
 *   that today's separation, closing speed and the age of the Universe imply;
 * - clusters keep their size but gather their members as the timeline nears today.
 */
import { clamp01 } from "@horizon/toolkit/math";
import {
  PLANCK_2018,
  RAD_PER_DEG as RAD,
  convert,
  cosmicAgeGyr,
  defineEquation,
  formatNumber,
  hubbleLaw,
  scaleFactorAtAge,
} from "@horizon/toolkit/science";

import { SUN_GALACTIC_RADIUS_LY, SUN_HEIGHT_LY } from "./parameters";

/** Numbers inside printed formulas. */
const n = (value: number) => formatNumber(value, "en", 4);

/** The model's cosmology: flat ΛCDM with Planck 2018's H₀ (km/s/Mpc) and Ωm. */
export const HUBBLE = PLANCK_2018.H0;
export const OMEGA_M = PLANCK_2018.omegaM;
/** Age of the Universe today, Gyr (13.79 for these parameters). */
export const UNIVERSE_AGE_GYR = cosmicAgeGyr(1, PLANCK_2018);

/** The cosmic scale factor `t` years ago: 1 today, ~0.37 ten billion years ago. */
export const scaleFactor = defineEquation({
  id: "scale-factor",
  text: `a = (sinh(3 √Ω_Λ H₀ (t₀ − t) / 2) / √(Ω_Λ / Ω_m))^(2/3),  H₀ = ${n(HUBBLE)} km/s/Mpc, Ω_m = ${n(OMEGA_M)}`,
  latex: `a = \\left(\\frac{\\sinh\\left(\\tfrac{3}{2}\\sqrt{\\Omega_\\Lambda}\\,H_0\\,(t_0 - t)\\right)}{\\sqrt{\\Omega_\\Lambda/\\Omega_m}}\\right)^{2/3}, \\quad H_0 = ${n(HUBBLE)}\\,\\mathrm{km\\,s^{-1}\\,Mpc^{-1}}, \\ \\Omega_m = ${n(OMEGA_M)}`,
  output: "a",
  variables: {
    t: { symbol: "t", latex: "t", unit: "Gyr" },
    a: { symbol: "a", latex: "a" },
  },
  compute: ({ t }) => scaleFactorAtAge(Math.max(1e-3, UNIVERSE_AGE_GYR - t), PLANCK_2018),
});

/** One-entry memo: a frame asks for the same moment many times. */
function lastOf(fn: (x: number) => number) {
  let key = Number.NaN;
  let value = 0;
  return (x: number) => {
    if (x !== key) {
      key = x;
      value = fn(x);
    }
    return value;
  };
}

/** Scale factor `yearsAgo` years ago. */
export const scaleAt = lastOf((yearsAgo: number) =>
  scaleFactor.compute({ t: Math.max(0, yearsAgo) / 1e9 }),
);

/** Hubble-flow distance (Mly) for a recession velocity cz (km/s) at H₀. */
export const hubbleMly = (cz: number) =>
  convert(hubbleLaw.compute({ v: cz, H0: HUBBLE }), "Mpc", "Mly");

/* ---------------------------------------------------------------------------------------
 * The Milky Way and Andromeda: a radial Kepler orbit from the Big Bang (Kahn & Woltjer
 * 1959; van der Marel et al. 2012). r = A(1 − cos η), t = B(η − sin η); today's r, ṙ and
 * t₀ fix A, B and η.
 * ------------------------------------------------------------------------------------- */

/** M31's distance from the Milky Way today, Mly (765 kpc; Li et al. 2021, McConnachie 2012). */
export const ANDROMEDA_MLY = 2.5;
/**
 * M31's radial velocity toward the Milky Way's centre, km/s (van der Marel et al. 2012,
 * −109 ± 4): the measured heliocentric −300 km/s less the Sun's own galactic motion.
 */
export const ANDROMEDA_APPROACH_KMS = 110;
/** Light-years travelled in a gigayear at 1 km/s (1.0227 pc/Myr): 10⁹ ly times v/c. */
const LY_PER_KMS_GYR = 1e9 * convert(1, "km/s", "c");
/** Fraction of the way from the Milky Way to Andromeda where the Local Group's mass centre sits. */
export const ANDROMEDA_MASS_SHARE = 0.55;

/** sin η (η − sin η) / (1 − cos η)²: the dimensionless v t / r of the orbit. */
const orbitShape = (eta: number) =>
  (Math.sin(eta) * (eta - Math.sin(eta))) / (1 - Math.cos(eta)) ** 2;

const LOCAL_ORBIT = (() => {
  const vtr = (-ANDROMEDA_APPROACH_KMS * UNIVERSE_AGE_GYR * LY_PER_KMS_GYR) / (ANDROMEDA_MLY * 1e6);
  /* On the way in, η is between π and 2π, where the shape falls monotonically. */
  let lo = Math.PI + 1e-6;
  let hi = 2 * Math.PI - 1e-6;
  for (let i = 0; i < 80; i += 1) {
    const mid = (lo + hi) / 2;
    if (orbitShape(mid) > vtr) lo = mid;
    else hi = mid;
  }
  const eta = (lo + hi) / 2;
  const A = ANDROMEDA_MLY / (1 - Math.cos(eta));
  const B = UNIVERSE_AGE_GYR / (eta - Math.sin(eta));
  return { eta, A, B };
})();

/** Andromeda's distance from the Milky Way `t` years ago on the timing-argument orbit. */
export const localGroupOrbit = defineEquation({
  id: "local-group-orbit",
  text: `r = A (1 − cos η),  t₀ − t = B (η − sin η),  A = ${n(LOCAL_ORBIT.A)} Mly, B = ${n(LOCAL_ORBIT.B)} Gyr`,
  latex: `r = A\\,(1 - \\cos\\eta), \\quad t_0 - t = B\\,(\\eta - \\sin\\eta), \\quad A = ${n(LOCAL_ORBIT.A)}\\,\\mathrm{Mly}, \\ B = ${n(LOCAL_ORBIT.B)}\\,\\mathrm{Gyr}`,
  output: "r",
  variables: {
    t: { symbol: "t", latex: "t", unit: "Gyr" },
    r: { symbol: "r", latex: "r" },
  },
  compute: ({ t }) => {
    const age = clampAge(UNIVERSE_AGE_GYR - t);
    /* Solve t = B(η − sin η) for η by bisection; the function rises monotonically. */
    const goal = age / LOCAL_ORBIT.B;
    let lo = 0;
    let hi = LOCAL_ORBIT.eta;
    for (let i = 0; i < 60; i += 1) {
      const mid = (lo + hi) / 2;
      if (mid - Math.sin(mid) < goal) lo = mid;
      else hi = mid;
    }
    return LOCAL_ORBIT.A * (1 - Math.cos((lo + hi) / 2));
  },
});
const clampAge = (age: number) => Math.min(UNIVERSE_AGE_GYR, Math.max(1e-3, age));

/** Andromeda's distance (Mly) `yearsAgo` years ago; the last moment asked for is kept. */
export const andromedaApart = lastOf((yearsAgo: number) =>
  localGroupOrbit.compute({ t: Math.max(0, yearsAgo) / 1e9 }),
);
/** Largest separation on the orbit (turnaround), Mly, and when (years ago). */
export const LOCAL_TURNAROUND = {
  mly: 2 * LOCAL_ORBIT.A,
  yearsAgo: (UNIVERSE_AGE_GYR - Math.PI * LOCAL_ORBIT.B) * 1e9,
};

/**
 * How much of a cluster has gathered `yearsAgo` years ago: a teaching curve, a^1.5, close to
 * how a cluster's mass grows by infall in ΛCDM since z ≈ 2 (about a fifth 10 billion years ago).
 */
export const clusterGathered = (yearsAgo: number) => clamp01(scaleAt(yearsAgo) ** 1.5);

/* ---------------------------------------------------------------------------------------
 * Directions. Galactic (l, b) → Galaxy-model axes; the supergalactic frame of de
 * Vaucouleurs (pole at l = 47.37°, b = +6.32°; SGL = 0 at l = 137.37°, b = 0°).
 * ------------------------------------------------------------------------------------- */

export type Vec = [number, number, number];

/** Unit vector toward galactic (l, b), in degrees, in Galaxy-model axes. */
export function galacticDirection(l: number, b: number): Vec {
  const cb = Math.cos(b * RAD);
  return [-cb * Math.cos(l * RAD), Math.sin(b * RAD), cb * Math.sin(l * RAD)];
}

const cross = (a: Vec, b: Vec): Vec => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

/** Supergalactic axes in Galaxy-model axes: SGX, SGY, SGZ (the pole). */
export const SUPERGALACTIC = (() => {
  const x = galacticDirection(137.37, 0);
  const z = galacticDirection(47.37, 6.32);
  return { x, y: cross(z, x), z };
})();

/** A supergalactic Cartesian vector in Galaxy-model axes. */
export function fromSupergalactic(x: number, y: number, z: number): Vec {
  const { x: X, y: Y, z: Z } = SUPERGALACTIC;
  return [
    X[0] * x + Y[0] * y + Z[0] * z,
    X[1] * x + Y[1] * y + Z[1] * z,
    X[2] * x + Y[2] * y + Z[2] * z,
  ];
}

/** Supergalactic latitude (degrees) of a Galaxy-model direction. */
export function supergalacticLatitude(v: Vec) {
  const { z } = SUPERGALACTIC;
  const len = Math.hypot(v[0], v[1], v[2]) || 1;
  return Math.asin((v[0] * z[0] + v[1] * z[1] + v[2] * z[2]) / len) / RAD;
}

/** Andromeda's direction from the Sun. */
const ANDROMEDA_DIRECTION = galacticDirection(121.17, -21.57);

/** The Sun in Galaxy-model axes, Mly from the galactic centre. */
const SUN_MLY: Vec = [SUN_GALACTIC_RADIUS_LY / 1e6, SUN_HEIGHT_LY / 1e6, 0];

/** A heliocentric distance (Mly) toward (l, b), from the galactic centre. */
export function place(l: number, b: number, mly: number): Vec {
  const d = galacticDirection(l, b);
  return [SUN_MLY[0] + d[0] * mly, SUN_MLY[1] + d[1] * mly, SUN_MLY[2] + d[2] * mly];
}

/* ---------------------------------------------------------------------------------------
 * Named anchors. Distances are rounded literature values; see docs/science-sources.md.
 * ------------------------------------------------------------------------------------- */

/** How an anchor moves over time: bound to us, riding on Andromeda, or with the expansion. */
export type Tie = "local" | "andromeda" | "flow";

export type AnchorId =
  | "andromeda"
  | "triangulum"
  | "lmc"
  | "smc"
  | "m81"
  | "centaurusA"
  | "sculptor"
  | "virgoCluster"
  | "fornaxCluster"
  | "centaurusCluster"
  | "hydraCluster"
  | "greatAttractor";

export type Anchor = {
  id: AnchorId;
  /** Galactic longitude and latitude, degrees. */
  l: number;
  b: number;
  /** Heliocentric distance today, Mly. */
  mly: number;
  tie: Tie;
};

export const ANCHORS: readonly Anchor[] = [
  { id: "andromeda", l: 121.17, b: -21.57, mly: ANDROMEDA_MLY, tie: "andromeda" },
  { id: "triangulum", l: 133.61, b: -31.33, mly: 2.73, tie: "andromeda" },
  { id: "lmc", l: 280.47, b: -32.89, mly: 0.163, tie: "local" },
  { id: "smc", l: 302.81, b: -44.33, mly: 0.203, tie: "local" },
  { id: "m81", l: 142.09, b: 40.9, mly: 11.7, tie: "flow" },
  { id: "centaurusA", l: 309.52, b: 19.42, mly: 12.4, tie: "flow" },
  { id: "sculptor", l: 97.37, b: -87.96, mly: 11.4, tie: "flow" },
  /* The Virgo Cluster's centre, M87: 16.5 Mpc (Mei et al. 2007). */
  { id: "virgoCluster", l: 283.78, b: 74.49, mly: convert(16.5, "Mpc", "Mly"), tie: "flow" },
  /* NGC 1399, 20.0 Mpc (Blakeslee et al. 2009). */
  { id: "fornaxCluster", l: 236.72, b: -53.64, mly: convert(20, "Mpc", "Mly"), tie: "flow" },
  /* Abell 3526 and Abell 1060 (cz 3,683, Christlein & Zabludoff 2003): Hubble-flow distances
     at the model's own H₀. */
  { id: "centaurusCluster", l: 302.4, b: 21.56, mly: hubbleMly(3_418), tie: "flow" },
  { id: "hydraCluster", l: 269.63, b: 26.51, mly: hubbleMly(3_683), tie: "flow" },
  /* The Great Attractor toward the Norma Cluster (Abell 3627): ~77 Mpc at h = 0.68. */
  { id: "greatAttractor", l: 325.33, b: -7.26, mly: 250, tie: "flow" },
];

const BY_ID = new Map(ANCHORS.map((a) => [a.id, a]));
export const anchorById = (id: AnchorId) => BY_ID.get(id)!;

/** Label keys the cosmic map places (scene/cosmos-layer.ts); their text is `names.<key>`. */
export const COSMOS_LABELS = [
  "milkyway",
  "andromeda",
  "triangulum",
  "localGroup",
  "localSheet",
  "virgoCluster",
  "fornaxCluster",
  "virgoSupercluster",
  "centaurusCluster",
  "hydraCluster",
  "greatAttractor",
  "laniakea",
] as const;

/* Fixed for the session: each anchor's place today. */
const TODAY = new Map<Anchor, Vec>(ANCHORS.map((a) => [a, place(a.l, a.b, a.mly)]));

/** Today's position of an anchor, Mly from the galactic centre. Shared: do not modify. */
export const anchorToday = (a: Anchor): Readonly<Vec> => TODAY.get(a)!;

/** Today's diameter of each structure (Mly), from the published size in its own unit. */
export const STRUCTURES = {
  /** Diameter ~3 Mpc; McConnachie 2012. */
  localGroup: { width: convert(3, "Mpc", "Mly") },
  /**
   * Tully et al. 2008: a 7 Mpc radius about us, ±1.5 Mpc about the supergalactic equator;
   * random motions ~40 km/s; the sheet moves 259 km/s away from the Local Void.
   */
  localSheet: { width: convert(2 * 7, "Mpc", "Mly"), thickness: convert(2 * 1.5, "Mpc", "Mly") },
  /** r₂₀₀ = 1.55 Mpc at 15 Mpc (McLaughlin 1999, ApJ 512, L9): twice that across. */
  virgo: { width: convert(2 * 1.55, "Mpc", "Mly") },
  /** De Vaucouleurs' Local Supercluster, ~33 Mpc across. */
  supercluster: { width: convert(33, "Mpc", "Mly") },
  /** Tully et al. 2014: 160 Mpc across, 10¹⁷ solar masses, ~100,000 galaxies. */
  laniakea: { width: convert(160, "Mpc", "Mly") },
} as const;

/** Where the Local Group's mass centre is `yearsAgo` years ago, Mly from the galactic centre. */
export function localGroupCentre(yearsAgo: number, out: Vec = [0, 0, 0]): Vec {
  const d = ANDROMEDA_DIRECTION;
  const r = andromedaApart(yearsAgo) * ANDROMEDA_MASS_SHARE;
  out[0] = d[0] * r;
  out[1] = d[1] * r;
  out[2] = d[2] * r;
  return out;
}

/** An anchor's position `yearsAgo` years ago, Mly from the galactic centre. */
export function anchorAt(a: Anchor, yearsAgo: number, out: Vec = [0, 0, 0]): Vec {
  const today = anchorToday(a);
  if (a.tie === "local") {
    out[0] = today[0];
    out[1] = today[1];
    out[2] = today[2];
    return out;
  }
  if (a.tie === "andromeda") {
    /* Satellites ride with Andromeda: shift by its change along the line of sight. */
    const d = ANDROMEDA_DIRECTION;
    const shift = andromedaApart(yearsAgo) - ANDROMEDA_MLY;
    out[0] = today[0] + d[0] * shift;
    out[1] = today[1] + d[1] * shift;
    out[2] = today[2] + d[2] * shift;
    return out;
  }
  const s = scaleAt(yearsAgo);
  out[0] = today[0] * s;
  out[1] = today[1] * s;
  out[2] = today[2] * s;
  return out;
}

/* ---------------------------------------------------------------------------------------
 * Camera aims: as the camera pulls out, the point it turns about moves from the galactic
 * centre to each structure's heart, in log distance between the framed views.
 * ------------------------------------------------------------------------------------- */

type AimStop = { ly: number; at: (yearsAgo: number, out: Vec) => Vec };

const zero = (_: number, out: Vec) => {
  out[0] = out[1] = out[2] = 0;
  return out;
};
const towardVirgo = (share: number) => (yearsAgo: number, out: Vec) => {
  anchorAt(anchorById("virgoCluster"), yearsAgo, out);
  out[0] *= share;
  out[1] *= share;
  out[2] *= share;
  return out;
};

/** Camera distances (ly) of the framed views beyond the Galaxy. */
export const COSMIC_VIEW_LY = {
  localGroup: 6.5e6,
  sheet: 32e6,
  virgo: 68e6,
  supercluster: 175e6,
  laniakea: 760e6,
} as const;

const AIM_STOPS: readonly AimStop[] = [
  { ly: 300_000, at: zero },
  { ly: COSMIC_VIEW_LY.localGroup, at: localGroupCentre },
  /* Pull straight back over our own sheet before the frame turns toward Virgo. */
  { ly: COSMIC_VIEW_LY.sheet, at: localGroupCentre },
  { ly: COSMIC_VIEW_LY.virgo, at: towardVirgo(0.55) },
  { ly: COSMIC_VIEW_LY.supercluster, at: towardVirgo(0.8) },
  {
    ly: COSMIC_VIEW_LY.laniakea,
    at: (yearsAgo, out) => anchorAt(anchorById("greatAttractor"), yearsAgo, out),
  },
];

const stopA: Vec = [0, 0, 0];
const stopB: Vec = [0, 0, 0];
const ease = (t: number) => t * t * t * (t * (6 * t - 15) + 10);

/** The camera's turning point (Mly from the galactic centre) at a camera distance in ly. */
export function cosmicAim(ly: number, yearsAgo: number, out: Vec = [0, 0, 0]): Vec {
  if (ly <= AIM_STOPS[0]!.ly) return zero(yearsAgo, out);
  for (let i = 1; i < AIM_STOPS.length; i += 1) {
    const to = AIM_STOPS[i]!;
    if (ly > to.ly && i < AIM_STOPS.length - 1) continue;
    const from = AIM_STOPS[i - 1]!;
    const k = ease(clamp01(Math.log(ly / from.ly) / Math.log(to.ly / from.ly)));
    from.at(yearsAgo, stopA);
    to.at(yearsAgo, stopB);
    out[0] = stopA[0] + (stopB[0] - stopA[0]) * k;
    out[1] = stopA[1] + (stopB[1] - stopA[1]) * k;
    out[2] = stopA[2] + (stopB[2] - stopA[2]) * k;
    return out;
  }
  return out;
}

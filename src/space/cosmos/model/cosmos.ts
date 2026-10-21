/**
 * Beyond the Milky Way: the Local Group, the Virgo Cluster, the Virgo (Local) Supercluster,
 * Laniakea and the cosmic web around it out to the Sloan Great Wall, and the observable
 * universe, as they are today. Lengths are in millions of light-years (Mly), in the Galaxy
 * model's axes (+X from the galactic centre to the Sun, +Y the north galactic pole, +Z toward
 * galactic longitude 90°), with the galactic centre at the origin.
 *
 * Named galaxies and clusters sit at their measured directions and distances (comoving ones
 * from their redshifts, in flat ΛCDM); the rest is a sketch shaped like each structure.
 */
import { SUN_GALACTIC_RADIUS_LY, SUN_HEIGHT_LY } from "@/space/galaxy/model/parameters";
import type { Vec3 } from "@horizon/toolkit/bodies";
import { clamp01 } from "@horizon/toolkit/math";
import {
  PLANCK_2018,
  RAD_PER_DEG as RAD,
  comovingDistanceMpc,
  convert,
  cosmicAgeAtRedshiftGyr,
  defineEquation,
  equatorialToGalactic,
  formatNumber,
  hubbleLaw,
  particleHorizonMpc,
  redshiftAtLookback,
} from "@horizon/toolkit/science";

/** Numbers inside printed formulas. */
const n = (value: number) => formatNumber(value, "en", 4);

/** The model's cosmology: flat ΛCDM with Planck 2018's H₀ (km/s/Mpc) and Ωm. */
export const HUBBLE = PLANCK_2018.H0;
export const OMEGA_M = PLANCK_2018.omegaM;
/** Age of the Universe today, Gyr (13.787 for these parameters, radiation included). */
export const UNIVERSE_AGE_GYR = cosmicAgeAtRedshiftGyr(0, PLANCK_2018);

/** Hubble-flow distance (Mly) for a recession velocity cz (km/s) at H₀. */
const hubbleMly = (cz: number) => convert(hubbleLaw.compute({ v: cz, H0: HUBBLE }), "Mpc", "Mly");

/**
 * Comoving distance (Mly) for a redshift given as cz (km/s), in the model's cosmology: where
 * Hubble's law runs long (by ~2 % at the Sloan Great Wall's z = 0.073).
 */
const redshiftMly = (cz: number) => comovingMly(cz / convert(1, "c", "km/s"));

/** Comoving distance (Mly) to redshift z in the model's cosmology. */
const comovingMly = (z: number) => convert(comovingDistanceMpc(z, PLANCK_2018), "Mpc", "Mly");

/* ---------------------------------------------------------------------------------------
 * The observable universe: as far as light has had time to come since the Big Bang. The
 * cosmic microwave background, released at last scattering, is as far as light lets us see;
 * the particle horizon lies a little beyond it.
 * ------------------------------------------------------------------------------------- */

/** Redshift of last scattering (Planck 2018 VI, Table 2: z∗ = 1089.80 ± 0.21). */
export const LAST_SCATTERING_Z = 1089.8;
/** Today's distance to the edge, Mly: 46.2 billion light-years. */
export const HORIZON_MLY = convert(particleHorizonMpc(PLANCK_2018), "Mpc", "Mly");
/** Today's distance to where the microwave background we see set out, Mly. */
export const CMB_MLY = comovingMly(LAST_SCATTERING_Z);
/**
 * The farthest galaxy yet confirmed by its spectrum, redshift: MoM-z14 (Naidu et al. 2025,
 * z = 14.44 ± 0.02), checked 19 October 2026. Photometric candidates beyond it do not count.
 */
const FIRST_GALAXIES_Z = 14.44;
/**
 * Today's distance to them, Mly: about three quarters of the way to the microwave background.
 * Between them and it lie cosmic dawn, when the first stars and galaxies lit up beyond what
 * we have seen yet, and before it the dark ages.
 */
export const FIRST_GALAXIES_MLY = comovingMly(FIRST_GALAXIES_Z);
/** The universe's age when that light set out, years: about 372,000. */
export const CMB_AGE_YEARS = cosmicAgeAtRedshiftGyr(LAST_SCATTERING_Z, PLANCK_2018) * 1e9;
/** The CMB's temperature today, K (Fixsen 2009). */
export const CMB_KELVIN = 2.7255;

/** Rings at the distances light set out from this many billion years ago (a teaching choice). */
export const LOOKBACK_RINGS_GYR = [1, 5, 10] as const;
/** Where light that set out `gyr` billion years ago started, today's distance in Mly. */
export const lookbackMly = (gyr: number) => comovingMly(redshiftAtLookback(gyr, PLANCK_2018));

/* ---------------------------------------------------------------------------------------
 * The Milky Way and Andromeda: a radial Kepler orbit from the Big Bang (Kahn & Woltjer
 * 1959; van der Marel et al. 2012). r = A(1 − cos η), t = B(η − sin η); today's r, ṙ and
 * t₀ fix A, B and η, and with them when the pair turned around.
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
const ANDROMEDA_MASS_SHARE = 0.55;

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

/** Largest separation on the orbit (turnaround), Mly, and when (years ago). */
export const LOCAL_TURNAROUND = {
  mly: 2 * LOCAL_ORBIT.A,
  yearsAgo: (UNIVERSE_AGE_GYR - Math.PI * LOCAL_ORBIT.B) * 1e9,
};

/* ---------------------------------------------------------------------------------------
 * Directions. Galactic (l, b) → Galaxy-model axes; the supergalactic frame of de
 * Vaucouleurs (pole at l = 47.37°, b = +6.32°; SGL = 0 at l = 137.37°, b = 0°).
 * ------------------------------------------------------------------------------------- */

/** Unit vector toward galactic (l, b), in degrees, in Galaxy-model axes. */
function galacticDirection(l: number, b: number): Vec3 {
  const cb = Math.cos(b * RAD);
  return [-cb * Math.cos(l * RAD), Math.sin(b * RAD), cb * Math.sin(l * RAD)];
}

/**
 * The Sun's motion against the microwave background: 369.82 km/s toward l = 264.021°,
 * b = 48.253° (Planck 2018 I). Added along a line of sight it turns a heliocentric cz into
 * the CMB frame, where the Hubble flow is at rest.
 */
const CMB_DIPOLE = { kms: 369.82, toward: galacticDirection(264.021, 48.253) };

/** A heliocentric cz (km/s) toward galactic (l, b) as the CMB-frame cz distances use. */
export function cmbCz(l: number, b: number, cz: number) {
  const [x, y, z] = galacticDirection(l, b);
  const [tx, ty, tz] = CMB_DIPOLE.toward;
  return cz + CMB_DIPOLE.kms * (x * tx + y * ty + z * tz);
}

const cross = (a: Vec3, b: Vec3): Vec3 => [
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
export function fromSupergalactic(x: number, y: number, z: number): Vec3 {
  const { x: X, y: Y, z: Z } = SUPERGALACTIC;
  return [
    X[0] * x + Y[0] * y + Z[0] * z,
    X[1] * x + Y[1] * y + Z[1] * z,
    X[2] * x + Y[2] * y + Z[2] * z,
  ];
}

/** Supergalactic latitude (degrees) of a Galaxy-model direction. */
export function supergalacticLatitude(v: Vec3) {
  const { z } = SUPERGALACTIC;
  const len = Math.hypot(v[0], v[1], v[2]) || 1;
  return Math.asin((v[0] * z[0] + v[1] * z[1] + v[2] * z[2]) / len) / RAD;
}

/** Andromeda's direction from the Sun. */
const ANDROMEDA_DIRECTION = galacticDirection(121.17, -21.57);

/** The Sun in Galaxy-model axes, Mly from the galactic centre. */
const SUN_MLY: Vec3 = [SUN_GALACTIC_RADIUS_LY / 1e6, SUN_HEIGHT_LY / 1e6, 0];

/** A heliocentric distance (Mly) toward (l, b), from the galactic centre. */
function place(l: number, b: number, mly: number): Vec3 {
  const d = galacticDirection(l, b);
  return [SUN_MLY[0] + d[0] * mly, SUN_MLY[1] + d[1] * mly, SUN_MLY[2] + d[2] * mly];
}

/* ---------------------------------------------------------------------------------------
 * Named anchors. Distances are rounded literature values; see docs/science-sources.md.
 * ------------------------------------------------------------------------------------- */

/** A J2000 sky position and heliocentric cz as an anchor's direction and comoving distance. */
const fromSky = (ra: number, dec: number, cz: number) => {
  const { l, b } = equatorialToGalactic(ra, dec);
  return { l, b, mly: redshiftMly(cmbCz(l, b, cz)) };
};

/**
 * The Sloan Great Wall in the SDSS equatorial slice (Gott et al. 2005): RA 8.7h–13.7h,
 * −2° < δ < 2°, at z = 0.073. The drawing bends it ±`swing` km/s in depth about that, with
 * its middle (its label) at z = 0.073.
 */
export const SLOAN_WALL = { ra: [130.5, 205.5], dec: 0, z: 0.073, swing: 1_500 } as const;

/** The cosmic web's named landmarks: J2000 position (degrees) and heliocentric cz (km/s). */
export const WEB_SKY = {
  /** NGC 1275 at the heart of the Perseus Cluster (Abell 426), at the cluster's cz (Struble & Rood 1999). */
  perseus: { ra: 49.9507, dec: 41.5117, cz: 5_366 },
  /** The Coma Cluster's centre and median velocity (Geller, Diaferio & Kurtz 1999). */
  coma: { ra: 194.854, dec: 27.946, cz: 7_090 },
  /** Abell 3558, the Shapley Supercluster's central cluster (Proust et al. 2006, Table 4). */
  shapley: { ra: 201.987, dec: -31.495, cz: 14_307 },
  /** The middle of the Sloan Great Wall's span, at its z = 0.073 (Gott et al. 2005). */
  sloanGreatWall: {
    ra: (SLOAN_WALL.ra[0] + SLOAN_WALL.ra[1]) / 2,
    dec: SLOAN_WALL.dec,
    cz: SLOAN_WALL.z * convert(1, "c", "km/s"),
  },
} as const;

/** A J2000 sky position and heliocentric cz (km/s) as a place, Mly from the galactic centre. */
export function skyPlace(ra: number, dec: number, cz: number): Vec3 {
  const { l, b, mly } = fromSky(ra, dec, cz);
  return place(l, b, mly);
}

/**
 * The Perseus–Pisces ridge, as the drawing strings it: NGC 383 in the Pisces groups, Abell 262,
 * the Perseus Cluster and on across the Milky Way's plane to Abell 569 (NED positions and
 * velocities). The main ridge runs at least 50 h⁻¹ Mpc to the plane (Wegner, Haynes &
 * Giovanelli 1993); the link on to Abell 569 (Kraan-Korteweg et al. 2018) has been disputed.
 */
export const PERSEUS_PISCES_CHAIN = [
  { ra: 16.854, dec: 32.413, cz: 5_098 },
  { ra: 28.194, dec: 36.152, cz: 4_860 },
  { ra: 49.951, dec: 41.512, cz: 5_366 },
  { ra: 107.29, dec: 48.62, cz: 5_949 },
] as const;

/**
 * The Shapley concentration's richest clusters for the drawing: Abell 3558, 3562 and 3556 at
 * its core, Abell 3528 and 3571 on its edges (velocities from Proust et al. 2006, Table 4).
 */
export const SHAPLEY_CLUSTERS = [
  { ra: 201.987, dec: -31.495, cz: 14_307 },
  { ra: 203.4, dec: -31.67, cz: 14_455 },
  { ra: 201.03, dec: -31.67, cz: 14_439 },
  { ra: 193.6, dec: -29.0, cz: 16_294 },
  { ra: 206.87, dec: -32.85, cz: 11_676 },
] as const;

const SKY = {
  perseus: fromSky(WEB_SKY.perseus.ra, WEB_SKY.perseus.dec, WEB_SKY.perseus.cz),
  coma: fromSky(WEB_SKY.coma.ra, WEB_SKY.coma.dec, WEB_SKY.coma.cz),
  shapley: fromSky(WEB_SKY.shapley.ra, WEB_SKY.shapley.dec, WEB_SKY.shapley.cz),
  sloanGreatWall: fromSky(
    WEB_SKY.sloanGreatWall.ra,
    WEB_SKY.sloanGreatWall.dec,
    WEB_SKY.sloanGreatWall.cz,
  ),
};

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
  | "greatAttractor"
  | "perseusCluster"
  | "comaCluster"
  | "shapleyCore"
  | "sloanGreatWall";

type Anchor = {
  id: AnchorId;
  /** Galactic longitude and latitude, degrees. */
  l: number;
  b: number;
  /** Heliocentric distance today, Mly. */
  mly: number;
};

export const ANCHORS: readonly Anchor[] = [
  { id: "andromeda", l: 121.17, b: -21.57, mly: ANDROMEDA_MLY },
  /* M33, 840 ± 11 kpc from HST Cepheids (Breuval et al. 2023). */
  { id: "triangulum", l: 133.61, b: -31.33, mly: convert(0.84, "Mpc", "Mly") },
  { id: "lmc", l: 280.47, b: -32.89, mly: 0.163 },
  { id: "smc", l: 302.81, b: -44.33, mly: 0.203 },
  { id: "m81", l: 142.09, b: 40.9, mly: 11.7 },
  { id: "centaurusA", l: 309.52, b: 19.42, mly: 12.4 },
  { id: "sculptor", l: 97.37, b: -87.96, mly: 11.4 },
  /* The Virgo Cluster's centre, M87: 16.5 Mpc (Mei et al. 2007). */
  { id: "virgoCluster", l: 283.78, b: 74.49, mly: convert(16.5, "Mpc", "Mly") },
  /* NGC 1399, 20.0 Mpc (Blakeslee et al. 2009). */
  { id: "fornaxCluster", l: 236.72, b: -53.64, mly: convert(20, "Mpc", "Mly") },
  /* Abell 3526 and Abell 1060 (cz 3,683, Christlein & Zabludoff 2003): Hubble-flow distances
     at the model's own H₀, from their CMB-frame cz. */
  { id: "centaurusCluster", l: 302.4, b: 21.56, mly: hubbleMly(cmbCz(302.4, 21.56, 3_418)) },
  { id: "hydraCluster", l: 269.63, b: 26.51, mly: hubbleMly(cmbCz(269.63, 26.51, 3_683)) },
  /* The Great Attractor toward the Norma Cluster (Abell 3627, cz 4,871 km/s, Woudt et al.
     2008): its Hubble-flow distance, ~73 Mpc. */
  { id: "greatAttractor", l: 325.33, b: -7.26, mly: hubbleMly(cmbCz(325.33, -7.26, 4_871)) },
  /* Beyond Laniakea, at comoving distances from their redshifts. */
  { id: "perseusCluster", ...SKY.perseus },
  { id: "comaCluster", ...SKY.coma },
  { id: "shapleyCore", ...SKY.shapley },
  { id: "sloanGreatWall", ...SKY.sloanGreatWall },
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
  "perseusPisces",
  "comaCluster",
  "shapleySupercluster",
  "sloanGreatWall",
  "observableUniverse",
] as const;

/* Fixed for the session: each anchor's place today. */
const TODAY = new Map<Anchor, Vec3>(ANCHORS.map((a) => [a, place(a.l, a.b, a.mly)]));

/** Today's position of an anchor, Mly from the galactic centre. Shared: do not modify. */
export const anchorToday = (a: Anchor): Readonly<Vec3> => TODAY.get(a)!;

/** Today's diameter of each structure (Mly), from the published size in its own unit. */
export const STRUCTURES = {
  /** Twice the zero-velocity radius, 0.96 ± 0.03 Mpc (Karachentsev et al. 2009). */
  localGroup: { width: convert(2 * 0.96, "Mpc", "Mly") },
  /**
   * Tully et al. 2008: a 7 Mpc radius about us, ±1.5 Mpc about the supergalactic equator;
   * random motions ~40 km/s; the sheet moves 259 km/s away from the Local Void.
   */
  localSheet: { width: convert(2 * 7, "Mpc", "Mly"), thickness: convert(2 * 1.5, "Mpc", "Mly") },
  /**
   * r₂₀₀ = 1.55 Mpc at 15 Mpc (McLaughlin 1999, ApJ 512, L9), scaled to the model's 16.5 Mpc:
   * twice that across.
   */
  virgo: { width: convert((2 * 1.55 * 16.5) / 15, "Mpc", "Mly") },
  /** De Vaucouleurs' Local Supercluster, ~33 Mpc across. */
  supercluster: { width: convert(33, "Mpc", "Mly") },
  /**
   * Tully et al. 2014: 160 Mpc across (12,000 km/s) on Cosmicflows-2's scale, H₀ = 75.2,
   * rescaled to the model's; 10¹⁷ solar masses, ~100,000 galaxies.
   */
  laniakea: { width: convert((160 * 75.2) / HUBBLE, "Mpc", "Mly") },
  /**
   * Gott et al. 2005: 450 Mpc long (comoving) at their H₀ = 71, rescaled to the model's; their
   * "1.37 billion light-years" is that over (1 + z), the length when the light we see left it.
   */
  sloanGreatWall: { length: convert((450 * 71) / HUBBLE, "Mpc", "Mly") },
  /** Wegner, Haynes & Giovanelli 1993: at least 50 h⁻¹ Mpc, here at the model's H₀. */
  perseusPisces: { length: convert(50 / (HUBBLE / 100), "Mpc", "Mly") },
} as const;

/** The Local Group's mass centre, Mly from the galactic centre: along the line to Andromeda. */
export const LOCAL_GROUP_CENTRE: Readonly<Vec3> = (() => {
  const d = ANDROMEDA_DIRECTION;
  const r = ANDROMEDA_MLY * ANDROMEDA_MASS_SHARE;
  return [d[0] * r, d[1] * r, d[2] * r];
})();

/* ---------------------------------------------------------------------------------------
 * Camera aims: as the camera pulls out, the point it turns about moves from the galactic
 * centre to each structure's heart, in log distance between the framed views.
 * ------------------------------------------------------------------------------------- */

type AimStop = { ly: number; at: Readonly<Vec3> };

const scaled = (v: Readonly<Vec3>, k: number): Vec3 => [v[0] * k, v[1] * k, v[2] * k];
const ZERO: Readonly<Vec3> = [0, 0, 0];

/** Camera distances (ly) of the framed views beyond the Galaxy. */
export const COSMIC_VIEW_LY = {
  localGroup: 6.5e6,
  sheet: 32e6,
  virgo: 68e6,
  supercluster: 175e6,
  laniakea: 760e6,
  web: 2.8e9,
  universe: 1.5e11,
} as const;

const WEB_LANDMARKS: readonly AnchorId[] = [
  "perseusCluster",
  "comaCluster",
  "shapleyCore",
  "sloanGreatWall",
];
/** The middle of the web's landmarks, Mly from the galactic centre. */
const WEB_CENTRE = WEB_LANDMARKS.reduce<Vec3>(
  (sum, id) => {
    const p = anchorToday(anchorById(id));
    return [
      sum[0] + p[0] / WEB_LANDMARKS.length,
      sum[1] + p[1] / WEB_LANDMARKS.length,
      sum[2] + p[2] / WEB_LANDMARKS.length,
    ];
  },
  [0, 0, 0],
);

const AIM_STOPS: readonly AimStop[] = [
  { ly: 300_000, at: ZERO },
  { ly: COSMIC_VIEW_LY.localGroup, at: LOCAL_GROUP_CENTRE },
  /* Pull straight back over our own sheet before the frame turns toward Virgo. */
  { ly: COSMIC_VIEW_LY.sheet, at: LOCAL_GROUP_CENTRE },
  { ly: COSMIC_VIEW_LY.virgo, at: scaled(anchorToday(anchorById("virgoCluster")), 0.55) },
  { ly: COSMIC_VIEW_LY.supercluster, at: scaled(anchorToday(anchorById("virgoCluster")), 0.8) },
  { ly: COSMIC_VIEW_LY.laniakea, at: anchorToday(anchorById("greatAttractor")) },
  /* The web turns about the middle of its named landmarks, from Perseus to the Great Wall. */
  { ly: COSMIC_VIEW_LY.web, at: WEB_CENTRE },
  /* The observable universe is centred on us, as every observer's is. */
  { ly: COSMIC_VIEW_LY.universe, at: ZERO },
];

const ease = (t: number) => t * t * t * (t * (6 * t - 15) + 10);

/** The camera's turning point (Mly from the galactic centre) at a camera distance in ly. */
export function cosmicAim(ly: number, out: Vec3 = [0, 0, 0]): Vec3 {
  const first = AIM_STOPS[0]!;
  if (ly <= first.ly) {
    out[0] = out[1] = out[2] = 0;
    return out;
  }
  for (let i = 1; i < AIM_STOPS.length; i += 1) {
    const to = AIM_STOPS[i]!;
    if (ly > to.ly && i < AIM_STOPS.length - 1) continue;
    const from = AIM_STOPS[i - 1]!;
    const k = ease(clamp01(Math.log(ly / from.ly) / Math.log(to.ly / from.ly)));
    out[0] = from.at[0] + (to.at[0] - from.at[0]) * k;
    out[1] = from.at[1] + (to.at[1] - from.at[1]) * k;
    out[2] = from.at[2] + (to.at[2] - from.at[2]) * k;
    return out;
  }
  return out;
}

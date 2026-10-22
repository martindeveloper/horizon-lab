/**
 * Measured figures of named stars, stellar remnants and black holes, once, for every
 * simulation: equatorial (and, for a flattened star, polar) radius and flattening, mass,
 * effective temperature, luminosity (in L☉), rotation and distance, each a value or published
 * span with its source and how it was checked, and what powers each body (`ENGINES`). A
 * simulation derives what follows from them (a radius from luminosity and temperature, a
 * horizon from a mass) through the science kit's laws. docs/science-sources.md lists them
 * (`npm run docs:catalogue`).
 *
 * Status: `flag` marks a literature value written from the cited work but not yet opened in it
 * for this catalogue; the ledger lists them for checking.
 */
import { literatureFact, factsOf, type Fact, type Value } from "@/lib/facts";
import type { SourceId } from "@/lib/sources";
import { STARS as NEIGHBOURS } from "@/space/galaxy/model/catalogue/stars";

/** What is measured of a star, a remnant or a hole; any may be missing. */
export type StellarFigures = {
  /** Equatorial radius. */
  radius?: Fact;
  /** Polar radius, for a star flattened by its spin. */
  polar?: Fact;
  /** Equatorial over polar radius, where it is measured in its own right rather than from the two. */
  flattening?: Fact;
  /** Sidereal rotation period; at the equator for a star that turns faster there. */
  rotation?: Fact;
  /** An upper limit on the rotation period, where only P/sin i is known (the tilt is not). */
  rotationLimit?: Fact;
  mass?: Fact;
  /** Effective temperature; a span where the surface ranges from pole to equator. */
  teff?: Fact;
  /** Luminosity over the Sun's. */
  luminosity?: Fact;
  distance?: Fact;
  /** Inclination of the spin axis from the line of sight, where it is measured. */
  inclination?: Fact;
  /** For a star whose surface ranges in temperature: the one model fitted to its whole disc's light. */
  discTeff?: Fact;
  /** Heliocentric radial velocity, positive receding. */
  radialVelocity?: Fact;
  /** A black hole's dimensionless spin a/M: measured, or the value a lab assumes where it is not. */
  spin?: Fact;
  /** A mass other models give, where the literature splits. */
  massOtherModels?: Fact;
  /** The two holes a merger's remnant formed from. */
  primaryMass?: Fact;
  secondaryMass?: Fact;
  /** The star that weighs a hole: its orbital period and closest approach. */
  companionPeriod?: Fact;
  companionPericentre?: Fact;
  /** Redshift, for a source too far for a distance of its own. */
  redshift?: Fact;
};

/** Stars and remnants: a pulsar, white and brown dwarfs, main-sequence stars, giants and supergiants. */
export const NAMED_STARS = {
  "psr-j0030": {
    rotation: literatureFact(4.87e-3, "s", "bogdanov2019", "verified", { digits: 3, show: "ms" }),
    radius: literatureFact(12.71, "km", "riley2019", "verified", {
      range: [11.52, 13.85],
      digits: 3,
    }),
    mass: literatureFact(1.34, "Msun", "riley2019", "verified", { range: [1.18, 1.49], digits: 3 }),
    distance: literatureFact(325, "pc", "riley2019", "verified", {
      range: [316, 334],
      digits: 3,
      note: "the radio-timing distance the fit assumes",
    }),
  },
  "sirius-b": {
    radius: literatureFact(0.008098, "Rsun", "bond2017", "verified", {
      range: [0.008052, 0.008144],
      digits: 3,
      show: "km",
    }),
    mass: literatureFact(1.018, "Msun", "bond2017", "verified", {
      range: [1.007, 1.029],
      digits: 4,
    }),
    teff: literatureFact(25_369, "K", "bond2017", "verified", {
      range: [25_323, 25_415],
      digits: 3,
    }),
    distance: literatureFact(8.6, "ly", "vanLeeuwen2007", "verified", { digits: 3 }),
  },
  "lhs-6343-c": {
    radius: literatureFact(55_980, "km", "montet2015", "verified", {
      range: [55_190, 56_770],
      digits: 3,
      note: "0.783 ± 0.011 Jupiter radii (71,492 km)",
    }),
    mass: literatureFact(0.05928, "Msun", "montet2015", "verified", {
      range: [0.05813, 0.06043],
      digits: 3,
      note: "62.1 ± 1.2 Jupiter masses",
    }),
  },
  "trappist-1": {
    rotation: literatureFact(3.3, "d", "luger2017", "verified", { digits: 2 }),
    radius: literatureFact(0.1192, "Rsun", "agol2021", "verified", {
      range: [0.1179, 0.1205],
      digits: 3,
    }),
    mass: literatureFact(0.0898, "Msun", "agol2021", "verified", {
      range: [0.0875, 0.0921],
      digits: 3,
    }),
    teff: literatureFact(2_566, "K", "agol2021", "verified", { range: [2_540, 2_592], digits: 3 }),
    luminosity: literatureFact(5.53e-4, "Lsun", "agol2021", "verified", {
      range: [5.34e-4, 5.72e-4],
    }),
    distance: literatureFact(12.47, "pc", "gaiaDr3", "verified", { digits: 3 }),
  },
  proxima: {
    rotation: literatureFact(82.6, "d", "collins2017", "verified", {
      range: [82.5, 82.7],
      digits: 3,
    }),
    radius: literatureFact(0.1542, "Rsun", "kervella2017", "verified", {
      range: [0.1497, 0.1587],
      digits: 3,
    }),
    mass: literatureFact(0.1221, "Msun", "kervella2017", "verified", {
      range: [0.1199, 0.1243],
      digits: 3,
    }),
    teff: literatureFact(2_980, "K", "ribas2017", "verified", { range: [2_900, 3_060], digits: 3 }),
    luminosity: literatureFact(0.00151, "Lsun", "ribas2017", "verified", {
      range: [0.00143, 0.00159],
    }),
    distance: NEIGHBOURS.proxima.distance,
  },
  "alpha-cen-a": {
    radius: literatureFact(1.2234, "Rsun", "kervella2017ab", "verified", { digits: 4 }),
    mass: literatureFact(1.0788, "Msun", "akeson2021", "verified", { digits: 4 }),
    teff: literatureFact(5_795, "K", "kervella2017ab", "verified", { digits: 3 }),
    distance: NEIGHBOURS.alphaCen.distance,
  },
  "alpha-cen-b": {
    radius: literatureFact(0.8632, "Rsun", "kervella2017ab", "verified", { digits: 4 }),
    mass: literatureFact(0.9092, "Msun", "akeson2021", "verified", { digits: 4 }),
    teff: literatureFact(5_231, "K", "kervella2017ab", "verified", { digits: 3 }),
    distance: NEIGHBOURS.alphaCen.distance,
  },
  sun: {
    rotation: literatureFact(24.47, "d", "snodgrass1990", "flag", {
      digits: 3,
      note: "sidereal, at the equator, from the 14.713°/day Doppler rate; higher latitudes turn more slowly",
    }),
    radius: literatureFact(1, "Rsun", "iau2015b3", "verified", {
      digits: 4,
      note: "695,700 km, nominal",
    }),
    mass: literatureFact(1, "Msun", "iau2015b3", "verified", {
      digits: 4,
      note: "nominal GM☉ over G",
    }),
    teff: literatureFact(5_772, "K", "iau2015b3", "verified", { digits: 4 }),
    luminosity: literatureFact(1, "Lsun", "iau2015b3", "verified", {
      digits: 4,
      note: "3.828 × 10²⁶ W, nominal",
    }),
  },
  procyon: {
    radius: literatureFact(2.031, "Rsun", "aufdenberg2005", "flag", {
      range: [2.018, 2.044],
      digits: 4,
    }),
    mass: literatureFact(1.478, "Msun", "bond2015", "flag", { range: [1.466, 1.49], digits: 4 }),
    teff: literatureFact(6_530, "K", "kervella2004", "flag", { range: [6_480, 6_580], digits: 3 }),
    radialVelocity: literatureFact(-4.5, "km/s", "simbad", "flag", { digits: 3 }),
  },
  sirius: {
    radius: literatureFact(1.711, "Rsun", "kervella2003", "verified", {
      range: [1.698, 1.724],
      digits: 3,
    }),
    mass: literatureFact(2.063, "Msun", "bond2017", "verified", {
      range: [2.04, 2.086],
      digits: 3,
    }),
    teff: literatureFact(9_845, "K", "bond2017", "verified", {
      range: [9_781, 9_909],
      digits: 3,
      note: "Davis et al. 2011 at Bond et al.'s parallax",
    }),
    distance: literatureFact(8.6, "ly", "vanLeeuwen2007", "verified", { digits: 3 }),
  },
  vega: {
    rotation: literatureFact(0.71, "d", "monnier2012", "verified", {
      range: [0.69, 0.73],
      digits: 2,
      show: "h",
    }),
    radius: literatureFact(2.726, "Rsun", "monnier2012", "verified", {
      range: [2.72, 2.732],
      digits: 3,
    }),
    polar: literatureFact(2.418, "Rsun", "monnier2012", "verified", {
      range: [2.406, 2.43],
      digits: 3,
    }),
    mass: literatureFact(2.15, "Msun", "monnier2012", "verified", { range: [2, 2.25], digits: 3 }),
    teff: literatureFact(null, "K", "monnier2012", "verified", {
      range: [8_910, 10_070],
      digits: 3,
      note: "equator to pole",
    }),
    luminosity: literatureFact(47.2, "Lsun", "monnier2012", "verified", {
      range: [45.2, 49.2],
      digits: 2,
    }),
    distance: literatureFact(25, "ly", "vanLeeuwen2007", "verified", { digits: 3 }),
    inclination: literatureFact(6.2, "deg", "monnier2012", "flag", {
      digits: 2,
      note: "Table 2, concordance Model 3: seen almost pole-on",
    }),
    discTeff: literatureFact(9_550, "K", "castelli1994", "flag", {
      digits: 3,
      note: "one plane-parallel model fitted to the light of the whole disc",
    }),
    radialVelocity: literatureFact(-13.5, "km/s", "simbad", "flag", { digits: 3 }),
  },
  achernar: {
    rotation: literatureFact(null, "d", "domiciano2014", "derived", {
      range: [1.37, 1.45],
      digits: 3,
      note: "one over its rotation frequency, 0.689 d⁻¹ as adopted there or 0.73 d⁻¹ in other analyses",
    }),
    radius: literatureFact(9.16, "Rsun", "domiciano2014", "verified", {
      range: [8.93, 9.39],
      digits: 3,
    }),
    polar: literatureFact(6.79, "Rsun", "domiciano2014", "derived", {
      range: [6.29, 7.34],
      digits: 3,
      note: "equatorial radius over its flattening, 1.35 ± 0.07",
    }),
    flattening: literatureFact(1.35, "ratio", "domiciano2014", "verified", {
      range: [1.28, 1.42],
      digits: 3,
    }),
    mass: literatureFact(5.99, "Msun", "kervella2022", "verified", {
      range: [5.39, 6.59],
      digits: 2,
      note: "from its companion's orbit",
    }),
    teff: literatureFact(15_539, "K", "kervella2022", "verified", {
      range: [15_101, 15_977],
      digits: 3,
      note: "averaged over the disc; the poles are hotter than the equator",
    }),
    luminosity: literatureFact(3_493, "Lsun", "kervella2022", "verified", {
      range: [3_064, 3_922],
      digits: 2,
    }),
    distance: literatureFact(139, "ly", "vanLeeuwen2007", "verified", { digits: 3 }),
    inclination: literatureFact(60.6, "deg", "domiciano2014", "flag", {
      digits: 3,
      note: "Table 2",
    }),
  },
  arcturus: {
    radius: literatureFact(25.4, "Rsun", "ramirez2011", "verified", {
      range: [25.2, 25.6],
      digits: 3,
    }),
    mass: literatureFact(1.08, "Msun", "ramirez2011", "verified", {
      range: [1.02, 1.14],
      digits: 3,
    }),
    teff: literatureFact(4_286, "K", "ramirez2011", "verified", {
      range: [4_256, 4_316],
      digits: 3,
    }),
    distance: literatureFact(36.7, "ly", "vanLeeuwen2007", "verified", { digits: 3 }),
    radialVelocity: literatureFact(-5.2, "km/s", "simbad", "flag", { digits: 3 }),
  },
  alnitak: {
    radius: literatureFact(20, "Rsun", "hummel2013", "verified", {
      range: [16.8, 23.2],
      digits: 2,
      note: "Aa, from its angular diameter at a parallax of 2.6 mas",
    }),
    mass: literatureFact(33, "Msun", "hummel2013", "verified", {
      range: [23, 43],
      digits: 2,
      note: "Aa, from the orbit at the photometric distance",
    }),
    teff: literatureFact(29_500, "K", "hummel2013", "flag", { range: [28_500, 30_500], digits: 3 }),
    radialVelocity: literatureFact(18.1, "km/s", "simbad", "flag", { digits: 3 }),
  },
  r136a1: {
    mass: literatureFact(222, "Msun", "brands2022", "verified", {
      range: [193, 250],
      digits: 3,
      note: "present mass on evolutionary tracks; 273 M☉ at birth",
    }),
    teff: literatureFact(46_000, "K", "brands2022", "verified", {
      range: [43_625, 47_250],
      digits: 2,
    }),
    luminosity: literatureFact(7.24e6, "Lsun", "brands2022", "verified", {
      range: [6.17e6, 7.94e6],
      digits: 2,
      note: "log L/L☉ = 6.86 +0.04/−0.07",
    }),
    distance: literatureFact(49.59, "kpc", "pietrzynski2019", "verified", { digits: 3 }),
  },
  aldebaran: {
    radius: literatureFact(45.2, "Rsun", "richichi2005", "derived", {
      range: [44.4, 46],
      digits: 3,
      note: "its 20.58 mas disc at van Leeuwen's parallax; the paper's 44.2 R☉ uses the 1997 one",
    }),
    mass: literatureFact(1.16, "Msun", "farr2018", "verified", { range: [1.09, 1.23], digits: 3 }),
    teff: literatureFact(3_927, "K", "heiter2015", "verified", {
      range: [3_887, 3_967],
      digits: 3,
    }),
    luminosity: literatureFact(439, "Lsun", "heiter2015", "verified", {
      range: [422, 456],
      digits: 2,
    }),
    distance: literatureFact(66.6, "ly", "vanLeeuwen2007", "verified", { digits: 3 }),
    radialVelocity: literatureFact(54.4, "km/s", "simbad", "flag", { digits: 3 }),
  },
  rigel: {
    radius: literatureFact(78.9, "Rsun", "moravveji2012", "verified", {
      range: [71.5, 86.3],
      digits: 2,
    }),
    mass: literatureFact(23, "Msun", "przybilla2010", "verified", {
      digits: 2,
      note: "from rotating evolutionary tracks",
    }),
    teff: literatureFact(12_100, "K", "moravveji2012", "verified", {
      range: [11_950, 12_250],
      digits: 3,
    }),
    luminosity: literatureFact(1.2e5, "Lsun", "moravveji2012", "verified", {
      range: [9.55e4, 1.41e5],
      digits: 2,
      note: "log L/L☉ = 5.08 +0.07/−0.10",
    }),
    distance: literatureFact(860, "ly", "vanLeeuwen2007", "verified", {
      range: [790, 950],
      digits: 2,
    }),
    radialVelocity: literatureFact(17.8, "km/s", "simbad", "flag", { digits: 3 }),
  },
  deneb: {
    radius: literatureFact(203, "Rsun", "schiller2008", "verified", {
      range: [186, 220],
      digits: 3,
    }),
    mass: literatureFact(19, "Msun", "schiller2008", "verified", { range: [15, 23], digits: 2 }),
    teff: literatureFact(8_525, "K", "schiller2008", "verified", {
      range: [8_450, 8_600],
      digits: 3,
    }),
    luminosity: literatureFact(1.96e5, "Lsun", "schiller2008", "verified", {
      range: [1.64e5, 2.28e5],
      digits: 2,
    }),
    distance: literatureFact(802, "pc", "schiller2008", "verified", {
      range: [736, 868],
      digits: 2,
    }),
  },
  antares: {
    radius: literatureFact(680, "Rsun", "ohnaka2013", "verified", {
      range: [580, 820],
      digits: 2,
      note: "its 37.4 mas disc at Hipparcos' 5.89 ± 1.00 mas parallax, which sets the spread",
    }),
    mass: literatureFact(null, "Msun", "ohnaka2013", "verified", {
      range: [11, 14.3],
      note: "present mass on the tracks of a 15 ± 5 M☉ star",
    }),
    teff: literatureFact(3_660, "K", "ohnaka2013", "verified", {
      range: [3_540, 3_780],
      digits: 3,
    }),
    luminosity: literatureFact(7.59e4, "Lsun", "ohnaka2013", "verified", {
      range: [4.47e4, 1.29e5],
      digits: 2,
      note: "log L/L☉ = 4.88 ± 0.23",
    }),
    distance: literatureFact(550, "ly", "vanLeeuwen2007", "verified", {
      range: [470, 670],
      digits: 2,
    }),
  },
  betelgeuse: {
    rotationLimit: literatureFact(36, "yr", "kervella2018", "verified", {
      range: [28, 44],
      digits: 2,
      note: "P/sin i from its rotating SiO lines (5.47 km/s projected); the period itself is no longer",
    }),
    radius: literatureFact(764, "Rsun", "joyce2020", "verified", { range: [702, 880], digits: 3 }),
    mass: literatureFact(null, "Msun", "joyce2020", "verified", { range: [16.5, 19] }),
    teff: literatureFact(3_600, "K", "joyce2020", "verified", {
      range: [3_575, 3_625],
      digits: 2,
      note: "Levesque & Massey 2020, as Joyce et al. adopt it",
    }),
    distance: literatureFact(168, "pc", "joyce2020", "verified", { range: [153, 195], digits: 3 }),
  },
  "uy-scuti": {
    // Derive R from this one L/T set (about 932 R☉ with T☉ = 5772 K), rather than
    // mixing the catalogue's tabulated 909 R☉ with Arroyo-Torres's older temperature.
    // The older paper's assumed 7–10 M☉ is not a mass determination for this solution.
    teff: literatureFact(3_550, "K", "healy2024", "verified", {
      range: [3_380, 3_720],
      digits: 3,
    }),
    luminosity: literatureFact(124_308, "Lsun", "healy2024", "derived", {
      range: [88_983, 167_755],
      digits: 3,
      note: "2024-04-11 catalogue, V* UY Sct: 10^5.094500706 L☉; bounds from Mbol = −7.93625 (+0.36298/−0.32544), using L/L0 = 10^(−0.4 ΔMbol); radius recomputed from this L and T",
    }),
    distance: literatureFact(1.87, "kpc", "healy2024", "verified", {
      range: [1.69, 2.09],
      digits: 3,
      note: "Bailer-Jones et al. 2021 geometric distance as adopted by Healy et al.; Gaia DR3 repeats the EDR3 astrometry",
    }),
  },
  "vy-cma": {
    radius: literatureFact(1_420, "Rsun", "wittkowski2012", "verified", {
      range: [1_300, 1_540],
      digits: 3,
    }),
    mass: literatureFact(null, "Msun", "wittkowski2012", "verified", {
      range: [15, 19],
      note: "present mass on 25 M☉ (rotating) or 32 M☉ tracks",
    }),
    teff: literatureFact(3_490, "K", "wittkowski2012", "verified", {
      range: [3_400, 3_580],
      digits: 3,
    }),
    luminosity: literatureFact(2.7e5, "Lsun", "wittkowski2012", "verified", {
      range: [2.3e5, 3.1e5],
      digits: 2,
    }),
    distance: literatureFact(1.17, "kpc", "wittkowski2012", "verified", {
      range: [1.1, 1.25],
      digits: 3,
      note: "mean of the Choi et al. 2008 and Zhang et al. 2012 maser parallaxes",
    }),
  },
  "stephenson-2-18": {
    teff: literatureFact(3_200, "K", "fok2012", "verified", { digits: 2 }),
    luminosity: literatureFact(4.37e5, "Lsun", "fok2012", "verified", {
      digits: 2,
      note: "log L/L☉ = 5.64, from a dust-shell fit at 5.5 kpc",
    }),
    distance: literatureFact(5.5, "kpc", "fok2012", "verified", {
      digits: 2,
      note: "adopted RSGC2 SW distance in Table 6, used for the Table 8 luminosity; a model assumption, not a precise distance measurement",
    }),
  },
} as const satisfies Readonly<Record<string, StellarFigures>>;

/**
 * Black holes whose masses are measured: stellar ones (one feeding on its companion, one
 * dormant, one born in a merger), a candidate in a globular cluster, the Milky Way's and two in
 * other galaxies.
 */
export const BLACK_HOLES = {
  "cygnus-x1": {
    mass: literatureFact(21.2, "Msun", "millerJones2021", "verified", {
      range: [19, 23.4],
      digits: 3,
    }),
    distance: literatureFact(2.22, "kpc", "millerJones2021", "verified", { digits: 3 }),
    spin: literatureFact(0.95, "ratio", "zhao2021", "teaching-choice", {
      sources: ["steiner2024"],
      digits: 2,
      note: "assumed: disputed, > 0.9985 by continuum fitting, ≳ 0.96 by IXPE, low by Comptonised reflection",
    }),
    massOtherModels: literatureFact(null, "Msun", "ramachandran2025", "verified", {
      range: [12.7, 17.8],
      digits: 2,
      note: "wind models with other estimates for the companion",
    }),
  },
  "gaia-bh3": {
    mass: literatureFact(32.7, "Msun", "panuzzo2024", "verified", {
      range: [31.88, 33.52],
      digits: 3,
    }),
    distance: literatureFact(590.6, "pc", "panuzzo2024", "verified", {
      range: [584.8, 596.4],
      digits: 4,
    }),
    spin: literatureFact(0, "ratio", "panuzzo2024", "teaching-choice", {
      note: "not measured: with nothing falling in, no X-ray method applies",
    }),
    companionPeriod: literatureFact(4_253, "d", "panuzzo2024", "verified", {
      range: [4_154, 4_352],
      show: "yr",
      digits: 3,
      note: "the metal-poor giant's orbit, e = 0.73",
    }),
  },
  gw231123: {
    mass: literatureFact(222, "Msun", "lvk2025", "verified", {
      range: [180, 250],
      digits: 3,
      note: "the remnant's mass after the merger of 137 and 101 M☉",
    }),
    distance: literatureFact(2.2, "Gpc", "lvk2025", "verified", {
      range: [0.7, 4.1],
      digits: 2,
      note: "luminosity distance, z ≈ 0.40",
    }),
    spin: literatureFact(0.84, "ratio", "lvk2025", "verified", {
      range: [0.68, 0.92],
      digits: 2,
      note: "the remnant's χ_f, waveform-model dependent",
    }),
    primaryMass: literatureFact(137, "Msun", "lvk2025", "verified", { range: [119, 160], digits: 3 }),
    secondaryMass: literatureFact(101, "Msun", "lvk2025", "verified", { range: [51, 123], digits: 3 }),
  },
  "omega-cen": {
    mass: literatureFact(8_200, "Msun", "haberle2024", "verified", {
      digits: 2,
      note: "a lower limit from seven fast central stars; N-body comparisons favour 39,000–47,000",
    }),
    distance: literatureFact(5.43, "kpc", "baumgardt2021", "verified", { digits: 3 }),
    spin: literatureFact(0, "ratio", "haberle2024", "teaching-choice", { note: "not measured" }),
  },
  "sgr-a": {
    mass: literatureFact(4.297e6, "Msun", "gravity2022", "verified", {
      range: [4.285e6, 4.309e6],
      digits: 4,
    }),
    distance: literatureFact(8.277, "kpc", "gravity2022", "verified", { digits: 4 }),
    spin: literatureFact(0.94, "ratio", "eht2022", "teaching-choice", {
      digits: 2,
      note: "assumed: the only EHT model passing every test; later work is split",
    }),
    companionPeriod: literatureFact(16.0455, "yr", "gravity2020", "verified", {
      digits: 4,
      note: "S2, the star that weighs it",
    }),
    companionPericentre: literatureFact(120, "au", "gravity2020", "verified", {
      digits: 2,
      note: "S2's closest approach",
    }),
  },
  m87: {
    mass: literatureFact(6.5e9, "Msun", "eht2019", "verified", {
      range: [5.8e9, 7.2e9],
      digits: 2,
    }),
    distance: literatureFact(16.8, "Mpc", "eht2019", "verified", { range: [16, 17.6], digits: 3 }),
    spin: literatureFact(0.9, "ratio", "ehtM87Spin2026", "teaching-choice", {
      digits: 1,
      note: "assumed: the ring disfavours |a| ≲ 0.2, and a Blandford–Znajek jet needs spin",
    }),
  },
  "ton-618": {
    mass: literatureFact(4.07e10, "Msun", "ge2019", "verified", {
      sources: ["shemmer2004"],
      range: [4.07e10, 6.6e10],
      digits: 3,
      note: "single-epoch virial estimates: Ge et al. 2019 to Shemmer et al. 2004",
    }),
    spin: literatureFact(0.6, "ratio", "king2016", "teaching-choice", {
      digits: 1,
      note: "assumed: a thin disk this massive needs a ≳ 0.6",
    }),
    redshift: literatureFact(2.219, "ratio", "shemmer2004", "verified", { digits: 4 }),
  },
} as const satisfies Readonly<Record<string, StellarFigures>>;

export type NamedStarId = keyof typeof NAMED_STARS;
export type BlackHoleId = keyof typeof BLACK_HOLES;

export const STELLAR_CATALOGUE = { stars: NAMED_STARS, holes: BLACK_HOLES } as const;

/** Every fact with its path ("stars.betelgeuse.radius"), for tests and the ledger. */
export const stellarCatalogueFacts = () => factsOf(STELLAR_CATALOGUE);

/**
 * What powers a body. Fusion: hydrogen to helium by the proton–proton chain (cooler cores, under
 * about 1.3 M☉) or the CNO cycle (hotter, heavier cores), hydrogen burning in a shell round a
 * spent helium core (a giant), or helium to carbon and oxygen in the core (a supergiant or a
 * giant in its later life). No fusion: a dead star's stored heat, a pulsar's spin, a brown
 * dwarf's or giant planet's slow contraction, a planet's radioactivity, a black hole's infalling
 * gas, or nothing at all for a dormant hole.
 */
export type EngineProcess =
  | "ppChain"
  | "cnoCycle"
  | "hydrogenShell"
  | "heliumCore"
  | "cooling"
  | "spinDown"
  | "contraction"
  | "radioactivity"
  | "accretion"
  | "dormant";

/**
 * A body's engine as the evidence has it: only the Sun's is measured (by its neutrinos);
 * the rest follow from mass and evolutionary stage through stellar models (`derived`).
 * `debated` names the other stage the literature still allows.
 */
export type Engine = {
  process: EngineProcess;
  debated?: EngineProcess;
  sources: readonly SourceId[];
  status: Value["status"];
  note: string;
};

const engine = (
  process: EngineProcess,
  sources: readonly SourceId[],
  status: Value["status"],
  note: string,
  debated?: EngineProcess,
): Engine =>
  debated ? { process, debated, sources, status, note } : { process, sources, status, note };

const MODELS = "kippenhahn2012" satisfies SourceId;
const fromMass = "from its mass and stage by standard stellar models";

/** Every star's, remnant's and hole's engine. */
export const ENGINES: Readonly<
  Record<keyof typeof NAMED_STARS | keyof typeof BLACK_HOLES, Engine>
> = {
  "psr-j0030": engine(
    "spinDown",
    ["riley2019"],
    "derived",
    "a rotation-powered millisecond pulsar: no fusion; its slowing spin powers its beams and heats its polar caps",
  ),
  "sirius-b": engine(
    "cooling",
    [MODELS, "bond2017"],
    "derived",
    "a white dwarf: no fusion; it shines by the heat it stored and slowly cools",
  ),
  "lhs-6343-c": engine(
    "contraction",
    ["chabrier2000"],
    "derived",
    "a brown dwarf below the hydrogen-burning limit: it burned its deuterium young and now glows by slow contraction and cooling",
  ),
  "trappist-1": engine(
    "ppChain",
    ["chabrier2000"],
    "derived",
    "a red dwarf just above the hydrogen-burning limit, fully convective, so all its hydrogen passes through the core",
  ),
  proxima: engine(
    "ppChain",
    ["chabrier2000"],
    "derived",
    "a fully convective red dwarf: all its hydrogen passes through the core",
  ),
  "alpha-cen-a": engine(
    "ppChain",
    [MODELS, "akeson2021"],
    "derived",
    `a main-sequence star a little heavier than the Sun, burning hydrogen in its core; ${fromMass}`,
  ),
  "alpha-cen-b": engine(
    "ppChain",
    [MODELS, "akeson2021"],
    "derived",
    `a main-sequence star a little lighter than the Sun, burning hydrogen in its core; ${fromMass}`,
  ),
  sun: engine(
    "ppChain",
    ["borexino2018", "borexino2020"],
    "verified",
    "measured by its neutrinos: the proton–proton chain, with the CNO cycle supplying about 1 %",
  ),
  procyon: engine(
    "cnoCycle",
    [MODELS],
    "derived",
    `${fromMass}: near the end of core hydrogen burning, perhaps already burning it in a shell`,
    "hydrogenShell",
  ),
  sirius: engine("cnoCycle", [MODELS], "derived", `${fromMass}: a main-sequence star above 1.3 M☉`),
  vega: engine("cnoCycle", [MODELS], "derived", `${fromMass}: a main-sequence star above 1.3 M☉`),
  achernar: engine("cnoCycle", [MODELS], "derived", `${fromMass}: a main-sequence B star`),
  arcturus: engine(
    "hydrogenShell",
    [MODELS],
    "derived",
    `${fromMass}: a red giant on the red-giant branch, or already burning helium in its core`,
    "heliumCore",
  ),
  alnitak: engine(
    "cnoCycle",
    [MODELS],
    "derived",
    `${fromMass}: an O supergiant late in core hydrogen burning, or just past it`,
    "hydrogenShell",
  ),
  r136a1: engine(
    "cnoCycle",
    ["crowther2010", MODELS],
    "flag",
    "a hydrogen-rich WN5h star, about a million years old, still burning hydrogen in its core",
  ),
  aldebaran: engine(
    "hydrogenShell",
    [MODELS],
    "derived",
    `${fromMass}: a red giant on the red-giant branch, or already burning helium in its core`,
    "heliumCore",
  ),
  rigel: engine(
    "heliumCore",
    [MODELS],
    "derived",
    `${fromMass}: a blue supergiant past the main sequence; whether its core burns helium yet is debated`,
    "hydrogenShell",
  ),
  deneb: engine(
    "heliumCore",
    [MODELS],
    "derived",
    `${fromMass}: a white supergiant past the main sequence; whether its core burns helium yet is debated`,
    "hydrogenShell",
  ),
  antares: engine("heliumCore", [MODELS], "derived", `${fromMass}: a red supergiant`),
  betelgeuse: engine(
    "heliumCore",
    ["joyce2020"],
    "verified",
    "early core helium burning, from its pulsations and evolutionary models",
  ),
  "uy-scuti": engine(
    "heliumCore",
    [MODELS],
    "derived",
    `${fromMass}: a red supergiant, in core helium burning or later`,
  ),
  "vy-cma": engine(
    "heliumCore",
    [MODELS],
    "derived",
    `${fromMass}: a red hypergiant, in core helium burning or later`,
  ),
  "stephenson-2-18": engine(
    "heliumCore",
    [MODELS],
    "derived",
    `${fromMass}: a red supergiant, in core helium burning or later`,
  ),
  "cygnus-x1": engine(
    "accretion",
    ["millerJones2021"],
    "derived",
    "no fusion: gas pulled from its blue supergiant companion heats up as it falls in",
  ),
  "gaia-bh3": engine(
    "dormant",
    ["panuzzo2024"],
    "derived",
    "no fusion and no feeding: its giant companion is too far off to spill gas, so it gives out no light",
  ),
  gw231123: engine(
    "dormant",
    ["lvk2025"],
    "derived",
    "no fusion and no feeding: seen only by the gravitational waves of the merger that made it",
  ),
  "omega-cen": engine(
    "dormant",
    ["haberle2024"],
    "derived",
    "no fusion and no feeding: found only by the stars it flings about the cluster's core",
  ),
  "sgr-a": engine(
    "accretion",
    ["gravity2022"],
    "derived",
    "no fusion: a thin trickle of infalling gas, faint and flickering",
  ),
  m87: engine(
    "accretion",
    ["eht2019"],
    "derived",
    "no fusion: its infalling gas glows and launches a jet",
  ),
  "ton-618": engine(
    "accretion",
    ["ge2019"],
    "derived",
    "no fusion: a quasar, lit by gas falling in at a furious rate",
  ),
};

/**
 * Each star's spectral type as catalogued (not translated): its MK class and luminosity class,
 * DA… for a white dwarf, T… for a brown dwarf. The pulsar has none.
 */
export const SPECTRAL_TYPES: Readonly<Partial<Record<keyof typeof NAMED_STARS, string>>> = {
  "sirius-b": "DA2",
  /* T1.5 ± 1 from its HST/WFC3 eclipse spectrum (arXiv:2408.05173). */
  "lhs-6343-c": "T1.5",
  "trappist-1": "M8 V",
  proxima: "M5.5 Ve",
  "alpha-cen-a": "G2 V",
  "alpha-cen-b": "K1 V",
  sun: "G2 V",
  procyon: "F5 IV–V",
  sirius: "A1 V",
  vega: "A0 Va",
  achernar: "B6 Vep",
  arcturus: "K1.5 III",
  alnitak: "O9.5 Iab",
  r136a1: "WN5h",
  aldebaran: "K5 III",
  rigel: "B8 Ia",
  deneb: "A2 Ia",
  antares: "M1.5 Iab",
  betelgeuse: "M1–M2 Ia–ab",
  "uy-scuti": "M4 Ia",
  "vy-cma": "M5e Ia",
  "stephenson-2-18": "M6",
};

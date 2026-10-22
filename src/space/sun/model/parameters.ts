/**
 * The Sun model's numbers, once. The model computes with them, the catalogue and the printed
 * formulas quote them, and a lab's shader header may copy them, so none can disagree. Each
 * says where it comes from; a figure a card prints lives in `catalogue.ts` and cites its source
 * in full. Lengths are in solar radii (R), angles in radians, times in model seconds.
 */
import {
  GRAVITATIONAL_CONSTANT,
  JULIAN_YEAR_SECONDS,
  RAD_PER_DEG,
  SOLAR_MASS_KG,
  SOLAR_RADIUS_KM,
  SOLAR_TEFF_K,
} from "@horizon/toolkit/science";

/* ------------------------------------------------------------------- time */

export const DAY_S = 86_400;
export const YEAR_S = JULIAN_YEAR_SECONDS;
export const HOUR_S = 3_600;

/* ---------------------------------------------------------------- the body */

/** Radius and surface gravity, from the IAU 2015 nominal values and CODATA's G. */
export const RADIUS_M = SOLAR_RADIUS_KM * 1e3;
export const SURFACE_GRAVITY = (GRAVITATIONAL_CONSTANT * SOLAR_MASS_KG) / RADIUS_M ** 2;
/** Mean mass per particle of a fully ionised solar plasma, atomic mass units (Priest 2014, §2.3). */
export const CORONAL_MEAN_MOLECULAR_WEIGHT = 0.6;

/* ----------------------------------------------------------------- the map */

/**
 * The white-light map (`MAPS.sun`): SDO/HMI continuum discs of 1, 8, 15 and 22 May 2024 in a
 * Carrington mosaic. Its epoch is the window's middle; the central meridian then is the model's
 * longitude zero (`MAP_CENTRAL_MERIDIAN_DEG` in `observed.ts`).
 */
export const MAP_EPOCH = Date.UTC(2024, 4, 11, 12);

/* ------------------------------------------------------------------ probes */
/** Parker Solar Probe at its closest, 24 December 2024: radii from the centre, and its speed then, km/s (NASA). */
export const PARKER_PERIHELION_R = 9.86;
export const PARKER_PERIHELION_SPEED_KM_S = 191;
/**
 * Its record orbit since then (JPL Horizons osculating elements, 1 June 2025): the eccentricity,
 * the period in days and a perihelion's moment (19 June 2025, 09:08 UTC). The perihelion
 * distance is `PARKER_PERIHELION_R` (Horizons: 6.862 million km, 9.86 R☉).
 */
export const PARKER_ECCENTRICITY = 0.8819;
export const PARKER_PERIOD_D = 88.44;
export const PARKER_PERIHELION_EPOCH = Date.UTC(2025, 5, 19, 9, 8);
export const MAP_WINDOW_D = 21;
/** The Carrington rotation as seen from Earth, days (Carrington 1863; the synodic period). */
export const CARRINGTON_SYNODIC_PERIOD_D = 27.2753;
/** Reported regions smaller than this, millionths of a hemisphere, are not seeded. */
export const OBSERVED_MIN_AREA_MSH = 10;

/* --------------------------------------------------------------- the cycle */

/** Mean length of the sunspot cycle, years, and the rise from minimum to maximum (Hathaway 2015, §4.2–4.3). */
export const CYCLE_PERIOD_YR = 11;
export const CYCLE_RISE_YR = 4;
/** Shape constant of the cycle's curve, F(t) ∝ (t/b)³ / (exp((t/b)²) − c) (Hathaway, Wilson & Reichmann 1994). */
export const CYCLE_SHAPE_C = 0.71;
/** Cycle 25 began at the minimum of December 2019 (SILSO; NOAA/NASA Solar Cycle Prediction Panel). */
export const CYCLE_25_MINIMUM_YEAR = 2019 + 11.5 / 12;
export const CYCLE_25_NUMBER = 25;
/** Mean spot latitude at a cycle's start and end, and its spread (the butterfly diagram, Hathaway 2015, §4.6). */
export const SPORER_START_RAD = 28 * RAD_PER_DEG;
export const SPORER_END_RAD = 8 * RAD_PER_DEG;
export const SPORER_SPREAD_RAD = 6 * RAD_PER_DEG;
/** No region emerges nearer the equator than this. */
export const REGION_LATITUDE_MIN_RAD = 2 * RAD_PER_DEG;
/** Joy's law: a bipole's tilt grows with its latitude, about half of it (Hale et al. 1919; Hathaway 2015, §4.7), with scatter. */
export const JOY_SLOPE = 0.5;
export const JOY_SCATTER_RAD = 0.15;
/** Polar field at minimum, tesla (5–10 G, Hathaway 2015, §4.8), and an umbra's, up to 0.3 T (Solanki 2003). */
export const POLAR_FIELD_T = 1e-3;
export const SPOT_FIELD_T = 0.3;
/**
 * The equatorial dipole at maximum, as a share of the polar field at minimum: near maximum the
 * Sun's dipole lies in the equator rather than vanishing (DeRosa, Brun & Hoeksema 2012), which
 * opens coronal holes at low latitude.
 */
export const EQUATORIAL_DIPOLE = 0.4;

/* -------------------------------------------------------- active regions */

/** Region slots a frame holds; how many are in use follows the cycle. */
export const REGION_SLOTS = 12;
/** Regions alive at once at maximum and at minimum (sunspot number ~150 against ~5). */
export const REGIONS_AT_MAXIMUM = 10;
export const REGIONS_AT_MINIMUM = 1;
/** Each slot's window, days: a region is born in it and dies before it ends. */
export const REGION_WINDOW_D = 90;
/** A group's angular radius, radians: log-normal about a median (Bogdan et al. 1988: log-normal spot areas), σ in ln. */
export const REGION_SIZE_MEDIAN_RAD = 0.04;
export const REGION_SIZE_SIGMA = 0.5;
export const REGION_SIZE_MAX_RAD = 0.12;
/** Gnevyshev–Waldmeier: a group lives about a day for every 10 millionths of a hemisphere of peak area. */
export const GNEVYSHEV_WALDMEIER_DAYS_PER_MSH = 0.1;
/** Millionths of a hemisphere covered by a cap of unit angular radius (area πs², hemisphere 2π). */
export const MSH_PER_RAD2 = 1e6 / 2;
export const REGION_LIFE_MIN_D = 3;
/** A region reaches full strength this far into its life, then its area decays linearly (Hathaway 2015, §4.5). */
export const REGION_EMERGENCE_SHARE = 0.15;
/** An observed region starts a visit at its prime: this far into its life. */
export const OBSERVED_START_SHARE = REGION_EMERGENCE_SHARE;
/** Spots per group at a median region's prime, for the Wolf number (Hathaway 2015: ~10 spots per group at maximum). */
export const SPOTS_PER_REGION = 8;
/** Faculae outshine their spots as a region decays (Solanki 2003, §6): their strength against the spots' at the prime, and when they fade. */
export const FACULA_AT_PRIME = 0.4;
export const FACULA_FADE_SHARE = 0.85;
/** A region counts as a group for the Wolf number from this strength. */
export const GROUP_VISIBLE_STRENGTH = 0.05;

/* ------------------------------------------------------------------ flares */

/** Power-law index of the flare peak-flux distribution, dN/dF ∝ F^−α (Aschwanden 2005, §9.8: α ≈ 1.8). */
export const FLARE_POWER_INDEX = 1.8;
/** GOES 1–8 Å classes, W/m² at the class's unit. */
export const GOES_CLASS_FLUX = { A: 1e-8, B: 1e-7, C: 1e-6, M: 1e-5, X: 1e-4 } as const;
export const GOES_CLASSES = ["A", "B", "C", "M", "X"] as const;
/** Smallest and largest flare the model draws, W/m² (B1 to X20). */
export const FLARE_MIN_FLUX = GOES_CLASS_FLUX.B;
export const FLARE_MAX_FLUX = 20 * GOES_CLASS_FLUX.X;
/** The flare the `flare` readout counts in units of: M1. */
export const FLARE_UNIT_FLUX = GOES_CLASS_FLUX.M;
/** Flare windows per region, seconds, and the chance of one per window for a median region at its prime (about one a day). */
export const FLARE_WINDOW_S = 6 * HOUR_S;
export const FLARE_CHANCE_PER_WINDOW = 0.25;
/** Windows a flare's light is still followed after its own. */
export const FLARE_WINDOWS_BACK = 2;
/** Rise and decay times of the soft X-ray light curve, seconds, the decay longer for larger flares (Aschwanden 2005, §16). */
export const FLARE_RISE_S = 300;
export const FLARE_DECAY_S = 1_800;
export const FLARE_DECAY_POWER = 0.25;
/** Flares from this flux up erupt as a coronal mass ejection (most M5 and larger do; Yashiro et al. 2006). */
export const ERUPTING_FLUX = 5 * GOES_CLASS_FLUX.M;
/** One eruption's sequence, seconds: shearing compressed into its first part, the flare at its middle, the ejection out of view by its end. */
export const ERUPTION_SECONDS = 2 * HOUR_S;

/* ------------------------------------------------------------- prominences */

/** Prominence slots: quiescent ones at high latitude, the rest over active regions. */
export const PROMINENCE_SLOTS = 8;
export const QUIESCENT_SLOTS = 5;
/** Quiescent prominences: latitudes, length and height (R), lifetime weeks to months (Parenti 2014, §2). */
export const QUIESCENT_LATITUDES_RAD = [40 * RAD_PER_DEG, 65 * RAD_PER_DEG] as const;
export const QUIESCENT_LENGTH_R = [0.1, 0.6] as const;
export const QUIESCENT_HEIGHT_R = [0.02, 0.1] as const;
export const QUIESCENT_LIFE_D = 60;
export const QUIESCENT_LIFE_SPREAD = [0.6, 1.4] as const;
export const QUIESCENT_PRESENCE = 0.8;
/** The polar crown's scatter about its latitude, and a filament channel's about east–west, radians. */
export const POLAR_CROWN_SPREAD_RAD = 2 * RAD_PER_DEG;
export const CHANNEL_TILT_SCATTER_RAD = 0.4;
/** A quiescent prominence forms and dissolves over this share of its life. */
export const PROMINENCE_FADE_SHARE = 0.1;
/** Active-region prominences: along the region's neutral line, low and short-lived (Parenti 2014, §2). */
export const ACTIVE_PROMINENCE_LENGTH = 2;
export const ACTIVE_PROMINENCE_HEIGHT_R = 0.02;
/** An erupting prominence lifts to this many times its height before it fades. */
export const PROMINENCE_LIFT = 6;

/* ------------------------------------------------------------- the field */

/** The potential field's source surface, R: beyond it the field is radial, open to the wind (Altschuler & Newkirk 1969; Schatten, Wilcox & Ness 1969). */
export const SOURCE_SURFACE_R = 2.5;
/** A region's buried dipole lies one group radius under its centre. */
export const REGION_DIPOLE_DEPTH = 1;
/** Tracing: step as a share of the local scale, the most points a line keeps, and the field below which a line is dropped. */
export const TRACE_STEP = 0.05;
export const TRACE_MAX_POINTS = 192;
export const TRACE_STEP_MIN_R = 1e-3;
/** How a frame's field lines are shared: the coronal holes about the dipole's poles, active regions, the quiet Sun. */
export const FIELD_LINE_SHARES = { holes: 0.25, regions: 0.5, quiet: 0.25 } as const;
export const MAX_FIELD_LINES = 400;
/** Hole seeds lie within this angle of the dipole's axis: the polar caps at minimum, low latitudes at maximum. */
export const HOLE_CAP_RAD = 30 * RAD_PER_DEG;
/** Quiet-Sun seeds stay below this latitude. */
export const QUIET_SEED_LATITUDE_RAD = 55 * RAD_PER_DEG;
/** A region's loops start this far out from its leading pole, as a share of its size. */
export const LOOP_SEED_SPREAD = [0.3, 1] as const;

/* ---------------------------------------------------------------- loop heat */

/**
 * A loop's temperature by the RTV scaling laws (Rosner, Tucker & Vaiana 1978; Reale 2014, §4):
 * T ∝ (E_H L²)^(2/7), with the heating E_H ∝ B²/L of field lines braided at a fixed footpoint
 * speed (Parker 1988; one of the laws Mandrini, Démoulin & Klimchuk 2000 test), so
 * T ∝ (B² L)^(2/7): strong-field core loops hot, weak-field fans cool. Anchored to a 1 MK fan
 * loop of 200 G plage footpoints and 200 Mm, and held within the observed range 0.8–3 MK
 * (Reale 2014).
 */
export const LOOP_REFERENCE = { kelvin: 1e6, fieldT: 0.02, lengthR: 0.3 } as const;
export const LOOP_FIELD_POWER = 2;
export const LOOP_LENGTH_POWER = 1;
export const RTV_EXPONENT = 2 / 7;
export const LOOP_KELVIN_RANGE = [0.8e6, 3e6] as const;
/** In a flaring region, loops hotter than this share of the range flare at the flare temperature. */
export const FLARE_LOOP_SHARE = 0.5;

/* --------------------------------------------------------------- temperatures */

/**
 * What each drawn component glows at, K (Aschwanden 2005, Table 1.1; Priest 2014, §1.3;
 * prominences: Parenti 2014, 7.5–9 kK): the photosphere at its effective temperature, an
 * umbra, the chromosphere, the transition region, a coronal hole, the quiet corona,
 * active-region loops, flare plasma.
 */
export const TEMPERATURES = {
  photosphere: SOLAR_TEFF_K,
  spot: 4_000,
  chromosphere: 1e4,
  prominence: 8_000,
  transition: 1e5,
  coronalHole: 1e6,
  quietCorona: 1.5e6,
  activeRegion: 2.5e6,
  flare: 1.5e7,
} as const;
/** White light's reference wavelength, nm, in the middle of the visible. */
export const WHITE_LIGHT_NM = 550;

/* ------------------------------------------------------------- the eruption */

/** Length unit of the illustrative reconnection cross-section, R: an active region's half-width. */
export const ERUPTION_SCALE_R = 0.05;
/** Stage ends on the 0–1 timeline: shearing and storage, loss of equilibrium and rise, breakaway with reconnection, then post-flare loops. */
export const ERUPTION_STAGES = { storage: 0.3, rise: 0.5, breakaway: 0.7 } as const;
/** When flux transfer begins in the illustrative reconnection sequence. */
export const X_POINT_S = 0.4;
/** Source half-separation λ/λ₀ as shearing starts and at the critical point. */
export const STORAGE_LAMBDA = [2, 1] as const;
/** The rope's height at breakaway (λ₀) and the ejection's front at the sequence's end (R from the centre). */
export const ROPE_HEIGHT_AT_BREAKAWAY = 3;
export const CME_FINAL_HEIGHT_R = 5;
/** The flare's light decays over this share of the timeline after each release of energy. */
export const FLARE_LIGHT_DECAY_S01 = 0.12;
/** An ejection's angular half-width, radians (CME widths ~ 60°, Yashiro et al. 2004). */
export const CME_SPREAD_RAD = 30 * RAD_PER_DEG;
/** Field lines one eruption frame carries, and the arcade slices they are extruded into. */
export const ERUPTION_LINES = 24;
export const ARCADE_SLICES = 7;
/** The arcade's length along the neutral line, in region sizes. */
export const ARCADE_LENGTH = 2;
/**
 * Dimensionless recipe for a kinematic 2D reconnection model, not measured solar parameters.
 * A = (y−1)²/2 − (y−1)³/3 − βδ² log cosh(x/δ) − ψ(s) w(x,y).
 * The X-point is (0,1), the island centre (0,2); w vanishes at the photosphere and centre.
 * β and ψ keep the X-point hyperbolic and its resistivity positive throughout the sequence.
 */
export const RECONNECTION = {
  fieldGradient: 8,
  sheetWidth: 0.15,
  fluxWidth: 1.5,
  transferredFlux: 0.3,
  diffusionWidth: 0.12,
  diffusionHeight: 0.25,
  outerFlux: -0.39,
  coreLines: 3,
  // Monotonic schematic height mapping resolves the small lower arcade beside the CME.
  lowCoronalLift: 2,
  lowCoronalScale: 0.7,
} as const;

/* -------------------------------------------------------------- the corona */

/** Baumbach 1937: the K-corona's brightness in millionths of the mean disc, Σ cᵢ r^−pᵢ. */
export const BAUMBACH_TERMS = [
  { coefficient: 0.0532, power: 2.5 },
  { coefficient: 1.425, power: 7 },
  { coefficient: 2.565, power: 17 },
] as const;
/** The F-corona falls as r^−2.3 and equals the K-corona near 2.5 R (Koutchmy & Lamy 1985). */
export const F_CORONA_POWER = 2.3;
export const F_CORONA_CROSSOVER_R = 2.5;
/** The E-corona's green line: Fe XIV 530.3 nm, formed near 2 MK (Priest 2014, §1.3). */
export const E_CORONA_LINE_NM = 530.3;
export const E_CORONA_KELVIN = 2e6;
/** Streamers over closed field are this many times brighter than the open corona beside them (teaching choice). */
export const STREAMER_CONTRAST = 3;
/** Solar wind: slow over the streamer belt, fast from the polar holes, km/s (McComas et al. 2000, Ulysses). */
export const WIND_SLOW_KM_S = 400;
export const WIND_FAST_KM_S = 750;
/** The slow-wind belt's half-width at minimum and at maximum (McComas et al. 2000). */
export const WIND_BELT_MIN_RAD = 20 * RAD_PER_DEG;
export const WIND_BELT_MAX_RAD = 70 * RAD_PER_DEG;
/** The slow-to-fast transition's width in latitude. */
export const WIND_BLEND_RAD = 10 * RAD_PER_DEG;

/* ------------------------------------------------------------- the interior */

/** Base of the convection zone, R (Charbonneau et al. 1999, after Basu & Antia 1997), and the tachocline's thickness under it (0.039 ± 0.013 R). */
export const TACHOCLINE_R = 0.713;
export const TACHOCLINE_THICKNESS_R = 0.039;
/** Water's density, kg/m³: what the Sun's densities are compared with (as Giants' `WATER_DENSITY`). */
export const WATER_DENSITY = 1_000;
/** The core's edge: where the model's luminosity reaches this share of the total. */
export const CORE_LUMINOSITY_SHARE = 0.99;
/** The photosphere's thickness, km (the visible layer, ~300–500 km; Nordlund, Stein & Asplund 2009). */
export const PHOTOSPHERE_THICKNESS_KM = 400;
/** The chromosphere's thickness, km (Priest 2014, §1.3). */
export const CHROMOSPHERE_THICKNESS_KM = 2_000;

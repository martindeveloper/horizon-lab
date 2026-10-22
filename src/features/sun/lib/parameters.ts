import { SUN_MAP_QUIET_INTENSITY } from "@/space/solar-system/model/parameters";
/**
 * The Sun lab's renderer numbers, once: the stage, the surface's scales and contrasts, the
 * cut's shells, the lights, the atmosphere, the eruption and the ribbons. The shaders receive
 * the visual ones as `#define`s (`npm run shaders:generate` writes
 * `graphics/parameters.generated.glsl`). Figures the model owns (the Sun's radius and
 * temperature, the rotation law) come from the shared catalogues, never retyped.
 */
import { NETWORK_GRANULES, PROFILE_SAMPLES } from "@/space/sun/graphics/parameters";
import { SUN_ACTIVITY_MAX_REGIONS } from "@/space/sun/graphics/prominence/parameters";
import { MAP_CENTRAL_MERIDIAN_RAD } from "@/space/sun/model/observed";
import {
  CORONAL_MEAN_MOLECULAR_WEIGHT,
  DAY_S,
  RADIUS_M,
  SURFACE_GRAVITY,
  TEMPERATURES,
} from "@/space/sun/model/parameters";
import {
  BOLTZMANN_CONSTANT,
  PROTON_MASS_KG,
  SOLAR_RADIUS_KM,
  SOLAR_TEFF_K,
} from "@horizon/toolkit/science";
import { glslDefines, glslInt } from "@horizon/toolkit/shaders/defines";

/* ------------------------------------------------------------------ stage */

/** The globe's proxy sphere, a little past the photosphere; the atmosphere's, where the corona has faded. */
export const PROXY_RADIUS = 1.02;
export const ATMOSPHERE_RADIUS = 6;
/** The camera's reach from the centre, solar radii. */
export const CAMERA_MIN_R = 1.03;
export const CAMERA_MAX_R = 12;
/**
 * Its reach from a feature it orbits (a spot group, a prominence, an active region), radii:
 * never so close that, straight over a feature on the surface, it would be inside the globe's
 * shell at CAMERA_MIN_R; nearer the surface the orbit's horizon floor keeps it out.
 */
export const FEATURE_MIN_R = CAMERA_MIN_R - 1 + 0.01;
export const FEATURE_MAX_R = 4;
/** Round a feature the camera keeps at least this elevation over the feature's horizon, radians: never under the surface. */
export const FEATURE_ELEVATION_MIN = 0.04;
/**
 * Zooming in over the disc, nearer than this to the centre, takes the surface point under the
 * pointer as the orbit's centre, so the wheel closes on what is looked at; zooming back out
 * past the second distance from that point lets it go.
 */
export const POINTER_AIM_R = 2.2;
export const POINTER_RELEASE_R = 1.4;
/** The orbit's centre moves between the Sun's centre and a feature with this time constant, s. */
export const AIM_LAG_S = 0.8;
/**
 * About the centre a drag has its full turn from where the camera's height over the surface
 * is this share of its distance (the disc view, three radii out) and tightens in proportion
 * nearer, so the surface under the camera never flies past a pointer.
 */
export const DRAG_FULL_HEIGHT = 2 / 3;
/** The wedge's half-angle when the cut is fully open: a quarter of the Sun. */
export const CUT_HALF_ANGLE = Math.PI / 4;
/** The wedge's bisector follows the camera, and the wedge opens and closes, with this time constant, s. */
export const CUT_LAG_S = 0.6;
/**
 * Above this clock rate (model seconds per second) the camera rides with the Carrington frame:
 * when a second carries more than ten days the spin would only strobe, and what the clock is
 * for, the cycle's drift in latitude and the field's reversal, shows in the frame synoptic
 * maps use.
 */
export const COROTATE_ABOVE_RATE = 10 * DAY_S;
/** How long one light gives way to the next, s. */
export const DISSOLVE_S = 0.5;
/** Latitude grid lines every this many degrees, and their strength. */
export const GRID_STEP_DEG = 15;
export const GRID_ALPHA = 0.22;
/** A feature resolves above this many drawing-buffer pixels. */
export const SURFACE_RESOLVE_PX = 2;

/* ---------------------------------------------------------------- surface */

/** The photosphere's effective temperature (the shared catalogue's). */
export const PHOTOSPHERE_K = SOLAR_TEFF_K;
/**
 * The measured Sun (SDO/HMI's flattened continuum, `MAPS.sun`): the map yields to the
 * procedural surface as one of its texels grows from this many buffer pixels to this many, the
 * near tier loads inside this camera distance, radii, and a map arriving fades in over this
 * long, s. Its quiet level is the solar system's.
 */
export const MAP_FADE_FROM_PX = 4;
export const MAP_FADE_TO_PX = 8;
export const MAP_FADE_IN_S = 1.2;
export { MAP_CENTRAL_MERIDIAN_RAD, SUN_MAP_QUIET_INTENSITY };
/**
 * Display scales of the surface's features. A granule's size and lifetime, a supergranule's
 * lifetime and the spots' temperatures are the model's figures (the Sun's catalogue in
 * `src/space/sun`); integration reads them from there.
 */
export const GRANULE_KM = 1_000;
export const GRANULES_PER_RADIUS = SOLAR_RADIUS_KM / GRANULE_KM;
export const GRANULE_LIFETIME_S = 480;
export const NETWORK_LIFETIME_S = 86_400;
/** Granules' temperature contrast as a share of the temperature; the supergranular network's. */
export const GRANULE_CONTRAST = 0.04;
export const NETWORK_CONTRAST = 0.006;
/** A spot's umbra (the model's spot temperature) and penumbra, K, and how much darker the penumbra's dark filaments run than its bright ones, as a share. */
export const UMBRA_K = TEMPERATURES.spot;
export const PENUMBRA_K = 5_000;
export const PENUMBRA_FILAMENT = 0.3;
/** A group's leading and following spots: their radii as shares of the group's size (times the root of its strength). */
export const LEAD_SPOT = 0.42;
export const FOLLOW_SPOT = 0.28;
/** Faculae round an active region: this much hotter where they show best, at the limb. */
export const FACULA_CONTRAST = 0.09;
/** The Evershed flow's speed along the penumbra, km/s, and the ripple its filaments carry. */
export const EVERSHED_KMS = 2;
export const EVERSHED_RADII_PER_S = EVERSHED_KMS / SOLAR_RADIUS_KM;
export const EVERSHED_RIPPLE = 0.12;
export const EVERSHED_WAVES = 36;
/** Umbral dots: how many across a spot's radius, and how much they brighten the umbra. */
export const UMBRAL_DOTS = 14;
export const UMBRAL_DOT_CONTRAST = 0.6;
/** Flare ribbons' light in white light: a hot continuum, K, and its glare as a share of the face. */
export const WHITE_FLARE_K = 9_000;
export const RIBBON_GLARE = 1.2;
/**
 * The face's exposure (below white at the disc's centre) and the display contrast its relative
 * light is raised to, so the limb's fall and the spots' darkness read on a screen as they do to
 * the eye through a filter, not as the encoded curve flattens them.
 */
export const SURFACE_EXPOSURE = 0.68;
export const SURFACE_CONTRAST = 2.2;
/** Longitude turns slower towards the poles than at the equator: the law's sin² and sin⁴ terms over its equatorial rate (Snodgrass & Ulrich 1990), the model's figures. */
export const ROTATION_SIN2 = -2.396 / 14.713;
export const ROTATION_SIN4 = -1.787 / 14.713;
/** The interior turns rigidly at the rate the surface law gives at this latitude, degrees. */
export const INTERIOR_LATITUDE_DEG = 30;
const interiorSin = Math.sin((INTERIOR_LATITUDE_DEG * Math.PI) / 180);
export const INTERIOR_TURN_RATIO =
  1 + ROTATION_SIN2 * interiorSin ** 2 + ROTATION_SIN4 * interiorSin ** 4;

/* ------------------------------------------------------------- the inside */

/** The core's shimmer: its cells across the radius, their flicker's period in model seconds, and its depth. */
export const CORE_CELLS = 12;
export const CORE_SHIMMER_S = 6 * 3_600;
export const CORE_SHIMMER = 0.25;
/** The radiative zone's slow diffusion shimmer: cells across the radius, a drift period, its depth. */
export const RADIATIVE_CELLS = 5;
export const RADIATIVE_DRIFT_S = 10 * 86_400;
export const RADIATIVE_SHIMMER = 0.12;
/** Convective plumes: columns across the radius, their radial grain and rise, km/s (a display pace), and their contrast. */
export const PLUME_COLUMNS = 16;
export const PLUME_GRAIN = 40;
export const PLUME_RISE_KMS = 0.5;
export const PLUME_RISE_RADII_PER_S = PLUME_RISE_KMS / SOLAR_RADIUS_KM;
export const PLUME_CONTRAST = 1;
/** Granules at the top of the convection zone show within this depth, radii. */
export const PLUME_GRANULE_DEPTH = 0.02;
/** The shells' gold rims: their width, radii, and strength. */
export const SHELL_RIM = 0.003;
export const SHELL_RIM_GOLD = 0.7;
/**
 * The cut face in white light is a diagram's heat, not true colour (every shell is bluer than
 * white): each shell's display colour as a blackbody temperature, K, and its light. The core
 * white-blue, the radiative zone a golden gradient from its inner to its outer edge, the
 * convection zone orange.
 */
export const CORE_DISPLAY_K = 11_000;
export const RADIATIVE_INNER_DISPLAY_K = 5_200;
export const RADIATIVE_OUTER_DISPLAY_K = 3_800;
export const CONVECTION_DISPLAY_K = 2_600;
export const CORE_LIGHT = 1.1;
export const RADIATIVE_INNER_LIGHT = 0.9;
export const RADIATIVE_OUTER_LIGHT = 0.5;
export const CONVECTION_LIGHT = 0.7;
/**
 * The faces' lighting, so the wedge has volume: a key light from the open side, yawed off the
 * wedge's bisector and raised, against an ambient floor; and an occlusion darkening into the
 * wedge's apex, over this reach of the radius and this deep.
 */
export const KEY_YAW = 0.55;
export const KEY_RISE = 0.35;
export const KEY_AMBIENT = 0.42;
export const APEX_REACH = 0.35;
export const APEX_DEPTH = 0.55;
/** The tachocline's rim catches the key light this much more than the others. */
export const RIM_KEY = 0.5;
/** The hot shells' brightness through a band, against the surface's. */
export const INTERIOR_BAND_LIGHT = 1.3;
/** The interior profile texture's samples in radius. */
export const INTERIOR_SAMPLES = 256;

/* ----------------------------------------------------------------- lights */

/** The colour ramp texture's samples. */
export const RAMP_SAMPLES = 64;
/** Each drawn layer's temperature, K: the model's own table. */
export const CHROMOSPHERE_K = TEMPERATURES.chromosphere;
export const TRANSITION_K = TEMPERATURES.transition;
export const CORONA_K = TEMPERATURES.quietCorona;
export const HOLE_K = TEMPERATURES.coronalHole;
export const ACTIVE_K = TEMPERATURES.activeRegion;
export const FLARE_K = TEMPERATURES.flare;
/**
 * A layer's plasma spans temperatures about its own: the width, dex, of the log-normal its
 * emission measure is spread over, which a band's response is convolved with. The chromosphere
 * runs up through its transition sheath, flare plasma over its decay, the corona and the
 * photosphere narrowly.
 */
export const LAYER_WIDTH_DEX = {
  photosphere: 0.05,
  chromosphere: 0.4,
  transition: 0.3,
  corona: 0.2,
  flare: 0.3,
} as const;
/**
 * The model's response curve, `response(id, kelvin)`, sampled over log₁₀ T into a texture per
 * light, one row per layer: the curve itself, then the curve convolved with each layer's
 * spread (`LAYER_WIDTH_DEX`), in the order `RESPONSE_LAYERS`.
 */
export const RESPONSE_LOG_MIN = 3.5;
export const RESPONSE_LOG_MAX = 7.5;
export const RESPONSE_SAMPLES = 128;
export const RESPONSE_LAYERS = [
  "point",
  "photosphere",
  "chromosphere",
  "transition",
  "corona",
  "flare",
] as const;
export type ResponseLayer = (typeof RESPONSE_LAYERS)[number];
/** A prominence's transition sheath: how much of the transition layer's light it carries, so it shows in He II 304. */
export const PROMINENCE_SHEATH = 0.6;
/** A band's intensity to its ramp: 1 − e^(−gain·I), the brightest layer exposed to about full scale. */
export const BAND_GAIN = 2.5;
/** The disc's components in a band: the plage and moss round regions, the network, the quiet disc. */
export const BAND_PLAGE = 1;
export const BAND_NETWORK = 0.35;
/** Flare ribbons in the hot bands, as a share of a band's full scale; the ribbons' half-separation and width in units of the region's size while no eruption says otherwise. */
export const BAND_RIBBON = 1.5;
export const RIBBON_GAP = 0.13;
export const RIBBON_SPREAD = 0.05;
/** A filament on the disc: its half-width, radii, and how dark it is against the chromosphere. */
export const FILAMENT_WIDTH = 0.012;
export const FILAMENT_DEPTH = 0.75;
/** The chromosphere's fibrils: finer mottle on the network, this many times its frequency, and its share. */
export const FIBRIL_SCALE = 5;
export const FIBRIL_SHARE = 0.4;
export const BAND_QUIET = 0.12;
/** The magnetogram's salt and pepper: the network's small bipoles, as a share of the saturation. */
export const MAGNETOGRAM_PEPPER = 0.6;
/** The magnetogram: the field at which its grey saturates (in the frame's strength units), and the dipole's share. */
export const MAGNETOGRAM_SATURATION = 0.35;
export const MAGNETOGRAM_DIPOLE = 1.2;
/** A bipole's poles on the magnetogram: their spread in units of the region's size. */
export const MAGNETOGRAM_POLE = 1;
/** Regions the shader reads at most. */
export const REGION_MAX = 12;

/* -------------------------------------------------------------- atmosphere */

/** The chromosphere's depth and the spicules' reach, radii (about 2,000 and 10,000 km), the model's figures. */
export const CHROMOSPHERE_HEIGHT = 0.003;
export const SPICULE_HEIGHT = 0.014;
/** Spicule columns round the limb, and a spicule's life in model seconds. */
export const SPICULE_COLUMNS = 1_200;
export const SPICULE_LIFETIME_S = 600;
/** The chromosphere's rim against the disc, and its spicules. */
export const CHROMOSPHERE_GLOW = 1.2;
export const SPICULE_GLOW = 0.8;
/** The rim is never thinner than this many buffer pixels. */
export const RIM_MIN_PX = 2.5;
/** The K-corona's gain against the disc (seen with the eye's compression, Baumbach's fall-off raised to `CORONA_CONTRAST`). */
export const CORONA_GLOW = 0.3;
export const CORONA_CONTRAST = 0.75;
/** The inner corona's extra glow just off the limb: its reach, radii, and strength. */
export const INNER_CORONA_REACH = 0.12;
export const INNER_CORONA_GLOW = 0.6;
/**
 * In the EUV the corona's own light falls as its density squared: the hydrostatic scale height
 * of the quiet corona, kT / (μ m_p g), halved for the square, in radii.
 */
export const EUV_SCALE_HEIGHT_R =
  (BOLTZMANN_CONSTANT * CORONA_K) /
  (CORONAL_MEAN_MOLECULAR_WEIGHT * PROTON_MASS_KG * SURFACE_GRAVITY) /
  RADIUS_M /
  2;
/** The quiet corona's share between the streamers. */
export const CORONA_FLOOR = 0.15;
/**
 * Helmet streamers over the closed field, one per high loop apex: their angular width at the
 * base (in 1 − cos), the stalk they narrow to with height, their light, and how far their tails
 * are drawn out, radii.
 */
export const STREAMER_MAX = 16;
/** A closed loop makes a streamer once its apex stands this high, radii from the centre. */
export const STREAMER_MIN_APEX = 1.25;
export const STREAMER_WIDTH = 0.05;
export const STREAMER_STALK = 0.006;
export const STREAMER_GLOW = 4;
export const STREAMER_TAIL = 2.5;
/** Coronal holes over the open field: their angular width (in 1 − cos) and depth, and the fine plumes inside them. */
export const HOLE_MAX = 8;
export const HOLE_WIDTH = 0.12;
export const HOLE_DEPTH = 0.85;
export const HOLE_FLOOR = 0.12;
export const PLUME_COUNT = 90;
export const PLUME_GLOW = 0.5;
/** Polar plumes over the dipole's caps: their width about the pole (in 1 − cos). */
export const PLUME_WIDTH = 0.12;
/** The corona's fine rays: their share of its light, and their count round the limb. */
export const RAY_SHARE = 0.25;
export const RAY_COUNT = 40;
/** The F-corona's fall-off (dust, flat) and the E-corona's reach above the limb, radii. */
export const F_CORONA_FALLOFF = 2.5;
export const E_CORONA_REACH = 0.3;
/** Fe XIV's green line, nm: the E-corona's colour. */
export const E_CORONA_NM = 530.3;
/** The transition region's and coronal loops' glow over a region: its reach, radii, and strength. */
export const LOOP_GLOW_REACH = 0.3;
export const LOOP_GLOW = 0.35;
/** A flare's flash over its region: its reach, radii, and glare. */
export const FLASH_REACH = 0.25;
export const FLASH_GLARE = 0.8;
/** The ejection's shell: its thickness as a share of its front's radius, the cavity behind it, and its glow. */
export const CME_THICKNESS = 0.1;
export const CME_CAVITY = 0.85;
export const CME_GLOW = 0.3;
/** Ray-march samples through the ejection at most. */
export const CORONA_MAX_SAMPLES = 48;

/* ------------------------------------------------------------------ names */

/**
 * A name shows only near its feature at the current scale: a disc feature once it spans this
 * many CSS px (granules by their own size, a region by its size, the photosphere within this
 * camera distance, radii); a limb feature within this many CSS px of the limb; every name set
 * off its anchor by this many px, outward from the limb.
 */
export const NAME_FEATURE_PX = 40;
export const NAME_DISC_R = 4;
export const NAME_LIMB_PX = 300;
export const NAME_OFFSET_PX = 14;

/* ---------------------------------------------------------------- ribbons */

/**
 * A ribbon: a soft core this wide, CSS px, inside a halo this wide, the core's and the halo's
 * light, and how far along an open line it has faded out, radii (the source surface), its
 * width tapering to this share on the way.
 */
export const RIBBON_WIDTH_PX = 1.8;
export const RIBBON_HALO_PX = 7;
export const RIBBON_CORE = 0.9;
export const RIBBON_HALO = 0.22;
export const OPEN_FADE_FROM = 2;
export const OPEN_FADE_TO = 2.5;
export const OPEN_TAPER = 0.35;
/** A line's strength (|B| over the polar field) is read on a log scale up to this, above a floor every line keeps. */
export const RIBBON_STRENGTH_TOP = 256;
export const RIBBON_FLOOR = 0.3;
/** How much the field shows in each light: fully in the bands and the magnetogram, a hint in an eclipse, not at all in white light or Hα. */
export const RIBBON_PRESENCE = {
  white: 0,
  halpha: 0,
  band: 1,
  eclipse: 0.15,
  magnetogram: 0.45,
} as const;
/** A ribbon's light through a band's ramp, against its full scale. */
export const RIBBON_BAND_GAIN = 0.5;
/** While an eruption's arcade draws, the rest of the field steps back to this. */
export const ERUPTION_BACKGROUND = 0.1;
/** Eruption lines a frame carries at most (the model extrudes its arcade itself, slice by slice), and points a polyline is drawn with at most. */
export const ERUPTION_MAX_LINES = 192;
/** The arcade's outer slices step back from its middle one by this per slice; the outermost `ARCADE_TRIM` slices each side are left out, and every `ARCADE_STRIDE`th line of a slice drawn. */
export const ARCADE_FALLOFF = 0.75;
export const ARCADE_TRIM = 1;
export const ARCADE_STRIDE = 2;
/** An arcade's lines as tubes: their width against a field line's, and their glow; the rope's lines glow this much more. */
export const TUBE_WIDTH = 2.4;
export const TUBE_GLOW = 1.5;
export const ROPE_GLOW = 1.8;
/** A cool line (a rope, a filament) carries a hot sheath: this share of the transition region's and the corona's light. */
export const LINE_SHEATH = 0.7;
/** A weak line is drawn this share as wide as a strong one. */
export const RIBBON_WEAK_WIDTH = 0.4;
/** In the magnetogram the lines are a soft overlay: their light against the bands'. */
export const MAGNETOGRAM_LINE = 0.3;
export const RIBBON_MAX_POINTS = 96;
/** Display seconds the eruption's scrub takes from 0 to 1 while it plays by itself. */
export const ERUPTION_PLAY_S = 40;
/** The X-point's cross: its arm, radii. */
export const XPOINT_ARM = 0.02;
/** Polarity colours (encoded sRGB): the theme's gold for positive, a cool blue for negative. */
export const POSITIVE_HEX = "#e2c07a";
export const NEGATIVE_HEX = "#6f8fff";
/** The magnetogram's grey. */
export const MAGNETOGRAM_GREY = 0.42;
/** The space background, as the theme's `space` token (encoded sRGB). */
export const SPACE_SRGB = [8 / 255, 8 / 255, 11 / 255] as const;

/**
 * Bloom on the Sun: only the brightest light glows (a flare, the limb's rim, the ejection's
 * front), in display units; a broad threshold would add light enough to clip the whole disc.
 */
export const BLOOM = { strength: 0.25, threshold: 0.86, knee: 0.1, clamp: 1.5 } as const;
/** Prominences a frame draws at most: the shared volume's. */
export const PROMINENCE_MAX = SUN_ACTIVITY_MAX_REGIONS;

/**
 * How a light is drawn: true colour (white), a band's temperature response through its ramp,
 * the disc occulted (eclipse) or the radial field (magnetogram). The shader numbers them in
 * this order (`LIGHT_*`).
 */
export const LIGHT_MODES = ["white", "band", "eclipse", "magnetogram"] as const;
export type LightMode = (typeof LIGHT_MODES)[number];

/** Each of `names` as `PREFIX_NAME: index`, for a shader's codes. */
function codes(prefix: string, names: readonly string[]) {
  return Object.fromEntries(
    names.map((name, index) => [
      `${prefix}_${name.replace(/([a-z])([A-Z])/g, "$1_$2").toUpperCase()}`,
      glslInt(index),
    ]),
  );
}

export const SHADER_DEFINES = glslDefines({
  PROXY_RADIUS,
  ATMOSPHERE_RADIUS,
  SURFACE_RESOLVE_PX,
  GRID_STEP: (GRID_STEP_DEG * Math.PI) / 180,
  GRID_ALPHA,
  PHOTOSPHERE_K,
  GRANULES_PER_RADIUS,
  NETWORK_GRANULES,
  GRANULE_CONTRAST,
  NETWORK_CONTRAST,
  UMBRA_K,
  PENUMBRA_K,
  PENUMBRA_FILAMENT,
  LEAD_SPOT,
  FOLLOW_SPOT,
  FACULA_CONTRAST,
  EVERSHED_RIPPLE,
  EVERSHED_WAVES,
  UMBRAL_DOTS,
  UMBRAL_DOT_CONTRAST,
  WHITE_FLARE_K,
  MAP_FADE_FROM_PX,
  MAP_FADE_TO_PX,
  MAP_CENTRAL_MERIDIAN_RAD,
  SUN_MAP_QUIET_INTENSITY,
  RIBBON_GLARE,
  SURFACE_EXPOSURE,
  SURFACE_CONTRAST,
  ROTATION_SIN2,
  ROTATION_SIN4,
  INTERIOR_TURN_RATIO,
  CORE_CELLS,
  CORE_SHIMMER,
  RADIATIVE_CELLS,
  RADIATIVE_SHIMMER,
  PLUME_COLUMNS,
  PLUME_GRAIN,
  PLUME_CONTRAST,
  PLUME_GRANULE_DEPTH,
  SHELL_RIM,
  SHELL_RIM_GOLD,
  CORE_DISPLAY_K,
  RADIATIVE_INNER_DISPLAY_K,
  RADIATIVE_OUTER_DISPLAY_K,
  CONVECTION_DISPLAY_K,
  CORE_LIGHT,
  RADIATIVE_INNER_LIGHT,
  RADIATIVE_OUTER_LIGHT,
  CONVECTION_LIGHT,
  KEY_YAW,
  KEY_RISE,
  KEY_AMBIENT,
  APEX_REACH,
  APEX_DEPTH,
  RIM_KEY,
  INTERIOR_BAND_LIGHT,
  INTERIOR_SAMPLES: glslInt(INTERIOR_SAMPLES),
  PROFILE_SAMPLES: glslInt(PROFILE_SAMPLES),
  CHROMOSPHERE_K,
  TRANSITION_K,
  CORONA_K,
  HOLE_K,
  ACTIVE_K,
  FLARE_K,
  LN10: Math.LN10,
  RESPONSE_LOG_MIN,
  RESPONSE_LOG_MAX,
  RESPONSE_SAMPLES: glslInt(RESPONSE_SAMPLES),
  RESPONSE_ROWS: glslInt(RESPONSE_LAYERS.length),
  ...codes("LAYER", RESPONSE_LAYERS),
  PROMINENCE_SHEATH,
  BAND_GAIN,
  BAND_PLAGE,
  BAND_NETWORK,
  BAND_RIBBON,
  RIBBON_SPREAD,
  FILAMENT_WIDTH,
  FILAMENT_DEPTH,
  FIBRIL_SCALE,
  FIBRIL_SHARE,
  BAND_QUIET,
  RAMP_SAMPLES: glslInt(RAMP_SAMPLES),
  MAGNETOGRAM_PEPPER,
  MAGNETOGRAM_SATURATION,
  MAGNETOGRAM_DIPOLE,
  MAGNETOGRAM_POLE,
  MAGNETOGRAM_GREY,
  MAGNETOGRAM_LINE,
  REGION_MAX: glslInt(REGION_MAX),
  CHROMOSPHERE_HEIGHT,
  SPICULE_HEIGHT,
  SPICULE_COLUMNS,
  CHROMOSPHERE_GLOW,
  SPICULE_GLOW,
  RIM_MIN_PX,
  CORONA_GLOW,
  CORONA_CONTRAST,
  INNER_CORONA_REACH,
  INNER_CORONA_GLOW,
  CORONA_FLOOR,
  EUV_SCALE_HEIGHT_R,
  STREAMER_MAX: glslInt(STREAMER_MAX),
  STREAMER_WIDTH,
  STREAMER_STALK,
  STREAMER_GLOW,
  STREAMER_TAIL,
  HOLE_MAX: glslInt(HOLE_MAX),
  HOLE_WIDTH,
  HOLE_DEPTH,
  HOLE_FLOOR,
  PLUME_COUNT,
  PLUME_GLOW,
  PLUME_WIDTH,
  RAY_SHARE,
  RAY_COUNT,
  F_CORONA_FALLOFF,
  E_CORONA_REACH,
  LOOP_GLOW_REACH,
  LOOP_GLOW,
  FLASH_REACH,
  FLASH_GLARE,
  CME_THICKNESS,
  CME_CAVITY,
  CME_GLOW,
  CORONA_MAX_SAMPLES: glslInt(CORONA_MAX_SAMPLES),
  RIBBON_WIDTH_PX,
  RIBBON_HALO_PX,
  RIBBON_CORE,
  RIBBON_HALO,
  OPEN_FADE_FROM,
  OPEN_FADE_TO,
  OPEN_TAPER,
  RIBBON_STRENGTH_TOP,
  RIBBON_FLOOR,
  RIBBON_BAND_GAIN,
  TUBE_GLOW,
  ROPE_GLOW,
  LINE_SHEATH,
  RIBBON_WEAK_WIDTH,
  PROMINENCE_MAX: glslInt(PROMINENCE_MAX),
  ...codes("LIGHT", LIGHT_MODES),
});

/**
 * The Sun lab's renderer numbers, once: the stage, the surface's scales and contrasts, the
 * cut's shells, the lights, the atmosphere, the eruption and the ribbons. The shaders receive
 * the visual ones as `#define`s (`npm run shaders:generate` writes
 * `graphics/parameters.generated.glsl`). Figures the model owns (the Sun's radius and
 * temperature, the rotation law) come from the shared catalogues, never retyped.
 */

import { SUN_MAP_QUIET_INTENSITY } from "@/space/solar-system/model/parameters";
import {
  CHROMOSPHERE_HEIGHT,
  FACULA_CONTRAST,
  NETWORK_GRANULES,
  PROFILE_SAMPLES,
  SPICULE_HEIGHT,
} from "@/space/sun/graphics/parameters";
import { SUN_ACTIVITY_MAX_REGIONS } from "@/space/sun/graphics/prominence/parameters";
import { MAP_CENTRAL_MERIDIAN_RAD } from "@/space/sun/model/observed";
import {
  CORONAL_MEAN_MOLECULAR_WEIGHT,
  DAY_S,
  E_CORONA_LINE_NM,
  F_CORONA_POWER,
  GRANULE_SIZE_KM,
  POLAR_FIELD_T,
  RADIUS_M,
  SPOT_FIELD_T,
  SUPERGRANULE_LIFETIME_S,
  SURFACE_GRAVITY,
  TACHOCLINE_R,
  TACHOCLINE_THICKNESS_R,
  TEMPERATURES,
} from "@/space/sun/model/parameters";
import {
  MAGNETOGRAM_GREY,
  MAGNETOGRAM_NETWORK_T,
  MAGNETOGRAM_SATURATION_T,
} from "@/space/sun/model/passbands";
import {
  INTERIOR_RATE_DEG_PER_DAY,
  SURFACE_ROTATION_DEG_PER_DAY,
} from "@/space/sun/model/rotation";
import { convectiveSpeedAt, pressureScaleHeightAt, structureAt } from "@/space/sun/model/structure";
import {
  RAD_PER_DEG,
  SOLAR_RADIUS_KM,
  SOLAR_TEFF_K,
  pressureScaleHeight,
} from "@horizon/toolkit/science";
import { glslDefines, glslInt } from "@horizon/toolkit/shaders/defines";

import spotStencil from "./graphics/spot-stencil.generated.json";

/* ------------------------------------------------------------------ stage */

/** The globe's proxy sphere, a little past the photosphere; the atmosphere's, where the corona has faded. */
export const PROXY_RADIUS = 1.02;
export const ATMOSPHERE_RADIUS = 8;
/** The camera's reach from the centre, solar radii. */
export const CAMERA_MIN_R = 1.03;
export const CAMERA_MAX_R = 12;
/** The farthest any orbit zooms out (over the eruption's ejecta), and the camera's far plane past the sky's sphere there. */
export const ORBIT_REACH_R = 3 * CAMERA_MAX_R;
export const CAMERA_FAR_R = 4 * CAMERA_MAX_R;
/**
 * Its reach from a feature it orbits (a spot group, a prominence, an active region), radii:
 * never so close that, straight over a feature on the surface, it would be inside the globe's
 * shell at CAMERA_MIN_R; nearer the surface the orbit's horizon floor keeps it out.
 */
export const FEATURE_MIN_R = CAMERA_MIN_R - 1 + 0.01;
export const FEATURE_MAX_R = 4;
/** Round a feature the camera keeps at least this elevation over the feature's horizon, radians: never under the surface. */
export const FEATURE_ELEVATION_MIN = 0.04;
/** The orbit's centre moves between the Sun's centre and a feature with this time constant, s. */
export const AIM_LAG_S = 0.8;
/**
 * About the centre a drag has its full turn from this height over the surface, radii (the disc
 * view, three radii out), and tightens nearer until, close over the surface, the ground stays
 * under the pointer.
 */
export const DRAG_FULL_HEIGHT_R = 2;
/** The wedge's half-angle when the cut is fully open: a quarter of the Sun. */
export const CUT_HALF_ANGLE = Math.PI / 4;
/** The wedge's bisector follows the camera with this time constant, s. */
export const CUT_LAG_S = 0.6;
/** Seconds the wedge takes to open or close all the way; a shorter change takes its share. */
export const CUT_TRAVEL_S = 1;
/**
 * Above this clock rate (model seconds per second) the camera rides with the body: when a
 * second carries more than ten days the spin would only strobe, and what the clock is for, the
 * cycle's drift in latitude and the field's reversal, shows on a globe that holds still.
 */
export const COROTATE_ABOVE_RATE = 10 * DAY_S;
/** How long one light gives way to the next, s. */
export const DISSOLVE_S = 0.5;
/** Latitude grid lines every this many degrees, and their strength. */
export const GRID_STEP_DEG = 15;
export const GRID_ALPHA = 0.22;

/* ---------------------------------------------------------------- surface */

/** The photosphere's effective temperature (the shared catalogue's). */
export const PHOTOSPHERE_K = SOLAR_TEFF_K;
/**
 * The measured Sun retains its spot morphology at every zoom. Fine procedural contrast
 * fades in as a map texel grows across these buffer-pixel sizes. A newly loaded map fades
 * in over MAP_FADE_IN_S seconds. Its quiet level is the solar system's.
 */
export const MAP_DETAIL_FROM_PX = 1.25;
export const MAP_DETAIL_TO_PX = 2.5;
export const MAP_FADE_IN_S = 1.2;
/**
 * A photographed patch's spots reach `reach` from its centre; past it the patch blends into the
 * quiet disc, and the photograph around a seeded group back in, out to this multiple of it.
 */
export const PHOTO_EDGE = 1.15;
/**
 * The quiet disc in the photograph, its continuum against the quiet Sun: the 5th to 95th
 * percentile of the mosaic's spot belts. A spot, a facula or their rims stand outside it; they
 * fade into it, or are carried elsewhere as their departure from it, while the quiet texture stays.
 */
/**
 * White light reads as measured this close to the photograph's epoch, model seconds: no group has
 * changed by more than about a percent of its life; after it, the disc is a model grown from it.
 */
export const PHOTO_MEASURED_S = 3600;
export const PHOTO_QUIET_LOW = 0.999;
export const PHOTO_QUIET_HIGH = 1.019;
/**
 * A photographed spot's depth runs from the quiet disc's lower edge (0) down this far below it
 * (1, an umbra). A group decays from the shallow end, its pores and penumbral rims first, and grows
 * from the deep end; the eroding edge is this soft, in depth.
 */
export const PHOTO_DEPTH_RANGE = 0.6;
export const PHOTO_ERODE_SOFT = 0.15;
export { MAP_CENTRAL_MERIDIAN_RAD, SUN_MAP_QUIET_INTENSITY };
/**
 * Display scales of the surface's features. A granule's size, the cells' lifetimes and the
 * spots' temperatures are the model's figures (`src/space/sun/model/parameters.ts`).
 */
export const GRANULES_PER_RADIUS = SOLAR_RADIUS_KM / GRANULE_SIZE_KM;
/** Granules' temperature contrast as a share of the temperature; the supergranular network's. */
export const GRANULE_CONTRAST = 0.04;
export const NETWORK_CONTRAST = 0.006;
/** A spot's umbra (the model's spot temperature) and penumbra, K, and how much darker the penumbra's dark filaments run than its bright ones, as a share. */
export const UMBRA_K = TEMPERATURES.spot;
export const PENUMBRA_K = 5_000;
export const PENUMBRA_FILAMENT = 0.16;
/** A group's leading and following spots: their radii as shares of the group's size (times the root of its strength). */
export const LEAD_SPOT = 0.42;
export const FOLLOW_SPOT = 0.28;
/** The Evershed flow's speed along the penumbra, km/s, and the ripple its filaments carry. */
export const EVERSHED_KMS = 2;
export const EVERSHED_RADII_PER_S = EVERSHED_KMS / SOLAR_RADIUS_KM;
export const EVERSHED_RIPPLE = 0.035;
export const EVERSHED_WAVES = 36;
/** Umbral-dot cell density across a spot radius and maximum fractional temperature lift; illustrative. */
export const UMBRAL_DOTS = 14;
export const UMBRAL_DOT_CONTRAST = 0.12;
/** Flare ribbons' light in white light: a hot continuum, K, and its glare as a share of the face. */
export const WHITE_FLARE_K = 9_000;
export const RIBBON_GLARE = 1.2;
/**
 * The face's exposure (below white at the disc's centre) and the display contrast its relative
 * light is raised to, so the limb's fall and the spots' darkness read on a screen as they do to
 * the eye through a filter, not as the encoded curve flattens them.
 */
export const SURFACE_EXPOSURE = 0.56;
export const SURFACE_CONTRAST = 2.2;
/** Longitude turns slower towards the poles than at the equator: the model's law's sin² and sin⁴ terms over its equatorial rate. */
const { A, B, C } = SURFACE_ROTATION_DEG_PER_DAY;
export const ROTATION_SIN2 = B / A;
export const ROTATION_SIN4 = C / A;
/** The equator's turn over a supergranule's life, radians: how far one generation of the network is carried before it is renewed. */
export const NETWORK_TURN_PER_LIFE = A * RAD_PER_DEG * (SUPERGRANULE_LIFETIME_S / DAY_S);
/** The network's generations before their patterns repeat, and the step between their patterns in noise cells. */
export const NETWORK_GENERATIONS = 32;
export const NETWORK_GENERATION_SHIFT = [7.13, 3.71, 5.37] as const;
/** The radiative interior turns rigidly at the model's rate, against the equator's. */
export const INTERIOR_TURN_RATIO = INTERIOR_RATE_DEG_PER_DAY / A;

/* ------------------------------------------------------------- the inside */

/**
 * The cut face in white light is a diagram's heat, not true colour (every shell is bluer than
 * white): Model S's temperature mapped onto display blackbody temperatures and light as power
 * laws, anchored at the photosphere and the centre, so colour and brightness change smoothly
 * with depth wherever the model's temperature does and no shell boundary is a colour step.
 */
export const FACE_TOP_DISPLAY_K = 1_600;
export const CORE_DISPLAY_K = 7_500;
export const FACE_TOP_LIGHT = 0.5;
export const CORE_LIGHT = 0.75;
const faceTop = structureAt(1);
const faceCentre = structureAt(0);
export const FACE_TOP_LN_T = Math.log(faceTop.T);
const faceLnRange = Math.log(faceCentre.T) - FACE_TOP_LN_T;
export const FACE_K_SLOPE = Math.log(CORE_DISPLAY_K / FACE_TOP_DISPLAY_K) / faceLnRange;
export const FACE_LIGHT_SLOPE = Math.log(CORE_LIGHT / FACE_TOP_LIGHT) / faceLnRange;
/** Where the light is made, the face glows this much more at the generation's peak (Model S's dL/dr). */
export const CORE_GLOW = 0.3;
/**
 * The core and radiative zone carry their light by diffusion, with no flow to draw: a fine
 * still grain, cells across the radius and its contrast, turning rigidly with them.
 */
export const INTERIOR_GRAIN_CELLS = 30;
export const INTERIOR_GRAIN = 0.1;
/**
 * The tachocline, Model S's shear layer under the convection zone: the rotation changes across
 * its thickness from the interior's rigid rate to the surface's law by latitude, drawn as thin
 * laminae parallel to the shell (it is stably stratified) that slide past one another as the
 * clock runs. Streaks per radian along the shell, laminae across its thickness, contrast.
 */
export const TACHOCLINE_THICKNESS = TACHOCLINE_THICKNESS_R;
export const TACHOCLINE_STREAKS = 7;
export const TACHOCLINE_LAMINAE = 5;
export const TACHOCLINE_CONTRAST = 0.5;
/**
 * The convection zone's cells span the mixing length, about two pressure scale heights (the
 * solar-calibrated α), so they widen with depth from granules at the top to giant cells at the
 * base. Each octave of cell size is a fixed field in the body, cross-faded by the depth's own
 * octave, so the cells grow without shearing the pattern. Downflow plumes run deeper than they
 * are wide (PLUME_STRETCH), and each octave's cells live one convective turnover, H_p / v with
 * v from the flux the shell carries.
 */
export const CELL_SCALE_HP = 2;
export const PLUME_STRETCH = 2.2;
export const CONVECTION_CONTRAST = 0.4;
/** Granules at the top of the convection zone show within this depth, radii. */
export const PLUME_GRANULE_DEPTH = 0.02;
/** The shells' gold rims: their width, radii, and strength. */
export const SHELL_RIM = 0.003;
export const SHELL_RIM_GOLD = 0.7;
/** The coarsest cell, R across: the mixing length at the convection zone's base. */
export const CONVECTION_BASE_CELL =
  (CELL_SCALE_HP * pressureScaleHeightAt(TACHOCLINE_R)) / RADIUS_M;
/** Octaves of cell size from the base's cells down to a granule's. */
export const CONVECTION_OCTAVE_COUNT =
  Math.ceil(Math.log2(CONVECTION_BASE_CELL * GRANULES_PER_RADIUS)) + 1;
/** How deep a pressure scale height (in R) lies in cell octaves: 0 at the base's cell size, 1 a size smaller. */
export const cellOctaveOf = (scaleHeight: number) =>
  Math.log2(CONVECTION_BASE_CELL / (CELL_SCALE_HP * scaleHeight));
const cellOctaveAt = (x: number) => cellOctaveOf(pressureScaleHeightAt(x) / RADIUS_M);
/**
 * Each octave: cells per radius, the radius where cells are that size, and their turnover, s.
 * A cell's swell in `giantCells` runs about CELL_SWELL_PER_LIFE of its clock per life.
 */
export const CELL_SWELL_PER_LIFE = 8;
export const CONVECTION_OCTAVES = Array.from({ length: CONVECTION_OCTAVE_COUNT }, (_, k) => {
  let lo = TACHOCLINE_R;
  let hi = 1;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (cellOctaveAt(mid) < k) lo = mid;
    else hi = mid;
  }
  const radius = (lo + hi) / 2;
  return {
    cellsPerRadius: 2 ** k / CONVECTION_BASE_CELL,
    radius,
    turnoverS: pressureScaleHeightAt(radius) / convectiveSpeedAt(radius),
  };
});
/**
 * The faces' lighting, so the wedge has volume: a key light from the open side, yawed off the
 * wedge's bisector and raised, against an ambient floor; and an occlusion darkening into the
 * wedge's apex, over this reach of the radius and this deep.
 */
export const KEY_YAW = 0.55;
export const KEY_RISE = 0.35;
export const KEY_AMBIENT = 0.55;
export const APEX_REACH = 0.35;
export const APEX_DEPTH = 0.35;
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
export const FIBRIL_SCALE = 9;
export const FIBRIL_SHARE = 0.4;
export const BAND_QUIET = 0.12;
/** A bipole's poles on the magnetogram: their spread in units of the region's size. */
export const MAGNETOGRAM_POLE = 1;
/** The following pole against the leading one: as much flux, spread wider at a lower peak (a teaching choice). */
export const MAGNETOGRAM_FOLLOW_SPREAD = 1.25;
/**
 * The network's salt-and-pepper pattern's mean |value|, sampled from the shader's noise (4×10⁵
 * points): the shader divides by it so the network's mean unsigned field is `MAGNETOGRAM_NETWORK_T`.
 */
export const MAGNETOGRAM_PEPPER_MEAN = 0.034;
/** Regions the shader reads at most, and how far a region's marks reach from its centre in its radii (the shader's and a tap's). */
export const REGION_MAX = 12;
export const REGION_REACH = 2.2;

/* -------------------------------------------------------------- atmosphere */

/** Spicule columns round the limb, and a spicule's life in model seconds. */
export const SPICULE_COLUMNS = 1_200;
export const SPICULE_LIFETIME_S = 600;
/**
 * The columns a ray grazing the limb crosses inside the spicules' reach, both sides of the plane
 * of the sky: the cells its ground track runs through, and the march's bound.
 */
const SPICULE_TRACK_CELLS =
  (2 * Math.acos(1 / (1 + SPICULE_HEIGHT))) / ((2 * Math.PI) / SPICULE_COLUMNS);
export const SPICULE_TRACK_STEPS = Math.ceil(SPICULE_TRACK_CELLS);
/**
 * The fringe's light per jet a ray meets. A grazing ray meets about eight at the base (its track's
 * cells, a jet's mean crossing of √π × 0.11 of a cell, its mean life): the forest there glows as
 * one jet did alone (a display choice).
 */
export const SPICULE_FOREST = 0.13;
/** The chromosphere's rim against the disc, and its spicules. */
export const CHROMOSPHERE_GLOW = 0.48;
export const SPICULE_GLOW = 0.45;
/** The rim is never thinner than this many buffer pixels. */
export const RIM_MIN_PX = 0.85;
/** The K-corona's gain against the disc (seen with the eye's compression, Baumbach's fall-off raised to `CORONA_CONTRAST`). */
export const CORONA_GLOW = 0.3;
export const CORONA_CONTRAST = 0.75;
/** The inner corona's extra glow just off the limb: its reach, radii, and strength. */
export const INNER_CORONA_REACH = 0.12;
export const INNER_CORONA_GLOW = 0.6;
/**
 * In the EUV the corona's own light falls as its density squared: the hydrostatic scale height
 * of the quiet corona, kT / (μ mᵤ g), halved for the square, in radii.
 */
export const EUV_SCALE_HEIGHT_R =
  pressureScaleHeight.compute({
    T: CORONA_K,
    mu: CORONAL_MEAN_MOLECULAR_WEIGHT,
    g: SURFACE_GRAVITY,
  }) /
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
/** The F-corona's fall-off (dust, flat: the model's power law). */
export const F_CORONA_FALLOFF = F_CORONA_POWER;
/**
 * Fe XIV's green line against the K-corona's gain at the limb: drawn so it can be seen (in
 * broadband, as the eye takes an eclipse, it is far fainter), a teaching choice the legend states.
 */
export const E_CORONA_GLOW = 0.14;
/** Fe XIV's green line, nm: the E-corona's colour (the model's line). */
export const E_CORONA_NM = E_CORONA_LINE_NM;
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
/** Display width of the hot current-sheet emission, R; not the microscopic resistive layer. */
export const CURRENT_SHEET_WIDTH_R = 0.0015;
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
  MAP_DETAIL_FROM_PX,
  MAP_DETAIL_TO_PX,
  PHOTO_EDGE,
  PHOTO_QUIET_LOW,
  PHOTO_QUIET_HIGH,
  PHOTO_DEPTH_RANGE,
  PHOTO_ERODE_SOFT,
  MAP_CENTRAL_MERIDIAN_RAD,
  SUN_MAP_QUIET_INTENSITY,
  STENCIL_WIDTH: spotStencil.width,
  STENCIL_HEIGHT: spotStencil.height,
  STENCIL_TILE: spotStencil.tile,
  STENCIL_GUTTER: spotStencil.gutter,
  STENCIL_ATLAS_WIDTH: spotStencil.atlasWidth,
  STENCIL_ATLAS_HEIGHT: spotStencil.atlasHeight,
  STENCIL_PENUMBRA_RANGE: spotStencil.penumbraRange,
  STENCIL_UMBRA_RANGE: spotStencil.umbraRange,
  RIBBON_GLARE,
  SURFACE_EXPOSURE,
  SURFACE_CONTRAST,
  ROTATION_SIN2,
  ROTATION_SIN4,
  NETWORK_TURN_PER_LIFE,
  NETWORK_GENERATIONS,
  NETWORK_GENERATION_SHIFT,
  INTERIOR_TURN_RATIO,
  PLUME_GRANULE_DEPTH,
  FACE_TOP_DISPLAY_K,
  FACE_TOP_LIGHT,
  FACE_TOP_LN_T,
  FACE_K_SLOPE,
  FACE_LIGHT_SLOPE,
  CORE_GLOW,
  INTERIOR_GRAIN_CELLS,
  INTERIOR_GRAIN,
  TACHOCLINE_THICKNESS,
  TACHOCLINE_STREAKS,
  TACHOCLINE_LAMINAE,
  TACHOCLINE_CONTRAST,
  PLUME_STRETCH,
  CONVECTION_CONTRAST,
  CONVECTION_OCTAVE_COUNT: glslInt(CONVECTION_OCTAVE_COUNT),
  SHELL_RIM,
  SHELL_RIM_GOLD,
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
  MAGNETOGRAM_SATURATION_T,
  MAGNETOGRAM_NETWORK_T,
  SPOT_FIELD_T,
  POLAR_FIELD_T,
  MAGNETOGRAM_POLE,
  MAGNETOGRAM_FOLLOW_SPREAD,
  MAGNETOGRAM_PEPPER_MEAN,
  MAGNETOGRAM_GREY,
  MAGNETOGRAM_LINE,
  REGION_MAX: glslInt(REGION_MAX),
  REGION_REACH,
  CHROMOSPHERE_HEIGHT,
  SPICULE_HEIGHT,
  SPICULE_COLUMNS,
  SPICULE_TRACK_STEPS: glslInt(SPICULE_TRACK_STEPS),
  SPICULE_FOREST,
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
  E_CORONA_GLOW,
  LOOP_GLOW_REACH,
  LOOP_GLOW,
  FLASH_REACH,
  FLASH_GLARE,
  CME_THICKNESS,
  CME_CAVITY,
  CME_GLOW,
  CURRENT_SHEET_WIDTH_R,
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

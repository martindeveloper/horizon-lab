import { SOLAR_MEAN_MOLECULAR_WEIGHT } from "@/space/solar-composition";
import {
  CHROMOSPHERE_HEIGHT,
  FACULA_CONTRAST,
  NETWORK_GRANULES,
  PROFILE_SAMPLES,
  SPICULE_HEIGHT,
} from "@/space/sun/graphics/parameters";
import { JOY_SLOPE } from "@/space/sun/model/parameters";
import { SURFACE_ROTATION_DEG_PER_DAY } from "@/space/sun/model/rotation";
import type { PlanetId } from "@horizon/toolkit/bodies";
import {
  BOLTZMANN_CONSTANT,
  PLANCK_CONSTANT,
  SHADOW_PER_RS,
  SPEED_OF_LIGHT,
  WATER_DENSITY_KG_M3,
} from "@horizon/toolkit/science";
import { glslDefines, glslInt } from "@horizon/toolkit/shaders/defines";

import { OUTFLOW_SLOTS } from "./model/mass-loss";
import { RUNG_IDS } from "./model/rungs";

/**
 * Giants' model numbers, once. The physics computes with them, the shader receives the visual
 * ones as `#define`s (`npm run shaders:generate` writes `graphics/parameters.generated.glsl`)
 * and the technical notes quote them, so the three cannot disagree.
 */

/**
 * Mean mass per particle of a star's photosphere in atomic mass units: the Sun's neutral gas
 * (`SOLAR_MEAN_MOLECULAR_WEIGHT`), for every star. A teaching choice for the scale height that
 * sizes the granules.
 */
export const MEAN_MOLECULAR_WEIGHT = SOLAR_MEAN_MOLECULAR_WEIGHT;
/** A convection cell spans about this many pressure scale heights (the Sun's: ~1,000 km over ~150 km). */
export const GRANULE_SCALE_HEIGHTS = 8;
/** A teaspoon, m³. */
export const TEASPOON_M3 = 5e-6;
/** Water (the kit's) and sea-level air (20 °C), kg/m³: what a card compares a star's mean density with. */
export const WATER_DENSITY = WATER_DENSITY_KG_M3;
export const AIR_DENSITY = 1.204;

/** The planets whose orbits are drawn around a star in the Sun's place, at their mean distances. */
export const ORBIT_IDS = [
  "mercury",
  "venus",
  "earth",
  "mars",
  "jupiter",
  "saturn",
] as const satisfies readonly PlanetId[];
export type OrbitId = (typeof ORBIT_IDS)[number];
/**
 * An orbit's line over a bright face: the gold's strength, and a dark casing either side (its
 * reach from the ring, CSS px, and how far it darkens what lies under it), so the line reads
 * across a star's face as it does on the sky.
 */
export const ORBIT_LINE_ALPHA = 0.9;
export const ORBIT_CASE_PX = 2.6;
export const ORBIT_CASE_DEPTH = 0.55;
/** An orbit is named once its ring is this wide, CSS px, and a label's height outside the last one named on its side. */
export const ORBIT_LABEL_MIN_PX = 22;
export const ORBIT_LABEL_GAP_PX = 16;

/* ---------------------------------------------------------------- the stage */

/** A focused body's diameter as a share of the stage's height (and at most this share of its width). */
export const FRAME_FILL = 0.44;
export const FRAME_FILL_WIDTH = 0.62;
/** The horizon line, as a share of the stage's height from its top. */
export const HORIZON_Y = 0.7;
/** How fast the horizon eases above a sheet over the stage's foot and back, per second. */
export const HORIZON_LIFT_RATE = 6;
/** The gap before a body, as a share of its radius: its smaller neighbour stands just left of it. */
export const RUNG_GAP = 0.38;
/** Discs the shader draws at most; the engine sends the largest in view, the focused one always. */
export const MAX_DISCS = 16;
/** Smallest radius drawn, CSS pixels: anything smaller shows as a point this size. */
export const MIN_DISC_PX = 0.6;
/**
 * The overview (`overview.ts`): every body at once, a dot plot of radius on a log axis, a row
 * each, the bodies' names in a column down the left. Where that column ends, CSS px from the
 * stage's left, wide enough for the longest name in either language: on a stage narrower than
 * `OVERVIEW_NARROW_PX` the names are set smaller (`styles.css`) and the column narrows. The
 * axis's inset from the column and its margin from the stage's right, room for the largest dot
 * and the last value, CSS px; the top row's clearance from the stage's top, past the site's
 * header and the lab's toolbar, and the room under the axis for its values and title, above the
 * dock, CSS px; a dot's radius from the smallest body's to the largest's, CSS px, by the log of
 * the radius, and at most this share of a row; the gap a name's leader leaves before its dot,
 * CSS px (the name's own padding leaves the other); the selected body's ring, CSS px out from
 * its dot.
 */
export const OVERVIEW_NAMES_PX = 148;
export const OVERVIEW_NAMES_NARROW_PX = 116;
export const OVERVIEW_NARROW_PX = 640;
export const OVERVIEW_AXIS_INSET_PX = 16;
export const OVERVIEW_MARGIN_PX = 48;
export const OVERVIEW_TOP_PX = 104;
export const OVERVIEW_FOOT_PX = 44;
export const OVERVIEW_DOT_PX = [2.5, 9] as const;
export const OVERVIEW_ROW_FILL = 0.42;
export const OVERVIEW_LABEL_GAP_PX = 4;
export const OVERVIEW_RING_PX = 3.5;
/**
 * The glide into the overview and back, s, and the share of it over which the bodies' full
 * surfaces hand over to the overview's flat dots (`giants.frag.glsl`).
 */
export const OVERVIEW_SECONDS = 1.4;
export const OVERVIEW_SWAP = 0.35;
/**
 * Side by side (`pair.ts`): how long the stage takes to change, the bodies that stay gliding to
 * their new places while the others slide off or on, s; and the radius, CSS px, below which the
 * smaller body is marked by a ring so it is never lost beside the larger.
 */
export const RESTAGE_SECONDS = 0.8;
/**
 * The share of a stage change over which a body that leaves gives up its far-reaching light (a
 * black hole's ring and lensing, which can surround the whole view) before it has moved much,
 * and one that comes takes it up once it has nearly arrived; one that stays keeps it.
 */
export const RESTAGE_LIGHT_SHARE = 0.3;
export const PAIR_MARKER_PX = 6;
/** A row a mouse is over: how much its dot grows, CSS px, and how long it takes, s. */
export const OVERVIEW_HOVER_PX = 3;
export const OVERVIEW_HOVER_SECONDS = 0.15;
/** A dot's limb darkening, every star's: a linear law with the Sun's visible coefficient, a sketch rather than a surface. */
export const OVERVIEW_LIMB = 0.6;
/**
 * The camera's glide from one rung to the next, s, and how much longer a flight takes for each
 * doubling of the rungs it crosses (`glide.ts`).
 */
export const GLIDE_SECONDS = 1.1;
export const GLIDE_SECONDS_PER_DOUBLING = 0.45;
/** Seconds a resumed drift takes to carry the camera from where the visitor left it back onto its path. */
export const DRIFT_RESUME_S = 4;
/** A wheel's 100 px step moves the camera this many rungs; a drag of a stage height, this many. */
export const WHEEL_RUNGS = 0.32;
export const DRAG_RUNGS = 3.2;
/** Quiet time after the last wheel step before the camera snaps to the nearest rung, ms. */
export const SNAP_DELAY_MS = 160;
/**
 * A hand turning a globe (`grab.ts`): the smallest radius, CSS px, worth grabbing (smaller
 * bodies let the drag climb instead); how long a flick keeps it turning (the time its speed
 * takes to fall by e, s); how long it holds the pose the hand left before going home, s; and
 * the pace of that return (the time it takes to cover all but 1/e of the way, s).
 */
export const GRAB_MIN_PX = 24;
export const GRAB_COAST_S = 0.45;
export const GRAB_HOLD_S = 2.5;
export const GRAB_RETURN_S = 0.9;

/**
 * Representative wavelength for the brown dwarf's small cloud-contrast approximation.
 * Surface colour and brightness themselves use the CIE-integrated continuum lookup.
 */
export const VISIBLE_NM = 550;
/** hc / (k λ) at that wavelength, K: the exponent's scale in Planck's law. */
export const PLANCK_KELVIN =
  (PLANCK_CONSTANT * SPEED_OF_LIGHT) / (BOLTZMANN_CONSTANT * VISIBLE_NM * 1e-9);
/**
 * The light round a star is drawn in its face's own colours: the light of a surface at a share
 * of the face's temperature, which Planck's law makes redder and dimmer the cooler it is. The
 * face itself (a hot star's wind, a pulsar's beams, the corona); a radius known only to a
 * spread, its veil; the soft glow every star has; a supergiant's plumes; the shell or wind seen
 * over the face towards the limb; a cool supergiant's molecular shell and dust beyond it. The
 * shader numbers them in this order (`TINT_*`).
 */
export const TINTS = ["face", "veil", "glow", "plume", "haze", "dust"] as const;
export type Tint = (typeof TINTS)[number];
export const TINT_SHARES: Readonly<Record<Tint, number>> = {
  face: 1,
  veil: 0.9,
  glow: 0.87,
  plume: 0.76,
  haze: 0.71,
  dust: 0.68,
};
/** A red supergiant's mass where none is published, M☉: only to size its convection cells. */
export const SUPERGIANT_MASS = 15;
/** Granules' temperature contrast: a few per cent when there are hundreds, more for a handful. */
export const CELL_CONTRAST_FINE = 0.035;
export const CELL_CONTRAST_GIANT = 0.065;
/** Red-supergiant broad temperature variations dominate the much fainter fine turbulence. */
export const GIANT_CONTRAST = 0.09;
export const GIANT_FINE_CONTRAST = 0.012;
/** Spicule columns around a circumference (~0.002 radians apart), independent of zoom/DPR. */
export const SPICULE_COLUMNS = 3_142;
/**
 * A spot's umbra and penumbra are this much cooler than the surface, as a share of its
 * temperature (the Sun's: about 4,000 K and 5,200 K against 5,772 K).
 */
export const UMBRA_DEPTH = 0.31;
export const PENUMBRA_DEPTH = 0.1;
/**
 * The supergranules' network's contrast as a share of the temperature (its scale is the shared
 * `NETWORK_GRANULES`), a teaching exaggeration of white light's faint network so the scale shows.
 */
export const NETWORK_CONTRAST = 0.03;
/**
 * Red supergiants also carry a few giant cells as deep as their envelopes (Schwarzschild 1975;
 * Chiavassa et al. 2010), this many across the radius.
 */
export const DEEP_CELLS = 2.6;
/** A supergiant's dust veil dims the face behind it by up to this share (Betelgeuse's Great Dimming: about two thirds). */
export const VEIL_DEPTH = 0.6;
/** Conservative illustrative optical-surface relief; no measured shape is implied. */
export const LIMB_ROUGHNESS = 0.02;
/**
 * The most the shader's `gradientFbm3` can reach either way: each octave mixes its cell's
 * corners' g · (f − o), gradients' components within ±1, and along each axis those weights
 * bring at most ½ (in the cell's middle), so at most 3 × ½; the octaves' weights sum to 1. A
 * lumpy limb's bumps reach at most this many times its roughness.
 */
export const GRADIENT_FBM_BOUND = 1.5;
/**
 * The soft light round every star's limb, its fall-off per radius beyond the limb, and the tone
 * curve's exposure: low enough that a face's centre stays below white, so its limb shows.
 */
export const GLOW = 0.14;
export const GLOW_FALLOFF = 14;
/**
 * How far a star's light reaches past its radius, radii: its soft glow, or a wind or shell. A
 * body is drawn while any of its light is on the stage, so nothing pops in at the edge.
 */
export const GLOW_REACH = 1.4;
export const ENVELOPE_REACH = 2.6;
export const EXPOSURE = 0.92;
/** Where the tone curve stops being linear and rolls off towards white. */
export const SHOULDER = 0.62;
/**
 * Colour saturation on screen: a star's colour reads paler on a screen than against the black
 * sky, so it is lifted a little (1: as computed).
 */
export const SATURATION = 1.15;
/** How far a face's brightest light whitens towards the top of the curve, as film's does. */
export const HIGHLIGHT_WHITE = 0.6;
/** The faint large-scale mottling of a hot star's face with no pulsation of note. */
export const RADIATIVE_MOTTLE = 0.02;
/** A radius known only to a spread: the veil drawn out to the top of it, at its densest. */
export const SPREAD_VEIL = 0.035;
/** The faint baseline the bodies stand on. */
export const BASELINE_ALPHA = 0.16;
/**
 * What a surface is: a star with a convective envelope (granules), a hot star whose envelope
 * carries its heat by radiation (smooth), a white dwarf, a pulsar with hot polar caps, a brown
 * dwarf's cloud bands, Earth and Jupiter from their measured maps, or a horizon. The shader
 * numbers them in this order (`STYLE_*`).
 */
export const STYLES = [
  "convective",
  "radiative",
  "whiteDwarf",
  "pulsar",
  "brownDwarf",
  "earth",
  "jupiter",
  "horizon",
] as const;
export type Style = (typeof STYLES)[number];

/** Seconds per turn on screen, by surface: display paces, far faster than the real ones. */
export const SPIN_SECONDS: Readonly<Record<Style, number>> = {
  convective: 140,
  radiative: 110,
  whiteDwarf: 40,
  pulsar: 2.5,
  brownDwarf: 30,
  earth: 70,
  jupiter: 45,
  horizon: 0,
};
/* ------------------------------------------------------------ the weather */

/**
 * The weather of the star the camera rests on wakes over this long once the camera is within
 * `WEATHER_NEAR` of a rung of it and heading there, and quietens over this long when it leaves, s.
 */
export const WEATHER_NEAR = 0.15;
export const WEATHER_FADE_IN_S = 1.8;
export const WEATHER_FADE_OUT_S = 0.7;
/** Active regions, prominences (or plumes), post-flare loops and ejections drawn at most. */
export const REGIONS = 4;
export const SHEETS = 3;
/** Columns a prominence is drawn with round the limb, and points along a post-flare loop. */
export const SHEET_POINTS = 10;
export const ARCADES = 2;
export const LOOPS_PER_ARCADE = 3;
export const LOOPS = ARCADES * LOOPS_PER_ARCADE;
export const LOOP_POINTS = 7;
export const EJECTIONS = 2;
/** An active region's life on screen, s: a display pace (the Sun's last weeks to months). */
export const REGION_SECONDS = 110;
/** A flare's rise and decay, s: display paces in the observed proportion (minutes, then an hour). */
export const FLARE_RISE_S = 0.8;
export const FLARE_DECAY_S = 6.5;
/**
 * A flare's light, loops and glare run their course within this share of the window it broke
 * out in, so no more than two are ever lit at once and each fades out rather than being
 * dropped (consecutive flares stand at least 0.3 of a window apart).
 */
export const FLARE_LIFE_SHARE = 0.6;
/** After an eruption, its prominence re-forms over this long, s (a filament's days, on screen). */
export const PROMINENCE_REGROW_S = 40;
/** Every this many flares, one is big. */
export const BIG_FLARE_EVERY = 3;
/** Its loops brighten this long after it, as the heated plasma cools into view. */
export const LOOP_DELAY_S = 2.5;
/**
 * How much slower a surface turns at its poles than at its equator: Ω(φ) = Ω₀ (1 − k sin² φ),
 * the Sun's k (its law's sin² term over its equatorial rate), for every convective star.
 */
export const DIFFERENTIAL_ROTATION =
  -SURFACE_ROTATION_DEG_PER_DAY.B / SURFACE_ROTATION_DEG_PER_DAY.A;
/** A spot group's tilt towards the equator per radian of latitude: the Sun's Joy's law. */
export const JOY_TILT = JOY_SLOPE;
/**
 * An ejection: a flare at least this share of its star's peak, within this far of the limb
 * (|z| of its region), lifts its prominence away; the front leaves at this many radii a
 * second, speeds up, and fades out by this distance. Its prominence rises e-fold in
 * `ERUPTION_SECONDS`.
 */
export const ERUPTING_FLARE = 0.55;
export const LIMB_ERUPTION = 0.6;
export const EJECTION_SPEED = 0.16;
export const EJECTION_ACCELERATION = 0.035;
export const EJECTION_REACH = 6;
export const ERUPTION_SECONDS = 2.2;

/**
 * Light of the weather against a face's centre: the corona at the limb, seen with the eye's
 * compression (its fall-off is Baumbach's, raised to `CORONA_CONTRAST`), and how far out it is
 * drawn, radii; the chromosphere's rim, a prominence, a flare's ribbons and its loops, an
 * ejection's front and the glare of a flare.
 */
export const CORONA = 0.09;
export const CORONA_CONTRAST = 0.55;
export const CORONA_REACH = 4;
export const CHROMOSPHERE = 0.32;
export const PROMINENCE = 0.5;
export const RIBBON = 1.4;
export const LOOP_GLOW = 0.8;
export const EJECTION_GLOW = 0.16;
export const FLASH_GLARE = 0.35;
/** A flare's white light is a hot continuum, about this warm, K. */
export const FLARE_K = 9_000;
/**
 * Prominences and the chromosphere glow in the Balmer lines, Hα with Hβ and Hγ: the pink of an
 * eclipse (encoded sRGB).
 */
export const BALMER_SRGB = [1, 0.33, 0.42] as const;
/**
 * A hot supergiant's wind and a red supergiant's molecular shell and dust, against the face:
 * how bright `haze` 1 glows just past the limb.
 */
export const WIND_GLOW = 0.16;
export const ENVELOPE_GLOW = 0.4;
/**
 * A pulsar's magnetic axis, tipped from its spin axis, radians; its beams' glow, and how far
 * they reach before they have faded out, radii.
 */
export const PULSAR_TILT = 0.55;
export const BEAM_GLOW = 0.5;
export const BEAM_REACH = 4.5;

/* ------------------------------------------------------------ black holes */

/**
 * The photon ring's line width, as a share of the horizon radius (it is never drawn thinner
 * than a pixel), the reach of the softer glow round it, horizon radii, and how much brighter
 * it is on one side. These are display choices, not a fit to EHT's broad emission ring
 * or a prediction of the unresolved narrow photon ring's brightness and width.
 */
export const HOLE_RING_WIDTH = 0.012;
export const HOLE_RING_GLOW = 0.12;
export const HOLE_RING_BEAMING = 0.5;
/** The horizon's rim, against the accent; how far a hole's light reaches, horizon radii. */
export const HOLE_RIM = 0.45;
export const HOLE_REACH = SHADOW_PER_RS + 6 * HOLE_RING_GLOW;
/**
 * The stars behind a hole are lensed as by a point mass, β = θ − θ_E²/θ. Seen from a distance D
 * (here the black-hole lab's close views, 32 GM/c²), the Einstein ring of stars far behind
 * stands at b_E = √(2 D r_s) in the hole's plane; the bending is drawn out to three times that.
 */
export const LENS_DISTANCE = 16;
export const LENS_EINSTEIN = Math.sqrt(2 * LENS_DISTANCE);
export const LENS_REACH = 3 * LENS_EINSTEIN;
/**
 * The ladder sets bodies side by side for comparison, not where they are, so a hole bends the
 * stars only round its own stretch of the ladder: fully with the camera within `LENS_FULL`
 * rungs of it, not at all by `LENS_GONE`, easing between. The black holes on the ladder.
 */
export const LENS_FULL = 1;
export const LENS_GONE = 2;
export const LENSES = 4;

/** The display temperature of a surface with no catalogued one (a pulsar's, a brown dwarf's), K. */
export const PULSAR_DISPLAY_K = 40_000;
export const BROWN_DWARF_DISPLAY_K = 1_250;
/**
 * What a brown dwarf's sodium and potassium leave of its light, red, green and blue: their
 * broad lines take the yellow and green, so it looks magenta (Burrows et al. 2001).
 */
export const BROWN_DWARF_ALKALI = [1, 0.5, 0.8] as const;

/** A list's entries as the shader numbers them: `PREFIX_ENTRY` for each, in order. */
const codes = (prefix: string, names: readonly string[]) =>
  Object.fromEntries(
    names.map((name, code) => [
      `${prefix}_${name.replace(/[A-Z]/g, (c) => `_${c}`).toUpperCase()}`,
      glslInt(code),
    ]),
  );

export const SHADER_DEFINES = glslDefines({
  MAX_DISCS: glslInt(MAX_DISCS),
  DOTS: glslInt(RUNG_IDS.length),
  OVERVIEW_LIMB,
  OVERVIEW_RING_PX,
  ORBIT_COUNT: glslInt(ORBIT_IDS.length),
  ORBIT_LINE_ALPHA,
  ORBIT_CASE_PX,
  ORBIT_CASE_DEPTH,
  PLANCK_KELVIN,
  PROFILE_SAMPLES: glslInt(PROFILE_SAMPLES),
  SPICULE_COLUMNS: glslInt(SPICULE_COLUMNS),
  REGIONS: glslInt(REGIONS),
  SHEETS: glslInt(SHEETS),
  SHEET_POINTS: glslInt(SHEET_POINTS),
  ARCADES: glslInt(ARCADES),
  LOOPS: glslInt(LOOPS),
  LOOP_POINTS: glslInt(LOOP_POINTS),
  EJECTIONS: glslInt(EJECTIONS),
  CELL_CONTRAST_FINE,
  CELL_CONTRAST_GIANT,
  GIANT_CONTRAST,
  GIANT_FINE_CONTRAST,
  OUTFLOW_SLOTS: glslInt(OUTFLOW_SLOTS),
  UMBRA_DEPTH,
  PENUMBRA_DEPTH,
  FACULA_CONTRAST,
  NETWORK_GRANULES,
  NETWORK_CONTRAST,
  DEEP_CELLS,
  LIMB_ROUGHNESS,
  VEIL_DEPTH,
  GLOW,
  GLOW_FALLOFF,
  GLOW_REACH,
  ENVELOPE_REACH,
  EXPOSURE,
  SHOULDER,
  SATURATION,
  HIGHLIGHT_WHITE,
  RADIATIVE_MOTTLE,
  BASELINE_ALPHA,
  SPREAD_VEIL,
  CORONA,
  CORONA_CONTRAST,
  CORONA_REACH,
  CHROMOSPHERE,
  PROMINENCE,
  RIBBON,
  LOOP_GLOW,
  EJECTION_GLOW,
  EJECTION_REACH,
  FLASH_GLARE,
  FLARE_K,
  CHROMOSPHERE_HEIGHT,
  SPICULE_HEIGHT,
  WIND_GLOW,
  ENVELOPE_GLOW,
  PULSAR_TILT,
  BEAM_GLOW,
  BEAM_REACH,
  /* The schematic shadow's edge, horizon radii: the critical impact parameter (the science kit's). */
  HOLE_SHADOW: SHADOW_PER_RS,
  HOLE_RING_WIDTH,
  HOLE_RING_GLOW,
  HOLE_RING_BEAMING,
  HOLE_RIM,
  HOLE_REACH,
  LENS_EINSTEIN,
  LENS_REACH,
  LENSES: glslInt(LENSES),
  GRADIENT_FBM_BOUND,
  TINT_COUNT: glslInt(TINTS.length),
  /* Surface styles (`looks.ts`) and the tints (`graphics/tints.ts`). */
  ...codes("STYLE", STYLES),
  ...codes("TINT", TINTS),
});

/** Frames a second while the camera rests and only the stars move. */
export const IDLE_FPS = 30;
/**
 * The planets' orbits come in round the body the camera lands on and go as it leaves
 * (`orbit-rings.ts`): over these many seconds, each ring starting this share of the way after
 * the one inside it (and going this share before it), and growing into place from this share
 * smaller.
 */
export const ORBIT_FADE_IN_S = 1.1;
export const ORBIT_FADE_OUT_S = 0.5;
export const ORBIT_STAGGER = 0.1;
export const ORBIT_GROW = 0.06;

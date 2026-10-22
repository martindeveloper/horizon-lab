import type { PlanetId } from "@horizon/toolkit/bodies";
import {
  BOLTZMANN_CONSTANT,
  PLANCK_CONSTANT,
  SHADOW_PER_RS,
  SPEED_OF_LIGHT,
} from "@horizon/toolkit/science";
import { glslDefines, glslInt } from "@horizon/toolkit/shaders/defines";

import { OUTFLOW_SLOTS } from "./model/mass-loss";

/**
 * Giants' model numbers, once. The physics computes with them, the shader receives the visual
 * ones as `#define`s (`npm run shaders:generate` writes `graphics/parameters.generated.glsl`)
 * and the technical notes quote them, so the three cannot disagree.
 */

/**
 * Mean mass per particle of a star's photosphere in atomic mass units: neutral hydrogen with
 * the Sun's share of helium. A teaching choice for the scale height that sizes the granules.
 */
export const MEAN_MOLECULAR_WEIGHT = 1.3;
/** A convection cell spans about this many pressure scale heights (the Sun's: ~1,000 km over ~150 km). */
export const GRANULE_SCALE_HEIGHTS = 8;
/** A teaspoon, m³. */
export const TEASPOON_M3 = 5e-6;
/** Water and sea-level air (20 °C), kg/m³: what a card compares a star's mean density with. */
export const WATER_DENSITY = 1_000;
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
/** The gap before a body, as a share of its radius: its smaller neighbour stands just left of it. */
export const RUNG_GAP = 0.38;
/** Discs the shader draws at most; the engine sends the largest in view, the focused one always. */
export const MAX_DISCS = 16;
/** Smallest radius drawn, CSS pixels: anything smaller shows as a point this size. */
export const MIN_DISC_PX = 0.6;
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
 * Stars cooler than this carry their heat to the surface by convection, so their faces boil
 * with granules; hotter ones are radiative and smooth (about the F-type stars' boundary).
 */
export const CONVECTIVE_BELOW_K = 7_000;
/**
 * Representative wavelength for the brown dwarf's small cloud-contrast approximation.
 * Surface colour and brightness themselves use the CIE-integrated continuum lookup.
 */
export const VISIBLE_NM = 550;
/** hc / (k λ) at that wavelength, K: the exponent's scale in Planck's law. */
export const PLANCK_KELVIN =
  (PLANCK_CONSTANT * SPEED_OF_LIGHT) / (BOLTZMANN_CONSTANT * VISIBLE_NM * 1e-9);
/** CIE/Planck continuum lookup and atmosphere/latitude tables, sampled at texel centres. */
export const SPECTRUM_MIN_K = 500;
export const SPECTRUM_MAX_K = 100_000;
export const SPECTRUM_SAMPLES = 384;
export const PROFILE_SAMPLES = 129;
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
/** Resolve cells only above 2–4 drawing-buffer pixels, including foreshortening. */
export const SURFACE_RESOLVE_PX = 2;
/** Spicule columns around a circumference (~0.002 radians apart), independent of zoom/DPR. */
export const SPICULE_COLUMNS = 3_142;
/**
 * A spot's umbra and penumbra are this much cooler than the surface, as a share of its
 * temperature (the Sun's: about 4,000 K and 5,200 K against 5,772 K).
 */
export const UMBRA_DEPTH = 0.31;
export const PENUMBRA_DEPTH = 0.1;
/** Faculae round an active region: this much hotter where they show best, at the limb. */
export const FACULA_CONTRAST = 0.09;
/**
 * The supergranules' network: each supergranule about 30 granules across (30,000 km against
 * 1,000 km on the Sun), and its contrast as a share of the temperature, a teaching
 * exaggeration of white light's faint network so the scale shows.
 */
export const NETWORK_GRANULES = 30;
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
 * the Sun's k (Snodgrass & Ulrich 1990), for every convective star.
 */
export const DIFFERENTIAL_ROTATION = 0.19;
/** A spot group's tilt towards the equator per radian of latitude (Joy's law, about ½). */
export const JOY_TILT = 0.5;
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
 * Solar-inspired chromosphere depth and spicule reach, in stellar radii. On the Sun these
 * correspond to about 2,000 km and 10,000 km; other stars use this illustrative scaling.
 */
export const CHROMOSPHERE_HEIGHT = 0.003;
export const SPICULE_HEIGHT = 0.014;
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
  ORBIT_COUNT: glslInt(ORBIT_IDS.length),
  ORBIT_LINE_ALPHA,
  ORBIT_CASE_PX,
  ORBIT_CASE_DEPTH,
  PLANCK_KELVIN,
  SPECTRUM_MIN_K,
  SPECTRUM_MAX_K,
  SPECTRUM_SAMPLES: glslInt(SPECTRUM_SAMPLES),
  PROFILE_SAMPLES: glslInt(PROFILE_SAMPLES),
  SURFACE_RESOLVE_PX,
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

/** The stage's colours, as the theme's `space` and `solar` tokens (encoded sRGB). */
export const SPACE_SRGB = [8 / 255, 8 / 255, 11 / 255] as const;
export const ACCENT_SRGB = [226 / 255, 192 / 255, 122 / 255] as const;
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

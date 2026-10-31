/**
 * Afterglow's numbers, once: the clock's pace, the world changes, the orbit the view is taken from,
 * where the Sun stands in the view, the display's exposure, and the shader's constants.
 */
import { PROFILE_SAMPLES } from "@/space/sun/graphics/parameters";
import { AU_KM, SOLAR_RADIUS_KM } from "@horizon/toolkit/science";
import { glslDefines, glslInt } from "@horizon/toolkit/shaders/defines";

/** Seconds the clock takes to ease to an age it is sent to (a chapter, a guide step). */
export const AGE_FLIGHT_S = 1.6;
/**
 * Seconds a move to another world takes when the timeline is scrubbed: the camera stays where
 * it is (each orbit stands as many of its world's radii up, so the limb keeps its place on the
 * screen) and the last view of the old world dissolves into the new one.
 */
export const VANTAGE_FADE_S = 1.4;
/** The clock's tempo as a dissolve begins, easing back to the chapter's: the Sun holds nearly still while the world changes. */
export const FADE_TEMPO = 0.15;
/**
 * Seconds a flight from one world to the next takes as the clock runs or a world is chosen
 * (`model/flight.ts`): backing off one world, the crossing and closing on the next; and the clock's tempo at its
 * middle: slowed, so the view's travel leads, never so far that the Sun stops changing.
 */
export const FLIGHT_S = 8;
export const FLIGHT_TEMPO = 0.4;
/** Seconds the drift's flights take: a slow voyage, the lean-back mode's (`modes.ts`). */
export const DRIFT_FLIGHT_S = 14;
/**
 * The world turns under the camera while the clock runs, so its surface and air drift slowly
 * past the limb: this many degrees of its longitude a second, whatever the world (a visual
 * pace, not its day, which the clock's millions of years a second would blur), taken up and
 * let go over about this many seconds as the clock starts and stops.
 */
export const SPIN = { degPerS: 0.25, easeS: 1.5 } as const;
/**
 * Where a flight's worlds are points, as shares of the view from its top left: the world left
 * shrinks away low on the Sun's left, the next first shows low on its right, a little under the
 * limb's place at rest so either clears a giant's disc in a landscape view.
 */
export const FLIGHT_POINTS = {
  leave: { across: 0.3, down: 0.74 },
  arrive: { across: 0.9, down: 0.74 },
} as const;
/** A flight's world is gone once its globe is this many pixels across: the far end of backing off and of closing in. */
export const VANISH_PX = 1;

/**
 * The orbit the view is taken from, in the world's radii from its centre: low, so the globe's
 * limb curves across the lower part of the view and the night side fills it; the horizon dips
 * acos(1/r) below the level.
 */
export const ORBIT_RADII = 1.12;
/** Where the Sun stands across the view at rest, as a share of its width from the left, whatever the aspect. */
export const SUN_ACROSS = 0.62;
/**
 * The camera's field of view, vertical degrees: the open view the world and the sky are drawn
 * in, the narrowest the framing reaches, and the widest the disc's own frame opens
 * to so a giant past the open view still rises whole over the limb (the HUD reads it as a
 * magnification under one).
 */
export const FOV_DEG = { open: 50, min: 0.5, wide: 90 } as const;
/**
 * The Sun is framed, never drawn at true size in a wide view: the disc spans `DISC_SHARE` of
 * the view's height at today's radius and grows or shrinks as its radius to `DISC_GROWTH`,
 * whichever world it is seen from, so the swell and the collapse read as one steady change and
 * a move to another world leaves the disc as it was (the frame takes up the distance); only
 * past the widest or under the narrowest frame does the disc show its own size, as a remnant
 * shrinking to a point from afar does. The HUD shows the magnification so true scale stays
 * honest.
 */
export const DISC_SHARE = 0.14;
export const DISC_GROWTH = 0.3;
/**
 * The frame follows its value with lag: it changes by at most a factor of two every this many
 * seconds, so a jump (a scrub, a chapter) eases instead of snapping.
 */
export const FRAMING_DOUBLING_S = 0.8;
/**
 * A disc narrower than this many pixels in the narrowest frame is a point: nothing to frame,
 * the view stays open; framed in full from the second figure. Both lie under the disc's own
 * point size (a radius of `MIN_RADIUS_PX`), so the frame opens only once the Sun already draws
 * as a point.
 */
export const FRAME_FROM_PX: readonly [number, number] = [1, 3];
/**
 * Where the Sun's centre stands above the limb in the open view, as a share of the view's
 * height: low, a sunrise over the limb. The orbit's place on the globe is chosen so the Sun
 * truly stands there; a magnified frame keeps the Sun at the same place on the screen.
 */
export const SUN_LIFT = 0.22;
/**
 * Where the limb sits as a visit opens, as a share of the view's height from the top: low, a
 * third up in landscape and in portrait, the sky over it; and the band it keeps within when the
 * view is tilted.
 */
export const HORIZON_SHARE = { landscape: 0.66, portrait: 0.67 } as const;
export const HORIZON_BAND = { top: 0.5, bottom: 0.9 } as const;
/** The view follows a hand, a key or a step with this time constant, seconds: smooth, never laggy. */
export const LOOK_DAMP_S = 0.12;
/** A turn keeps the Sun's centre within this share of the half-width from the view's centre: it never leaves the frame. */
export const SUN_IN_FRAME = 0.85;
/**
 * The nebula from inside its shell (an illustration): the glow shows once the core is hot
 * enough to ionise the shell, between these temperatures, and thins away over this long
 * after the envelope left.
 */
export const NEBULA_IONISED_K: readonly [number, number] = [20_000, 50_000];
export const NEBULA_FADE_YEARS = 20_000;
/** Its look: the glow's level, [O III] green near the star giving way to Hα red at this reach, the faint floor over the whole sky, the filaments' grain. */
const NEBULA_LEVEL = 0.22;
const NEBULA_CORE = 0.35;
const NEBULA_REACH = 1.2;
const NEBULA_FLOOR = 0.12;
const NEBULA_GRAIN = 7;
const NEBULA_GRAIN_DEPTH = 0.7;
const NEBULA_OIII_RGB: readonly [number, number, number] = [0.3, 1, 0.65];
const NEBULA_HALPHA_RGB: readonly [number, number, number] = [1, 0.3, 0.35];
/** The shell's light on a world's night side, over the display's floor: green with the red, part of the same illustration. */
export const NEBULA_SKYLIGHT: readonly [number, number, number] = [3, 5, 3];
/**
 * The sky's one fixed turn: the Milky Way's plane passes through the resting view's centre,
 * tilted this far from the level (radians), so the band arches across the sky; and the
 * band's orbital phase, so its brightest stretch stands over the Sun's side of the sky.
 */
export const MILKY_WAY_TILT = 0.8;
export const MILKY_WAY_PHASE = 2.2;
/**
 * The camera's sway (each mode's in `modes.ts`) holds where it is when the clock stops, and
 * takes up a new mode's reach over about this many seconds, so starting the drift never jolts.
 */
export const SWAY_EASE_S = 3;

/**
 * The display's exposure (the eye adapts): every radiance is shown as this root of its value
 * relative to the light a white surface at Earth's orbit has today, times today's level, so
 * a white cloud on today's Earth reads a little under white, the young Sun's Earth darker, the
 * brighter Sun's lighter up to the ceiling, where the exposure gives; the Sun's disc, brighter
 * than any surface it lights by the square of the distance over its radius, is exposed with it.
 */
export const DAY_GAMMA = 0.45;
export const DAY_TODAY = 0.7;
export const DAY_CEILING = 0.9;
/** The eye adapts down as well: the day side is never shown under this, so a world under the dwarf still shows and its stars are out. */
export const DAY_FLOOR = 0.25;
/**
 * The disc's centre's brightest channel is shown at most this far up the tone curve (the eye
 * looks at the Sun as well as the world), so its limb darkening, surface and hue stay in the
 * picture; above the day side's ceiling, so the Sun is the brightest thing on screen at every
 * age. The eye adapts to the field it sees: as the disc fills the view (its share of the open
 * view's height, squared) the world is exposed with the disc rather than the disc with the world.
 */
export const DISC_PEAK = 0.95;
/** The Sun's radiance over the light a white surface at one au gets from it: (au / R☉)². */
export const SUN_OVER_SUNLIGHT = (AU_KM / SOLAR_RADIUS_KM) ** 2;
/**
 * The stars fade with the field's glare (the day side, or a disc that fills the view): all
 * out below the floor, gone above the ceiling, which lies past the day side's cap so the
 * brightest stay faintly there over a lit world.
 */
export const STARS_OUT = { floor: 0.05, ceiling: 1.2 } as const;
/**
 * A Sun too small for a pixel is drawn as a point whose brightness follows the sunlight on the
 * same root as the day side, so the dwarf from Pluto blazes among the stars (the eye's response
 * is logarithmic; a true dilution would leave nothing): the gain before the root, the cap, and
 * never less than this many times the day side's level, so the Sun is the brightest thing on
 * screen at every age.
 */
export const POINT_GAIN = 3e7;
export const POINT_CAP = 1.6;
export const SUN_OVER_WORLD = 1.25;
/** The bloom's own settings: only the brightest light glows (a point Sun, the disc's heart), not a whole globe. */
export const BLOOM = { threshold: 0.95, knee: 0.05, strength: 0.4 } as const;

/* The shader's own constants. */
/** The glare about the disc: its reach in disc radii, never past this many radians (a giant's would blanket the sky), and its strength (the eye's, there being no air). */
const GLARE_REACH = 6;
const GLARE_REACH_MAX = 0.12;
const GLARE_STRENGTH = 0.35;
/** The disc's own brightness takes over from the point's once it is this many pixels across in its frame; drawn as a point below the first figure. */
const MIN_RADIUS_PX = 2;
const RESOLVED_PX = 3;
/** A point Sun's halo: its share of the point's light and its reach in pixels (the eye's glare). */
const POINT_HALO = 0.6;
const POINT_HALO_PX = 7;
/** How much the brightest light whitens in the tone curve: low, so a red giant stays red. */
const HIGHLIGHT_WHITE = 0.15;
/**
 * The granules' temperature contrast, as a share of the surface's: fine cells on a dwarf, the
 * broad cells of a giant deeper, as Giants draws them; where the surface is this many cells
 * across or more the finer figure holds, the broader below a tenth of that.
 */
const CELL_CONTRAST_FINE = 0.035;
const CELL_CONTRAST_GIANT = 0.065;
const CELLS_FINE_FROM = 300;

export const SHADER_DEFINES = glslDefines({
  PROFILE_SAMPLES: glslInt(PROFILE_SAMPLES),
  GLARE_REACH,
  GLARE_REACH_MAX,
  GLARE_STRENGTH,
  MIN_RADIUS_PX,
  RESOLVED_PX,
  HIGHLIGHT_WHITE,
  POINT_HALO,
  POINT_HALO_PX,
  DAY_GAMMA,
  SUN_OVER_SUNLIGHT,
  CELL_CONTRAST_FINE,
  CELL_CONTRAST_GIANT,
  CELLS_FINE_FROM,
  NEBULA_LEVEL,
  NEBULA_CORE,
  NEBULA_REACH,
  NEBULA_FLOOR,
  NEBULA_GRAIN,
  NEBULA_GRAIN_DEPTH,
  NEBULA_OIII_RGB,
  NEBULA_HALPHA_RGB,
});

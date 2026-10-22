/**
 * How each body's surface is drawn, without WebGL: a style (what kind of surface it has), its
 * temperatures at the equator and the poles, its convection, extended atmosphere, pulsation
 * and weather, and how fast the globe turns on screen. Temperatures and convection come from
 * the catalogue and the physics; hazes, pulsations, weather and display spins are labelled
 * teaching choices.
 */
import { CONVECTIVE_BELOW_K } from "@/space/hr-diagram";
import { PROFILE_SAMPLES } from "@/space/sun/graphics/parameters";

import {
  BEAM_REACH,
  BROWN_DWARF_DISPLAY_K,
  CORONA_REACH,
  EJECTION_REACH,
  ENVELOPE_REACH,
  GLOW_REACH,
  HOLE_REACH,
  LIMB_ROUGHNESS,
  PULSAR_DISPLAY_K,
  SPIN_SECONDS,
  SUPERGIANT_MASS,
  type Style,
} from "../parameters";
import type { ActivityKind } from "./activity";
import { RUNG_FACTS, drawn, inUnit } from "./catalogue";
import { granulesAcross } from "./physics";
import { rotatingTemperatures, ROTATOR_INCLINATIONS } from "./rotation";
import { RUNGS, type Rung, type RungId } from "./rungs";

export type Look = {
  style: Style;
  /** Surface temperature at the equator and at the poles, K: apart only for fast rotators. */
  equatorK: number;
  poleK: number;
  /** ELR latitude temperatures, normalized to the adopted luminosity on the drawn spheroid. */
  temperatures: Float64Array | undefined;
  /** Convection cells across the radius (0: none). */
  cells: number;
  /** An extended atmosphere or wind glowing past the limb, 0–1. */
  haze: number;
  /** Bumps of a lumpy limb, as a share of the radius: a red supergiant's giant cells. */
  rough: number;
  /** Non-radial pulsation's swing in temperature, as a share of it. */
  pulse: number;
  /** What the star does when the camera rests on it (`activity.ts`). */
  activity: ActivityKind;
  /** A schematic black-hole ring marker, or none. */
  ring: Ring | null;
  /**
   * How far its light reaches past its radius, radii: a hole's photon ring, a pulsar's beams,
   * the weather of a star that has it, a wind or shell, or the soft glow.
   */
  reach: number;
  /** Seconds for one turn on screen: a display pace, not the real one. */
  spin: number;
  /** The pole's tilt towards us, radians, and a seed that makes each surface its own. */
  tilt: number;
  seed: number;
};

/**
 * A schematic black-hole ring: its glow, the display temperature of its light (K),
 * how much it flickers, and the position angle it is brightest at (radians from the right,
 * anticlockwise).
 */
export type Ring = { glow: number; kelvin: number; flicker: number; brightest: number };

/**
 * Each hole's ring, teaching choices that follow what is observed: Cygnus X-1 is fed by its
 * blue supergiant companion through a hot disk (its X-rays shown as light we could see);
 * Sagittarius A* is starved, faint and flickering (it flares daily); M87*'s ring is brightest
 * in the south, as the Event Horizon Telescope saw it in 2017; TON 618 is a quasar, blinding.
 */
const RINGS: Partial<Record<RungId, Ring>> = {
  "cygnus-x1": { glow: 1, kelvin: 14_000, flicker: 0.4, brightest: Math.PI },
  "sgr-a": { glow: 0.45, kelvin: 4_200, flicker: 1, brightest: Math.PI },
  m87: { glow: 0.8, kelvin: 6_000, flicker: 0.3, brightest: -Math.PI / 2 },
  "ton-618": { glow: 1.4, kelvin: 22_000, flicker: 0.2, brightest: Math.PI },
};

/** Extended atmospheres and winds by star: teaching choices that follow what is observed. */
const HAZE: Partial<Record<RungId, number>> = {
  betelgeuse: 1,
  antares: 0.9,
  "uy-scuti": 1,
  "vy-cma": 1,
  "stephenson-2-18": 1,
  r136a1: 0.8,
  rigel: 0.4,
  deneb: 0.5,
  aldebaran: 0.25,
  arcturus: 0.2,
};
/**
 * Selected illustrative weather profiles, not a claim that hot stars cannot have magnetic
 * fields or activity. The Sun's; red dwarf flares; quiet giants; supergiant plumes.
 */
const ACTIVITY: Partial<Record<RungId, ActivityKind>> = {
  sun: "solar",
  proxima: "flare",
  "trappist-1": "flare",
  arcturus: "quiet",
  aldebaran: "quiet",
  betelgeuse: "plumes",
  antares: "plumes",
  "uy-scuti": "plumes",
  "vy-cma": "plumes",
  "stephenson-2-18": "plumes",
};
/** The red supergiants, whose few giant cells show on their faces and bulge their limbs. */
const GIANT_CELLS: ReadonlySet<RungId> = new Set([
  "betelgeuse",
  "antares",
  "uy-scuti",
  "vy-cma",
  "stephenson-2-18",
]);
/**
 * Pulsation by star, as a share of the temperature: Rigel and Deneb are α Cygni variables,
 * ringing in many non-radial modes; R136a1 and Achernar (a Be star) pulse too. A display
 * amplification of swings of a few per cent in light.
 */
const PULSE: Partial<Record<RungId, number>> = {
  rigel: 0.07,
  deneb: 0.07,
  r136a1: 0.05,
  achernar: 0.04,
};

function styleOf(rung: Rung, kelvin: number): Style {
  if (rung.kind === "horizon") return "horizon";
  if (rung.id === "earth" || rung.id === "jupiter") return rung.id;
  if (rung.id === "brown-dwarf") return "brownDwarf";
  if (rung.id === "neutron-star") return "pulsar";
  if (rung.kind === "remnant") return "whiteDwarf";
  return kelvin < CONVECTIVE_BELOW_K ? "convective" : "radiative";
}

function lookOf(rung: Rung, index: number): Look {
  const { teff, mass, radius, polar, luminosity } = RUNG_FACTS[rung.id];
  const kelvin = teff
    ? drawn(teff)
    : rung.id === "brown-dwarf"
      ? BROWN_DWARF_DISPLAY_K
      : PULSAR_DISPLAY_K;
  const style = styleOf(rung, kelvin);
  const temperatures =
    rung.kind === "star" && polar && luminosity
      ? rotatingTemperatures(
          inUnit(polar, "m")(drawn(polar)) / inUnit(radius, "m")(drawn(radius)),
          inUnit(radius, "Rsun")(drawn(radius)),
          inUnit(luminosity, "Lsun")(drawn(luminosity)),
          PROFILE_SAMPLES,
        )
      : undefined;
  const equatorK = temperatures?.[0] ?? kelvin;
  const poleK = temperatures?.[PROFILE_SAMPLES - 1] ?? kelvin;
  /* No adopted mass (UY Scuti, Stephenson 2-18): a display assumption sizes its cells. */
  const massSuns = mass?.unit === "Msun" ? drawn(mass) : SUPERGIANT_MASS;
  const cells =
    style === "convective"
      ? granulesAcross(massSuns, inUnit(radius, "Rsun")(drawn(radius)), kelvin)
      : 0;
  const fast = equatorK !== poleK;
  const activity = ACTIVITY[rung.id] ?? "none";
  const haze = HAZE[rung.id] ?? 0;
  const reach =
    style === "horizon"
      ? HOLE_REACH
      : style === "pulsar"
        ? BEAM_REACH
        : activity !== "none"
          ? Math.max(CORONA_REACH, EJECTION_REACH)
          : haze > 0
            ? ENVELOPE_REACH
            : GLOW_REACH;
  return {
    style,
    equatorK,
    poleK,
    temperatures,
    cells,
    haze,
    rough: GIANT_CELLS.has(rung.id) ? LIMB_ROUGHNESS : 0,
    pulse: PULSE[rung.id] ?? 0,
    activity,
    ring: RINGS[rung.id] ?? null,
    reach,
    spin: SPIN_SECONDS[style] * (fast ? 0.35 : 1),
    tilt:
      rung.id === "vega" || rung.id === "achernar"
        ? ((90 - ROTATOR_INCLINATIONS[rung.id]) * Math.PI) / 180
        : 0.22 + 0.18 * Math.sin(index * 2.4),
    seed: (index * 0.618_034) % 1,
  };
}

export const LOOKS: readonly Look[] = RUNGS.map(lookOf);

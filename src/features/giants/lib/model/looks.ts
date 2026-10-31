/**
 * How each body's surface is drawn, without WebGL: a style (what kind of surface it has), its
 * temperatures at the equator and the poles, its convection, extended atmosphere, pulsation
 * and weather, and how fast the globe turns on screen. Temperatures and convection come from
 * the catalogue and the physics; hazes, pulsations, weather and display spins are labelled
 * teaching choices.
 */
import { CONVECTIVE_BELOW_K } from "@/space/hr-diagram";
import { PROFILE_SAMPLES } from "@/space/sun/graphics/parameters";
import { granulesAcross } from "@/space/sun/model/granulation";

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
import { rotatingTemperatures } from "./rotation";
import { RUNGS, type Rung, type Ring } from "./rungs";

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

export type { Ring } from "./rungs";

function styleOf(rung: Rung, kelvin: number): Style {
  return rung.presentation?.profile ?? (kelvin < CONVECTIVE_BELOW_K ? "convective" : "radiative");
}

function lightReach(style: Style, activity: ActivityKind, haze: number) {
  switch (style) {
    case "horizon":
      return HOLE_REACH;
    case "pulsar":
      return BEAM_REACH;
  }
  if (activity !== "none") {
    return Math.max(CORONA_REACH, EJECTION_REACH);
  }
  if (haze > 0) {
    return ENVELOPE_REACH;
  }
  return GLOW_REACH;
}

function lookOf(rung: Rung, index: number): Look {
  const { teff, mass, radius, polar, luminosity, inclination } = RUNG_FACTS[rung.id];
  const kelvin = teff
    ? drawn(teff)
    : rung.presentation?.profile === "brownDwarf"
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
  const activity = rung.presentation?.activity ?? "none";
  const haze = rung.presentation?.haze ?? 0;
  return {
    style,
    equatorK,
    poleK,
    temperatures,
    cells,
    haze,
    rough: rung.presentation?.giantCells ? LIMB_ROUGHNESS : 0,
    pulse: rung.presentation?.pulse ?? 0,
    activity,
    ring: rung.presentation?.ring ?? null,
    reach: lightReach(style, activity, haze),
    spin: SPIN_SECONDS[style] * (fast ? 0.35 : 1),
    tilt:
      rung.presentation?.measuredTilt && inclination
        ? ((90 - drawn(inclination)) * Math.PI) / 180
        : 0.22 + 0.18 * Math.sin(index * 2.4),
    seed: (index * 0.618_034) % 1,
  };
}

export const LOOKS: readonly Look[] = RUNGS.map(lookOf);

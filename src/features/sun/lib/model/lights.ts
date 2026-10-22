/**
 * The lights the Sun can be watched in, in the dial's order: white light, Hα, the SDO/AIA
 * passbands by their ion and wavelength (Å), an eclipse (the disc occulted) and a magnetogram.
 * What each shows of the scene is the model's (`@/space/sun/model/passbands`).
 */
import type { PassbandId } from "@/space/sun/frame";

export const LIGHT_IDS = [
  "white",
  "halpha",
  "he304",
  "fe171",
  "fe193",
  "fe211",
  "fe335",
  "fe94",
  "fe131",
  "eclipse",
  "magnetogram",
] as const satisfies readonly PassbandId[];

export type LightId = (typeof LIGHT_IDS)[number];

/**
 * The lights that show gas at a temperature, coolest first: the dock's ruler, from the
 * photosphere's thousands of kelvin to flare plasma at ten million.
 */
export const LIGHT_SCALE = [
  "white",
  "halpha",
  "he304",
  "fe171",
  "fe193",
  "fe211",
  "fe335",
  "fe94",
  "fe131",
] as const satisfies readonly LightId[];
export type ScaleLightId = (typeof LIGHT_SCALE)[number];

/** The lights that are ways of looking rather than temperatures: the disc hidden, the field read. */
export const LIGHT_MODES = ["eclipse", "magnetogram"] as const satisfies readonly LightId[];

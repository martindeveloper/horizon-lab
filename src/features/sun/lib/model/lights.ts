/**
 * The lights the Sun can be watched in, in the dial's order: white light, Hα, the SDO/AIA
 * passbands by their ion and wavelength (Å), an eclipse (the disc occulted) and a magnetogram.
 * What each shows of the scene is the model's (`@/space/sun/model/passbands`).
 */
import type { PassbandId } from "@/space/sun/frame";

import type { RIBBON_PRESENCE } from "../parameters";

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
 * The dock's discrete spectral modes, arranged from photospheric to coronal views.
 * This is not a temperature scale: several bands have multiple response peaks.
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

/** The lights that are ways of looking rather than spectral bands: the disc hidden, the field read. */
export const LIGHT_LOOKS = ["eclipse", "magnetogram"] as const satisfies readonly LightId[];

/** What kind of light an id is: true colour, Hα, a band of the EUV, the eclipse or the magnetogram. */
export type LightKind = keyof typeof RIBBON_PRESENCE;
export const lightKind = (id: PassbandId): LightKind =>
  id === "white" || id === "halpha" || id === "eclipse" || id === "magnetogram" ? id : "band";

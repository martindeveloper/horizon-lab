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

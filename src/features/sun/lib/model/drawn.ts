/**
 * What a light draws of each place: the one rule the scene's names, its taps and the finder's
 * chips answer to, so the lab never points at what it does not draw. It reads the layers a light
 * shows (`PASSBANDS`' weights) and how it draws the disc (occulted by the eclipse, read as field
 * by the magnetogram); the scene adds what depends on the moment (the eruption, the quality, the
 * zoom, the View panel's toggles).
 */
import { PASSBANDS } from "@/space/sun/model/passbands";

import { RIBBON_PRESENCE } from "../parameters";
import { lightKind, type LightId } from "./lights";
import type { PlaceId } from "./places";

type Shown = (typeof PASSBANDS)[LightId];

/** The disc is drawn as a surface: not occulted, not read as a field. */
const surface = (p: Shown) => !p.occultDisc && !p.magnetogram;
/** The chromosphere's rim and its spicules: what Hα and the transition region show. */
const rim = (p: Shown) => p.weights.chromosphere + p.weights.transition > 0;
const corona = (p: Shown) => p.weights.corona > 0;
/** The field's lines, the eruption's arcade among them. */
const ribbons = (p: Shown) => RIBBON_PRESENCE[lightKind(p.id)] > 0;

const DRAWN: Readonly<Record<PlaceId, (p: Shown) => boolean>> = {
  star: () => true,
  parker: () => true,
  /* The cut's faces: black under the eclipse's occulting disc. */
  core: (p) => !p.occultDisc,
  radiativeZone: (p) => !p.occultDisc,
  tachocline: (p) => !p.occultDisc,
  convectionZone: (p) => !p.occultDisc,
  photosphere: (p) => !p.occultDisc && p.weights.photosphere > 0,
  granule: (p) => surface(p) && p.weights.photosphere > 0,
  /* The magnetogram draws a group as its bipole. */
  sunspot: (p) => !p.occultDisc && p.weights.photosphere > 0,
  facula: (p) =>
    surface(p) && p.weights.photosphere + p.weights.chromosphere + p.weights.transition > 0,
  chromosphere: rim,
  spicule: rim,
  /* Glowing where the light sees cool gas, dark against the corona where it only absorbs. */
  prominence: (p) => rim(p) || corona(p),
  /* A flare's ribbons and kernel on the disc, in the bands and in Hα. */
  flare: (p) =>
    surface(p) &&
    p.weights.chromosphere + p.weights.transition + p.weights.corona + p.weights.flare > 0,
  loops: ribbons,
  corona,
  streamer: corona,
  ejection: (p) => p.weights.chromosphere + p.weights.corona > 0,
  wind: corona,
};

/** Whether a light draws a place at all. */
export const lightDraws = (place: PlaceId, light: LightId) => DRAWN[place](PASSBANDS[light]);

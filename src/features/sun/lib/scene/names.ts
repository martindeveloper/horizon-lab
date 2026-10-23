/**
 * The places' names in the scene: each at its anchor (`anchors.ts`), unless the Sun hides it,
 * and only near its feature at the scale drawn: a disc feature once it spans `NAME_FEATURE_PX`,
 * a limb feature within `NAME_LIMB_PX` of the limb and in view, the shells inside on the cut's
 * faces once it is open; never during a flight. Each is set a little outward from its anchor.
 */
import { Vector3, type PerspectiveCamera, type Vector2 } from "three";

import { SURFACE_RESOLVE_PX } from "@/space/sun/graphics/parameters";
import { LAYER_IDS, type LayerId } from "@/space/sun/model/structure";
import { TAU, type Vec3 } from "@horizon/toolkit/math";
import { recordFrom } from "@horizon/toolkit/records";
import { worldPerPixel, type PlaceLabel } from "@horizon/toolkit/scene";

import { PLACE_IDS, type PlaceId } from "../model/places";
import {
  GRANULES_PER_RADIUS,
  SPICULE_COLUMNS,
  NAME_DISC_R,
  NAME_FEATURE_PX,
  NAME_LIMB_PX,
  NAME_OFFSET_PX,
} from "../parameters";
import { createPlaceAnchors } from "./anchors";
import type { SunFrame } from "./frame";
import type { LightKind } from "./looks";
import type { SunLight } from "./settings";
import { featuredRegion } from "./views";

/** The body's pole: what the surface turns about. */
const POLE = new Vector3(0, 1, 0);
/** The cut must be this far open before the places inside the Sun are named. */
const NAMED_INSIDE_CUT = 0.3;
/** Spicules are named once their jets stand this far apart, CSS px: where the renderer draws all of them. */
const SPICULE_NAME_PX = 2 * SURFACE_RESOLVE_PX;
/** A flare is named while its light is above this share. */
const FLARE_NAMED_LIGHT = 0.05;

export const isLayerId = (key: unknown): key is LayerId =>
  typeof key === "string" && (LAYER_IDS as readonly string[]).includes(key);

/** What a name's rule reads about its place this frame. */
type NameScene = {
  /** The camera's distance from the centre, radii. */
  distance: number;
  /** A length at the anchor in CSS px. */
  px: (size: number) => number;
  /** The featured region's size in CSS px. */
  regionPx: number;
  /** The anchor stands within `NAME_LIMB_PX` of the limb on screen. */
  nearLimb: boolean;
  light: LightKind;
  /** What the light shows of each layer, 0–1: a layer it does not show has no names. */
  weights: SunLight["weights"];
  /** The quality draws spicules; how much a prominence shows in the light. */
  spicules: boolean;
  prominence: number;
  flareLight: number;
};

/** The light shows the chromosphere's rim (or the transition region's sheath on it), as the atmosphere draws it. */
const rimShown = (s: NameScene) => s.weights.chromosphere + s.weights.transition > 0;

/** When each place's name shows, once its anchor is in view outside the Sun. */
const NAME_SHOWN: Readonly<Record<PlaceId, (s: NameScene) => boolean>> = {
  star: () => false,
  parker: () => true,
  granule: (s) => s.weights.photosphere > 0 && s.px(1 / GRANULES_PER_RADIUS) > 1,
  sunspot: (s) => s.weights.photosphere > 0 && s.regionPx > NAME_FEATURE_PX,
  facula: (s) => s.weights.photosphere + s.weights.chromosphere > 0 && s.regionPx > NAME_FEATURE_PX,
  photosphere: (s) => s.weights.photosphere > 0 && s.distance < NAME_DISC_R,
  chromosphere: (s) => s.nearLimb && rimShown(s),
  spicule: (s) =>
    s.nearLimb && rimShown(s) && s.spicules && s.px(TAU / SPICULE_COLUMNS) >= SPICULE_NAME_PX,
  prominence: (s) => s.nearLimb && s.prominence > 0,
  flare: (s) => s.light === "band" && s.flareLight > FLARE_NAMED_LIGHT,
  loops: (s) => s.light === "band" && s.regionPx > NAME_FEATURE_PX,
  corona: (s) => s.nearLimb && s.weights.corona > 0,
  streamer: (s) => s.nearLimb && s.weights.corona > 0,
  ejection: (s) => s.weights.chromosphere + s.weights.corona > 0,
  wind: (s) => s.nearLimb && s.weights.corona > 0,
  core: () => true,
  radiativeZone: () => true,
  tachocline: () => true,
  convectionZone: () => true,
};

/** What the names are drawn over this frame. */
export type NameView = {
  camera: PerspectiveCamera;
  /** The canvas in CSS px. */
  viewport: { width: number; height: number };
  /** Names are switched on, and nothing flies the camera. */
  shown: boolean;
  /** The wedge as the shader sees it (half-angle, bisector) and how far open it is drawn, 0–1. */
  cut: Vector2;
  cutShown: number;
  light: LightKind;
  /** The light's layer weights, whether the quality draws spicules, how much a prominence shows. */
  weights: SunLight["weights"];
  spicules: boolean;
  prominence: number;
};

export function createPlaceNames(place: PlaceLabel) {
  const anchorOf = createPlaceAnchors();
  const anchor: Vec3 = [0, 0, 0];
  const at = new Vector3();
  const toAnchor = new Vector3();
  const projected = new Vector3();
  const sunCentre = new Vector3();
  const radial = new Vector3();
  const lastAt = recordFrom(PLACE_IDS, () => new Vector3());
  const scene: NameScene = {
    distance: 0,
    px: () => 0,
    regionPx: 0,
    nearLimb: false,
    light: "white",
    weights: { photosphere: 1, chromosphere: 0, transition: 0, corona: 0, flare: 0 },
    spicules: false,
    prominence: 0,
    flareLight: 0,
  };
  let worldPx = 0;
  let away = 1;
  scene.px = (size) => size / (worldPx * away);

  /** A point hidden behind the Sun from the camera. */
  const behindSun = (p: Vector3, camera: PerspectiveCamera) => {
    toAnchor.subVectors(p, camera.position);
    const dist = toAnchor.length();
    toAnchor.divideScalar(Math.max(dist, 1e-9));
    const b = camera.position.dot(toAnchor);
    const disc = b * b - camera.position.lengthSq() + 1;
    return disc >= 0 && -b - Math.sqrt(disc) < dist - 1e-4;
  };

  return {
    update(f: SunFrame, view: NameView) {
      const { camera, viewport, cut } = view;
      const distance = camera.position.length();
      worldPx = worldPerPixel(camera.fov, 1, viewport.height);
      /* The limb on screen: the disc's angular radius is asin(1/d), its tangent over a CSS
         pixel's at unit distance its radius in px, about the Sun's centre as projected. */
      const limbPx = 1 / (worldPx * Math.sqrt(Math.max(distance * distance - 1, 1e-6)));
      sunCentre.set(0, 0, 0).project(camera);
      const featured = featuredRegion(f);
      scene.distance = distance;
      scene.light = view.light;
      scene.weights = view.weights;
      scene.spicules = view.spicules;
      scene.prominence = view.prominence;
      scene.flareLight = f.eruption?.flareLight ?? 0;
      let layersNamed = 0;
      for (const id of PLACE_IDS) {
        const found = anchorOf(f, id, anchor);
        /* A name with nothing to name fades where it last stood. */
        const last = lastAt[id];
        if (!found) {
          place(id, last.x, last.y, last.z, false);
          continue;
        }
        at.set(found[0], found[1], found[2]).applyAxisAngle(POLE, f.surfaceTurn);
        /* With the cut open, its shells are named on its faces, each on its own band at the
           anchor's depth and latitude; they alternate faces outward from the core (the order
           `PLACE_IDS` lists them in), so neighbouring bands never crowd one face. Closed, the
           Sun hides the ones inside and the photosphere names the disc. */
        const onCut = isLayerId(id) && view.cutShown > NAMED_INSIDE_CUT;
        if (onCut) {
          const span = Math.hypot(at.x, at.z);
          const face = cut.y + (layersNamed++ % 2 === 0 ? cut.x : -cut.x);
          at.x = span * Math.cos(face);
          at.z = span * Math.sin(face);
        }
        let shown = view.shown && (onCut || !behindSun(at, camera));
        if (shown && !onCut) {
          projected.copy(at).project(camera);
          const onScreen =
            Math.abs(projected.x) < 1 && Math.abs(projected.y) < 1 && projected.z < 1;
          away = at.distanceTo(camera.position);
          const centrePx =
            Math.hypot(
              (projected.x - sunCentre.x) * viewport.width,
              (projected.y - sunCentre.y) * viewport.height,
            ) / 2;
          scene.nearLimb = Math.abs(centrePx - limbPx) < NAME_LIMB_PX;
          scene.regionPx = featured ? scene.px(featured.size) : 0;
          shown = onScreen && NAME_SHOWN[id](scene);
          /* Set off its anchor outward, which on screen is away from the disc's centre. */
          at.addScaledVector(radial.copy(at).normalize(), NAME_OFFSET_PX * worldPx * away);
        }
        last.copy(at);
        place(id, at.x, at.y, at.z, shown);
      }
    },
  };
}

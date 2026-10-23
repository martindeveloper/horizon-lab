/**
 * The places' names in the scene: each at its anchor (`anchors.ts`), unless the Sun hides it,
 * only where the light draws it (`lightDraws`) and the moment does (its quality, its toggles,
 * its eruption), and only near its feature at the scale drawn: a disc feature once it spans
 * `NAME_FEATURE_PX`, a limb feature within `NAME_LIMB_PX` of the limb and in view, the corona's
 * off the disc, the shells inside on the cut's faces once it is open; never during a flight.
 * Each is set a little outward from its anchor. The place whose card is open is named in bold at
 * any scale, beside its outline (`outline.ts`).
 */
import { Vector3, type PerspectiveCamera, type Vector2 } from "three";

import { SURFACE_RESOLVE_PX } from "@/space/sun/graphics/parameters";
import { LAYER_IDS, type LayerId } from "@/space/sun/model/structure";
import { TAU, type Vec3 } from "@horizon/toolkit/math";
import { recordFrom } from "@horizon/toolkit/records";
import { STRONG, worldPerPixel, type PlaceLabel } from "@horizon/toolkit/scene";

import { lightDraws } from "../model/drawn";
import { lightKind, type LightId } from "../model/lights";
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
import { featuredRegion } from "./views";

/** The body's pole: what the surface turns about. */
const POLE = new Vector3(0, 1, 0);
/** The cut must be this far open before the places inside the Sun are named (and outlined). */
export const NAMED_INSIDE_CUT = 0.3;
/** A fine feature (granules, spicule jets) is named once it spans this many CSS px: where the renderer draws all of it. */
const RESOLVED_PX = 2 * SURFACE_RESOLVE_PX;
/** A flare is named while its light is above this share; a scene's taps answer to the same. */
export const FLARE_NAMED_LIGHT = 0.05;
/** A streamer stands against the sky at least this far from the line of sight (the shader fades it as it turns toward us). */
const STREAMER_NAMED_EDGE = 0.5;

export const isLayerId = (key: unknown): key is LayerId =>
  typeof key === "string" && (LAYER_IDS as readonly string[]).includes(key);

const toPoint = new Vector3();
/** A point hidden behind the Sun (or inside it) from the camera. */
export function behindSun(p: Vector3, camera: PerspectiveCamera) {
  toPoint.subVectors(p, camera.position);
  const dist = toPoint.length();
  toPoint.divideScalar(Math.max(dist, 1e-9));
  const b = camera.position.dot(toPoint);
  const disc = b * b - camera.position.lengthSq() + 1;
  return disc >= 0 && -b - Math.sqrt(disc) < dist - 1e-4;
}

/** What a name's rule reads about its place this frame. */
type NameScene = {
  /** The camera's distance from the centre, radii. */
  distance: number;
  /** A length at the anchor in CSS px. */
  px: (size: number) => number;
  /** The featured region's size in CSS px. */
  regionPx: number;
  /** The anchor stands within `NAME_LIMB_PX` of the limb on screen; outside the disc there. */
  nearLimb: boolean;
  offDisc: boolean;
  /** How far the anchor stands from the line of sight, 0 (along it) to 1 (across it). */
  edgeOn: number;
  /** The light in use, the quality's spicules and fine surface, the field lines shown. */
  light: LightId;
  spicules: boolean;
  fineSurface: boolean;
  fieldLines: boolean;
  /** The eruption's flare light and how far its reconnection has gone, 0 with none. */
  flareLight: number;
  reconnection: number;
};

/** When each place's name shows, once the light draws it and its anchor is in view outside the Sun. */
const NAME_SHOWN: Readonly<Record<PlaceId, (s: NameScene) => boolean>> = {
  star: () => false,
  parker: () => true,
  /* Granules at the quality that draws them, resolved: over the photograph too, which holds none. */
  granule: (s) => s.fineSurface && s.px(1 / GRANULES_PER_RADIUS) >= RESOLVED_PX,
  sunspot: (s) => s.regionPx > NAME_FEATURE_PX,
  facula: (s) => s.regionPx > NAME_FEATURE_PX,
  photosphere: (s) => s.distance < NAME_DISC_R,
  chromosphere: (s) => s.nearLimb,
  spicule: (s) => s.nearLimb && s.spicules && s.px(TAU / SPICULE_COLUMNS) >= RESOLVED_PX,
  prominence: (s) => s.nearLimb,
  flare: (s) => s.flareLight > FLARE_NAMED_LIGHT,
  /* Post-flare loops: an eruption's arcade, once reconnection builds it, with the field drawn. */
  loops: (s) => s.fieldLines && s.reconnection > 0 && s.regionPx > NAME_FEATURE_PX,
  corona: (s) => s.nearLimb && s.offDisc,
  streamer: (s) => s.nearLimb && s.offDisc && s.edgeOn >= STREAMER_NAMED_EDGE,
  ejection: () => true,
  wind: (s) => s.nearLimb && s.offDisc,
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
  /** The light in use; the quality's spicules and fine surface; the View panel's field lines. */
  light: LightId;
  spicules: boolean;
  fineSurface: boolean;
  fieldLines: boolean;
  /** The place whose card is open: named in full wherever its anchor is in view, at any scale. */
  selected: PlaceId | null;
};

export function createPlaceNames(place: PlaceLabel) {
  const anchorOf = createPlaceAnchors();
  const anchor: Vec3 = [0, 0, 0];
  const at = new Vector3();
  const projected = new Vector3();
  const sunCentre = new Vector3();
  const radial = new Vector3();
  const viewAxis = new Vector3();
  const lastAt = recordFrom(PLACE_IDS, () => new Vector3());
  const scene: NameScene = {
    distance: 0,
    px: () => 0,
    regionPx: 0,
    nearLimb: false,
    offDisc: false,
    edgeOn: 1,
    light: "white",
    spicules: false,
    fineSurface: false,
    fieldLines: false,
    flareLight: 0,
    reconnection: 0,
  };
  let worldPx = 0;
  let away = 1;
  scene.px = (size) => size / (worldPx * away);

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
      scene.spicules = view.spicules;
      scene.fineSurface = view.fineSurface;
      scene.fieldLines = view.fieldLines;
      scene.flareLight = f.eruption?.flareLight ?? 0;
      scene.reconnection = f.eruption?.reconnection ?? 0;
      viewAxis.copy(camera.position).normalize();
      let layersNamed = 0;
      for (const id of PLACE_IDS) {
        const found = anchorOf(f, id, anchor, lightKind(view.light));
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
        let shown = view.shown && lightDraws(id, view.light) && (onCut || !behindSun(at, camera));
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
          scene.offDisc = centrePx > limbPx;
          radial.copy(at).normalize();
          scene.edgeOn = Math.sqrt(Math.max(0, 1 - radial.dot(viewAxis) ** 2));
          scene.regionPx = featured ? scene.px(featured.size) : 0;
          shown = onScreen && (id === view.selected || NAME_SHOWN[id](scene));
          /* Set off its anchor outward, which on screen is away from the disc's centre. */
          at.addScaledVector(radial.copy(at).normalize(), NAME_OFFSET_PX * worldPx * away);
        }
        last.copy(at);
        place(id, at.x, at.y, at.z, shown, id === view.selected ? STRONG : undefined);
      }
    },
  };
}

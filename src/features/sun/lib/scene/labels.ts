import { Vector3, type PerspectiveCamera, type Vector2 } from "three";

import type { Vec3 } from "@horizon/toolkit/math";
import { worldPerPixel, type PlaceLabel } from "@horizon/toolkit/scene";

import {
  GRANULES_PER_RADIUS,
  NAME_DISC_R,
  NAME_FEATURE_PX,
  NAME_LIMB_PX,
  NAME_OFFSET_PX,
  SPICULE_HEIGHT,
} from "../parameters";
import { PLACE_IDS, type PlaceId, type SunFrame } from "./frame";
import { isLayerId } from "./picking";
import { featuredRegion } from "./views";

const POLE = new Vector3(0, 1, 0);
/** The cut must be this far open before the places inside the Sun are named. */
const NAMED_INSIDE_CUT = 0.3;

/** Places the Sun's names at visible anchors and on alternating cut faces. */
export function createSunLabels(
  camera: PerspectiveCamera,
  viewport: { width: number; height: number },
  place: PlaceLabel,
  anchors: ((id: PlaceId) => Vec3 | null) | undefined,
) {
  /** A point of the body frame hidden behind the Sun from the camera. */
  const anchorAt = new Vector3();
  const toAnchor = new Vector3();
  const projected = new Vector3();
  const radial = new Vector3();
  const behindSun = (p: Vector3) => {
    toAnchor.subVectors(p, camera.position);
    const dist = toAnchor.length();
    toAnchor.divideScalar(Math.max(dist, 1e-9));
    const b = camera.position.dot(toAnchor);
    const disc = b * b - camera.position.lengthSq() + 1;
    return disc >= 0 && -b - Math.sqrt(disc) < dist - 1e-4;
  };

  const hiddenAt = new Vector3();
  const named = (key: string, at: Vector3, on: boolean) => place(key, at.x, at.y, at.z, on);
  return (
    f: SunFrame,
    {
      names,
      flying,
      cut,
      cutShown,
      band,
    }: {
      names: boolean;
      flying: boolean;
      cut: Vector2;
      cutShown: number;
      band: boolean;
    },
  ) => {
    /* Names: each place at its anchor, unless the Sun hides it; the places inside show once
       the cut is open. */
    /* A name shows only near its feature at this scale, never during a flight: disc
       features once they span `NAME_FEATURE_PX`, limb features within `NAME_LIMB_PX` of the
       limb and in view, the places inside with the cut open; each set a little outward. */
    const distance = camera.position.length();
    const worldPx = worldPerPixel(camera.fov, 1, viewport.height);
    const featured = featuredRegion(f);
    const limbPx = Math.asin(Math.min(1, 1 / distance)) / (worldPx / distance);
    let layersNamed = 0;
    for (const id of PLACE_IDS) {
      const anchor = anchors?.(id) ?? null;
      if (!anchor || flying) {
        named(id, hiddenAt, false);
        continue;
      }
      anchorAt.set(anchor[0], anchor[1], anchor[2]).applyAxisAngle(POLE, f.surfaceTurn);
      /* With the cut open, its shells (`LAYER_IDS`) are named on its faces, each on its own
         band at the anchor's depth and latitude; they alternate faces outward from the core
         (the order `PLACE_IDS` lists them in), so neighbouring bands never crowd one face.
         Closed, the Sun hides the ones inside and the photosphere names the disc. */
      const onCut = isLayerId(id) && cutShown > NAMED_INSIDE_CUT;
      if (onCut) {
        const span = Math.hypot(anchorAt.x, anchorAt.z);
        const face = cut.y + (layersNamed++ % 2 === 0 ? cut.x : -cut.x);
        anchorAt.x = span * Math.cos(face);
        anchorAt.z = span * Math.sin(face);
      }
      let shown = onCut || !behindSun(anchorAt);
      if (shown && !onCut) {
        /* On screen, and near its feature: how big it is, or how close to the limb. */
        projected.copy(anchorAt).project(camera);
        const onScreen = Math.abs(projected.x) < 1 && Math.abs(projected.y) < 1 && projected.z < 1;
        const away = anchorAt.distanceTo(camera.position);
        const pxOf = (size: number) => size / (worldPx * away);
        const centrePx =
          Math.hypot(projected.x * viewport.width, projected.y * viewport.height) / 2;
        const nearLimb = Math.abs(centrePx - limbPx) < NAME_LIMB_PX;
        const regionPx = featured ? pxOf(featured.size) : 0;
        const placeShown: Record<PlaceId, boolean> = {
          star: false,
          parker: true,
          granule: pxOf(1 / GRANULES_PER_RADIUS) > 1,
          sunspot: regionPx > NAME_FEATURE_PX,
          facula: regionPx > NAME_FEATURE_PX,
          photosphere: distance < NAME_DISC_R,
          chromosphere: nearLimb,
          spicule: nearLimb && pxOf(SPICULE_HEIGHT) > 2,
          prominence: nearLimb,
          flare: band && (f.eruption?.flareLight ?? 0) > 0.05,
          loops: band && regionPx > NAME_FEATURE_PX,
          corona: nearLimb,
          streamer: nearLimb,
          ejection: true,
          wind: nearLimb,
          core: true,
          radiativeZone: true,
          tachocline: true,
          convectionZone: true,
        };
        shown = onScreen && placeShown[id];
        /* Set off its anchor outward, which on screen is away from the disc's centre. */
        anchorAt.addScaledVector(
          radial.copy(anchorAt).normalize(),
          NAME_OFFSET_PX * worldPx * away,
        );
      }
      named(id, anchorAt, names && shown);
    }
  };
}

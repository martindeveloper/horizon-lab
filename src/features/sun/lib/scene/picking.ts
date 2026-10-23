/**
 * Taps on the Sun: a name opens its place; a tap on the globe is traced as the shader traces
 * the ray (`traceSun`), naming the shell on the cut's face it lands on, the region under it on
 * the disc, or the photosphere; invisible targets stand at the prominences and the eruption's
 * X-point, each in the body frame. A tap answers only to what is drawn where it lands: a place
 * the light draws (`draws`), the nearest along the ray, never one the Sun stands in front of.
 */
import {
  Mesh,
  MeshBasicMaterial,
  SphereGeometry,
  Vector3,
  type Object3D,
  type Vector2,
} from "three";

import { layerAt, type LayerId } from "@/space/sun/model/structure";
import { wrapSigned, type Vec3 } from "@horizon/toolkit/math";
import { createTapPicking, type LabelHit, type SceneBasics } from "@horizon/toolkit/scene";

import { PLACE_IDS, type PlaceId } from "../model/places";
import { PROMINENCE_MAX, REGION_REACH } from "../parameters";
import { directionOf, type SunFrame } from "./frame";
import { GLOBE_PICK } from "./globe-layer";
import { isLayerId } from "./names";
import { prominenceMiddleR } from "./views";

/** What a tap landed on: a name (a place), or what the globe and its targets carry. */
export type SunPick =
  | { kind: "place"; id: PlaceId }
  | { kind: "layer"; layer: LayerId }
  | { kind: "region"; id: number }
  | { kind: "prominence"; index: number }
  | { kind: "eruption" };

/** The body's pole: what the surface turns about. */
const POLE = new Vector3(0, 1, 0);
/** A target's radius, radii; a prominence takes taps once it has faded in this far. */
const TARGET_RADIUS = 0.05;
const TAPPABLE_FADE = 0.05;

const isPlaceId = (key: unknown): key is PlaceId =>
  typeof key === "string" && (PLACE_IDS as readonly string[]).includes(key);

/** A pick as the targets carry it (`userData.pick`): one of ours, or nothing. */
function sunPick(pick: unknown): SunPick | null {
  if (typeof pick !== "object" || pick === null || !("kind" in pick)) return null;
  const { kind } = pick;
  if (kind === "place" && "id" in pick && isPlaceId(pick.id)) return { kind, id: pick.id };
  if (kind === "layer" && "layer" in pick && isLayerId(pick.layer))
    return { kind, layer: pick.layer };
  if (kind === "region" && "id" in pick && typeof pick.id === "number")
    return { kind, id: pick.id };
  if (kind === "prominence" && "index" in pick && typeof pick.index === "number")
    return { kind, index: pick.index };
  if (kind === "eruption") return { kind };
  return null;
}

/** The place a pick opens. */
export function placeOfPick(pick: SunPick): PlaceId {
  switch (pick.kind) {
    case "place":
      return pick.id;
    case "layer":
      return pick.layer;
    case "region":
      return "sunspot";
    case "prominence":
      return "prominence";
    default:
      return "flare";
  }
}

/** A name tapped opens its place. */
const pickOf = (key: string): SunPick | undefined =>
  isPlaceId(key) ? { kind: "place", id: key } : undefined;

export function createSunPicking(
  basics: Pick<SceneBasics, "scope" | "camera">,
  canvas: HTMLCanvasElement,
  options: {
    /** The globe's proxy sphere and the body frame the targets stand in. */
    globe: Mesh;
    body: Object3D;
    /** The wedge as the shader sees it: half-angle and bisector. */
    cut: Vector2;
    /** The frame on screen. */
    drawn: () => SunFrame;
    blocked: () => boolean;
    /** Names readable enough to tap. */
    hits: (accept: (key: string) => boolean) => LabelHit[];
    /** The scene draws a place now: its light, and the moment for a flare. */
    draws: (place: PlaceId) => boolean;
    onPick: (pick: SunPick | null) => void;
  },
) {
  const { scope } = basics;
  const { globe, body, cut } = options;
  const material = scope.own(new MeshBasicMaterial({ visible: false }));
  const geometry = scope.own(new SphereGeometry(1, 8, 6));
  const targets: Mesh[] = [];
  const target = (pick: SunPick) => {
    const mesh = new Mesh(geometry, material);
    mesh.scale.setScalar(TARGET_RADIUS);
    mesh.userData.pick = pick;
    mesh.visible = false;
    body.add(mesh);
    targets.push(mesh);
    return mesh;
  };
  const prominenceTargets = Array.from({ length: PROMINENCE_MAX }, (_, index) =>
    target({ kind: "prominence", index }),
  );
  const eruptionTarget = target({ kind: "eruption" });
  scope.defer(() => targets.forEach((mesh) => mesh.removeFromParent()));

  const origin = new Vector3();
  const ray = new Vector3();
  const entry = new Vector3();
  const centre = new Vector3();
  const normal = new Vector3();
  const inWedge = (q: Vector3) =>
    cut.x > 0 && Math.abs(wrapSigned(Math.atan2(q.z, q.x) - cut.y, Math.PI * 2)) < cut.x;
  /** How far along a ray (unit direction) it meets the photosphere; infinite when it passes by. */
  const photosphereAt = (o: Vector3, d: Vector3) => {
    const b = o.dot(d);
    const disc = b * b - o.lengthSq() + 1;
    if (disc < 0) return Infinity;
    const t1 = -b + Math.sqrt(disc);
    return t1 <= 0 ? Infinity : Math.max(-b - Math.sqrt(disc), 0);
  };
  /** Where a tap's ray meets the Sun, as the shader traces it (`traceSun`), into `entry`; null past the gap. */
  const traceTap = (o: Vector3, d: Vector3): { face: boolean } | null => {
    const b = o.dot(d);
    const disc = b * b - o.lengthSq() + 1;
    if (disc < 0) return null;
    const s = Math.sqrt(disc);
    const t0 = Math.max(-b - s, 0);
    const t1 = -b + s;
    if (t1 <= 0) return null;
    entry.copy(o).addScaledVector(d, t0);
    if (!inWedge(entry)) return { face: false };
    let best = t1;
    let hit = false;
    for (const sign of [-1, 1]) {
      const a = cut.y + sign * cut.x;
      normal.set(sign * Math.sin(a), 0, -sign * Math.cos(a));
      const dn = d.dot(normal);
      if (dn >= 0) continue;
      const t = -o.dot(normal) / dn;
      if (t > t0 && t < best) {
        best = t;
        hit = true;
      }
    }
    if (!hit) return null;
    entry.copy(o).addScaledVector(d, best);
    return { face: true };
  };
  const dir: Vec3 = [0, 0, 0];
  /** The globe's pick at the traced point: the shell on the face, else the region under it, else the photosphere. */
  const globePick = (face: boolean, f: SunFrame): SunPick => {
    if (face) return { kind: "layer", layer: layerAt(entry.length()).id };
    /* The regions are given in the body frame. */
    entry.applyAxisAngle(POLE, -f.surfaceTurn);
    for (const region of f.regions) {
      directionOf(region.lat, region.lon, dir);
      const reach = REGION_REACH * region.size;
      if (1 - entry.dot(centre.fromArray(dir)) < 0.5 * reach * reach)
        return { kind: "region", id: region.id };
    }
    return { kind: "layer", layer: "photosphere" };
  };

  createTapPicking(basics, canvas, {
    pickables: [globe, ...targets],
    choose: (hitList, tapRay) => {
      origin.copy(tapRay.origin);
      ray.copy(tapRay.direction).normalize();
      /* A target counts in front of the photosphere only; the Sun hides one behind it. */
      const surface = photosphereAt(origin, ray);
      const target = hitList.find((hit) => hit.object !== globe && hit.distance < surface);
      if (target) return target;
      const first = hitList.find((hit) => hit.object === globe);
      if (!first) return undefined;
      const traced = traceTap(origin, ray);
      if (!traced) return undefined;
      const pick = globePick(traced.face, options.drawn());
      if (!options.draws(placeOfPick(pick))) return undefined;
      globe.userData.pick = pick;
      return first;
    },
    blocked: options.blocked,
    labels: () => options.hits((key) => pickOf(key) !== undefined),
    labelPick: pickOf,
    onTap: (tapped) => {
      options.onPick(tapped ? sunPick(tapped.pick) : null);
      globe.userData.pick = GLOBE_PICK;
    },
  });

  return {
    /** Each frame: the targets where the frame's prominences and the eruption's X-point stand. */
    update(f: SunFrame) {
      prominenceTargets.forEach((mesh, index) => {
        const p = f.prominences[index];
        mesh.visible = p !== undefined && p.fade > TAPPABLE_FADE && options.draws("prominence");
        if (!p) return;
        directionOf(p.lat, p.lon, dir);
        const r = prominenceMiddleR(p);
        mesh.position.set(dir[0] * r, dir[1] * r, dir[2] * r);
      });
      const eruption = f.eruption;
      const region = eruption ? f.regions.find((r) => r.id === eruption.regionId) : undefined;
      eruptionTarget.visible = !!eruption && !!region && options.draws("flare");
      if (eruption && region && eruptionTarget.visible) {
        directionOf(region.lat, region.lon, dir);
        const r = 1 + eruption.sheetBottom;
        eruptionTarget.position.set(dir[0] * r, dir[1] * r, dir[2] * r);
      }
    },
  };
}

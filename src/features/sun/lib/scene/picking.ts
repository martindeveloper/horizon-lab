import { Mesh, MeshBasicMaterial, SphereGeometry, Vector3, type Group, type Vector2 } from "three";

import { wrapSigned } from "@horizon/toolkit/math";
import { createTapPicking, type SceneBasics, type createLabels } from "@horizon/toolkit/scene";

import { PLACE_IDS, directionOf, type PlaceId, type SunFrame } from "./frame";
import { GLOBE_PICK } from "./globe-layer";
import type { SunSceneSettings } from "./settings";

/** The shells a tap on the cut face names. */
export const LAYER_IDS = [
  "core",
  "radiativeZone",
  "tachocline",
  "convectionZone",
  "photosphere",
] as const;
export type LayerId = (typeof LAYER_IDS)[number];

/** What a tap landed on: a name (a place), or what the globe and its targets carry. */
export type SunPick =
  | { kind: "place"; id: PlaceId }
  | { kind: "layer"; layer: LayerId }
  | { kind: "region"; id: number }
  | { kind: "prominence"; index: number }
  | { kind: "eruption" };

const POLE = new Vector3(0, 1, 0);
/** The tachocline's own width on the cut, as a share of the radius, for a tap to land on. */
const TACHOCLINE_REACH = 0.03;
/** A pick target's radius, radii. */
const TARGET_RADIUS = 0.05;

export const isLayerId = (key: unknown): key is LayerId =>
  typeof key === "string" && (LAYER_IDS as readonly string[]).includes(key);
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

/** The shell a radius lies in on the cut face. */
export function layerAt(r: number, layers: SunSceneSettings["layers"]): LayerId {
  if (r < layers.core) return "core";
  if (Math.abs(r - layers.tachocline) < TACHOCLINE_REACH) return "tachocline";
  if (r < layers.tachocline) return "radiativeZone";
  return "convectionZone";
}

/** Tap targets and cut-face ray tracing, with the same body frame as the rendered Sun. */
export function createSunPicking(
  basics: Pick<SceneBasics, "scope" | "camera">,
  canvas: HTMLCanvasElement,
  {
    body,
    globe,
    cut,
    settings,
    frame,
    hits,
    blocked,
    onPick,
  }: {
    body: Group;
    globe: Mesh;
    cut: Vector2;
    settings: () => SunSceneSettings;
    frame: () => SunFrame;
    hits: ReturnType<typeof createLabels>["hits"];
    blocked: () => boolean;
    onPick: (pick: SunPick | null) => void;
  },
) {
  const { scope } = basics;
  const dir: [number, number, number] = [0, 0, 0];
  const eruptionAt = new Vector3();
  const targetMaterial = scope.own(new MeshBasicMaterial({ visible: false }));
  const targetGeometry = scope.own(new SphereGeometry(1, 8, 6));
  const targets: Mesh[] = [];
  const target = (pick: SunPick) => {
    const mesh = new Mesh(targetGeometry, targetMaterial);
    mesh.scale.setScalar(TARGET_RADIUS);
    mesh.userData.pick = pick;
    mesh.visible = false;
    body.add(mesh);
    targets.push(mesh);
    return mesh;
  };
  const prominenceTargets = Array.from({ length: 8 }, (_, index) =>
    target({ kind: "prominence", index }),
  );
  const eruptionTarget = target({ kind: "eruption" });
  scope.defer(() => targets.forEach((mesh) => mesh.removeFromParent()));

  const origin = new Vector3();
  const ray = new Vector3();
  /** Where a tap's ray meets the Sun, as the shader traces it (`traceSun`); null past the gap. */
  const traceTap = (o: Vector3, d: Vector3): { p: Vector3; face: boolean } | null => {
    const b = o.dot(d);
    const c = o.lengthSq() - 1;
    const disc = b * b - c;
    if (disc < 0) return null;
    const s = Math.sqrt(disc);
    const t0 = Math.max(-b - s, 0);
    const t1 = -b + s;
    if (t1 <= 0) return null;
    const p = o.clone().addScaledVector(d, t0);
    const inWedge = (q: Vector3) =>
      cut.x > 0 && Math.abs(wrapSigned(Math.atan2(q.z, q.x) - cut.y, Math.PI * 2)) < cut.x;
    if (!inWedge(p)) return { p, face: false };
    let best = t1;
    let hit = false;
    for (const sign of [-1, 1]) {
      const a = cut.y + sign * cut.x;
      const n =
        sign < 0
          ? new Vector3(-Math.sin(a), 0, Math.cos(a))
          : new Vector3(Math.sin(a), 0, -Math.cos(a));
      const dn = d.dot(n);
      if (dn >= 0) continue;
      const t = -o.dot(n) / dn;
      if (t > t0 && t < best) {
        best = t;
        hit = true;
      }
    }
    return hit ? { p: o.clone().addScaledVector(d, best), face: true } : null;
  };
  /** A name tapped opens its place. */
  const pickOf = (key: string): SunPick | undefined =>
    isPlaceId(key) ? { kind: "place", id: key } : undefined;
  createTapPicking(basics, canvas, {
    pickables: [globe, ...targets],
    choose: (hitList, tapRay) => {
      const first = hitList.find((hit) => hit.object !== globe) ?? hitList[0];
      if (!first || first.object !== globe) return first;
      const traced = traceTap(origin.copy(tapRay.origin), ray.copy(tapRay.direction).normalize());
      if (!traced) return undefined;
      let pick: SunPick = { kind: "layer", layer: "photosphere" };
      if (traced.face)
        pick = { kind: "layer", layer: layerAt(traced.p.length(), settings().layers) };
      else {
        /* The regions are given in the body frame. */
        traced.p.applyAxisAngle(POLE, -frame().surfaceTurn);
        for (const region of frame().regions) {
          directionOf(region.lat, region.lon, dir);
          const reach = 2.2 * region.size;
          if (1 - traced.p.dot(new Vector3(...dir)) < 0.5 * reach * reach) {
            pick = { kind: "region", id: region.id };
            break;
          }
        }
      }
      globe.userData.pick = pick;
      return first;
    },
    blocked,
    labels: () => hits((key) => pickOf(key) !== undefined),
    labelPick: pickOf,
    onTap: (tapped) => {
      onPick(tapped ? sunPick(tapped.pick) : null);
      globe.userData.pick = GLOBE_PICK;
    },
  });

  return {
    update(f: SunFrame) {
      f.prominences.slice(0, prominenceTargets.length).forEach((p, index) => {
        directionOf(p.lat, p.lon, dir);
        const r = 1 + p.height * p.lift * 0.5;
        const mesh = prominenceTargets[index]!;
        mesh.position.set(dir[0] * r, dir[1] * r, dir[2] * r);
        mesh.visible = p.fade > 0.05;
      });
      prominenceTargets.slice(f.prominences.length).forEach((mesh) => (mesh.visible = false));
      const eruption = f.eruption;
      const region = eruption ? f.regions.find((r) => r.id === eruption.regionId) : undefined;
      if (eruption && region && eruption.reconnection > 0) {
        directionOf(region.lat, region.lon, dir);
        eruptionAt.set(dir[0], dir[1], dir[2]).multiplyScalar(1 + eruption.sheetBottom);
        eruptionTarget.position.copy(eruptionAt);
        eruptionTarget.visible = true;
      } else eruptionTarget.visible = false;
    },
  };
}

import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Float32BufferAttribute,
  Sphere,
  Vector3,
} from "three";

import { surfacePoint, tiltedAxis } from "../../model/surface";
import {
  SUN_ACTIVITY_DEPTH_RATIO,
  SUN_ACTIVITY_LIFT_WIDENING,
  SUN_ACTIVITY_MAX_LIFT,
  SUN_ACTIVITY_MAX_REGIONS,
  SUN_ACTIVITY_SWAY_LIMIT,
} from "./parameters";

/**
 * Where a prominence stands: latitude and longitude of its middle (radians, body frame, y the
 * pole), the tilt of its sheet from west (radians, the model's `tiltedAxis`), its height and half-length in solar radii,
 * and a seed its threads are salted with.
 */
export type ProminenceBound = {
  lat: number;
  lon: number;
  tilt: number;
  height: number;
  halfLength: number;
  seed: number;
};

/** A bound's box, two units across and one tall, standing on its anchor: its corners, non-indexed. */
function boxCorners() {
  const indexed = new BoxGeometry(2, 1, 2);
  const box = indexed.toNonIndexed();
  indexed.dispose();
  box.translate(0, 0.5, 0);
  const corners = Float32Array.from(box.getAttribute("position").array);
  box.dispose();
  return corners;
}
const BOX_CORNERS = boxCorners();
const PER_BOUND = BOX_CORNERS.length / 3;

/**
 * Room for `capacity` volume bounds in one draw, 12 triangles each, on every device; the bounds
 * are written in place (`writeProminenceBounds`), so a prominence that moves costs an upload,
 * never a new geometry.
 */
export function createProminenceSlots(capacity = SUN_ACTIVITY_MAX_REGIONS) {
  if (capacity > SUN_ACTIVITY_MAX_REGIONS)
    throw new RangeError(`at most ${SUN_ACTIVITY_MAX_REGIONS} prominences in one draw`);
  const vertices = capacity * PER_BOUND;
  const positions = new Float32Array(vertices * 3);
  const mirrors = new Float32Array(vertices * 2);
  for (let region = 0; region < capacity; region++) {
    positions.set(BOX_CORNERS, region * BOX_CORNERS.length);
    // The one baked body reads differently mirrored along and across the sheet.
    const mirrorX = region % 2 === 0 ? 1 : -1;
    const mirrorZ = region % 4 < 2 ? 1 : -1;
    for (let i = region * PER_BOUND; i < (region + 1) * PER_BOUND; i++) {
      mirrors[i * 2] = mirrorX;
      mirrors[i * 2 + 1] = mirrorZ;
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("aAnchor", new Float32BufferAttribute(new Float32Array(vertices * 3), 3));
  geometry.setAttribute("aAlong", new Float32BufferAttribute(new Float32Array(vertices * 3), 3));
  geometry.setAttribute("aShape", new Float32BufferAttribute(new Float32Array(vertices * 4), 4));
  geometry.setAttribute("aMirror", new Float32BufferAttribute(mirrors, 2));
  geometry.boundingSphere = new Sphere(new Vector3(), 1);
  geometry.setDrawRange(0, 0);
  return geometry;
}

/** One of the slots' own attributes (`createProminenceSlots`). */
function slot(geometry: BufferGeometry, name: string) {
  const attribute = geometry.getAttribute(name);
  if (!(attribute instanceof BufferAttribute))
    throw new TypeError(`${name} is not a slot attribute`);
  return attribute;
}

const anchorAt = new Vector3();
const alongAt = new Vector3();

/** Writes the bounds into the slots and draws only those; the bounding sphere follows them. */
export function writeProminenceBounds(
  geometry: BufferGeometry,
  bounds: readonly ProminenceBound[],
) {
  const anchors = slot(geometry, "aAnchor");
  const alongs = slot(geometry, "aAlong");
  const shapes = slot(geometry, "aShape");
  if (bounds.length * PER_BOUND > anchors.count)
    throw new RangeError(`room for ${anchors.count / PER_BOUND} prominences, not ${bounds.length}`);
  bounds.forEach(({ lat, lon, tilt, height, halfLength, seed }, region) => {
    anchorAt.fromArray(surfacePoint(lat, lon));
    alongAt.fromArray(tiltedAxis(lat, lon, tilt));
    for (let i = region * PER_BOUND; i < (region + 1) * PER_BOUND; i++) {
      anchors.setXYZ(i, anchorAt.x, anchorAt.y, anchorAt.z);
      alongs.setXYZ(i, alongAt.x, alongAt.y, alongAt.z);
      shapes.setXYZW(i, height, halfLength, seed, region);
    }
  });
  anchors.needsUpdate = true;
  alongs.needsUpdate = true;
  shapes.needsUpdate = true;
  geometry.setDrawRange(0, bounds.length * PER_BOUND);
  // The shader moves the boxes onto the sphere. Bound their outer corners, not the proxy positions.
  geometry.boundingSphere!.radius = prominenceReach(bounds);
}

/** The bounds as one draw of their own. */
export function createProminenceGeometry(bounds: readonly ProminenceBound[]) {
  const geometry = createProminenceSlots(bounds.length);
  writeProminenceBounds(geometry, bounds);
  return geometry;
}

/** How far from the Sun's centre any animated corner of any bound can reach, solar radii. */
export function prominenceReach(bounds: readonly ProminenceBound[]) {
  const halfSpan = Math.max(0, ...bounds.map((bound) => bound.halfLength));
  const height = Math.max(0, ...bounds.map((bound) => bound.height));
  return Math.hypot(
    1 + height * SUN_ACTIVITY_MAX_LIFT,
    halfSpan,
    halfSpan *
      (SUN_ACTIVITY_DEPTH_RATIO * (1 + SUN_ACTIVITY_LIFT_WIDENING * (SUN_ACTIVITY_MAX_LIFT - 1)) +
        SUN_ACTIVITY_SWAY_LIMIT),
  );
}

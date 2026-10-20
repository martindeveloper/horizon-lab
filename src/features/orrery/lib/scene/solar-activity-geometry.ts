import { BoxGeometry, BufferGeometry, Float32BufferAttribute, Sphere, Vector3 } from "three";

import {
  PROMINENCE_REGIONS,
  SUN_ACTIVITY_DEPTH_RATIO,
  SUN_ACTIVITY_LIFT_WIDENING,
  SUN_ACTIVITY_MAX_HEIGHT,
  SUN_ACTIVITY_MAX_LIFT,
  SUN_ACTIVITY_SWAY_LIMIT,
} from "../model/solar-activity";

/** Six small volume bounds merged into one draw: 72 triangles on every device. */
export function createSolarActivityGeometry() {
  const indexed = new BoxGeometry(2, 1, 2);
  const box = indexed.toNonIndexed();
  indexed.dispose();
  box.translate(0, 0.5, 0);
  const p = box.getAttribute("position");
  const positions: number[] = [];
  const anchors: number[] = [];
  const alongs: number[] = [];
  const shapes: number[] = [];
  const mirrors: number[] = [];
  for (const [region, [lat, lon, tilt, height, span, phase]] of PROMINENCE_REGIONS.entries()) {
    const anchor = new Vector3(
      Math.cos(lat) * Math.cos(lon),
      Math.sin(lat),
      Math.cos(lat) * Math.sin(lon),
    );
    const east = new Vector3(-Math.sin(lon), 0, Math.cos(lon));
    const north = new Vector3().crossVectors(east, anchor);
    const along = east.multiplyScalar(Math.cos(tilt)).addScaledVector(north, Math.sin(tilt));
    // The one baked body reads differently mirrored along and across the sheet.
    const mirrorX = region % 2 === 0 ? 1 : -1;
    const mirrorZ = region % 4 < 2 ? 1 : -1;
    for (let i = 0; i < p.count; i++) {
      positions.push(p.getX(i), p.getY(i), p.getZ(i));
      anchors.push(anchor.x, anchor.y, anchor.z);
      alongs.push(along.x, along.y, along.z);
      shapes.push(height, span * 0.5, phase, region);
      mirrors.push(mirrorX, mirrorZ);
    }
  }
  box.dispose();
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("aAnchor", new Float32BufferAttribute(anchors, 3));
  geometry.setAttribute("aAlong", new Float32BufferAttribute(alongs, 3));
  geometry.setAttribute("aShape", new Float32BufferAttribute(shapes, 4));
  geometry.setAttribute("aMirror", new Float32BufferAttribute(mirrors, 2));
  // Shader moves the boxes onto the sphere. Bound their outer corners, not the proxy positions.
  geometry.boundingSphere = new Sphere(new Vector3(), activityReach());
  return geometry;
}

/** How far from the Sun's centre any animated corner of any bound can reach, solar radii. */
export function activityReach() {
  const halfSpan = Math.max(...PROMINENCE_REGIONS.map((region) => region[4] * 0.5));
  return Math.hypot(
    1 + SUN_ACTIVITY_MAX_HEIGHT * SUN_ACTIVITY_MAX_LIFT,
    halfSpan,
    halfSpan *
      (SUN_ACTIVITY_DEPTH_RATIO * (1 + SUN_ACTIVITY_LIFT_WIDENING * (SUN_ACTIVITY_MAX_LIFT - 1)) +
        SUN_ACTIVITY_SWAY_LIMIT),
  );
}

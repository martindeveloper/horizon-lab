import { BoxGeometry, BufferGeometry, Float32BufferAttribute, Sphere, Vector3 } from "three";

import {
  SUN_ACTIVITY_DEPTH_RATIO,
  SUN_ACTIVITY_LEAN_LIMIT,
  SUN_ACTIVITY_MAX_HEIGHT,
  SUN_ACTIVITY_MAX_STRETCH,
  SUN_ACTIVITY_TWIST_LIMIT,
  SUN_ACTIVITY_WAVE_AMPLITUDE,
  PROMINENCE_REGIONS,
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
  for (const [region, [lat, lon, tilt, height, span, phase]] of PROMINENCE_REGIONS.entries()) {
    const anchor = new Vector3(
      Math.cos(lat) * Math.cos(lon),
      Math.sin(lat),
      Math.cos(lat) * Math.sin(lon),
    );
    const east = new Vector3(-Math.sin(lon), 0, Math.cos(lon));
    const north = new Vector3().crossVectors(east, anchor);
    const along = east.multiplyScalar(Math.cos(tilt)).addScaledVector(north, Math.sin(tilt));
    for (let i = 0; i < p.count; i++) {
      positions.push(p.getX(i), p.getY(i), p.getZ(i));
      anchors.push(anchor.x, anchor.y, anchor.z);
      alongs.push(along.x, along.y, along.z);
      shapes.push(height, span * 0.5, phase, region);
    }
  }
  box.dispose();
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("aAnchor", new Float32BufferAttribute(anchors, 3));
  geometry.setAttribute("aAlong", new Float32BufferAttribute(alongs, 3));
  geometry.setAttribute("aShape", new Float32BufferAttribute(shapes, 4));
  // Shader moves the boxes onto the sphere. Bound their outer corners, not the proxy positions.
  const halfSpan = Math.max(...PROMINENCE_REGIONS.map((region) => region[4] * 0.5));
  geometry.boundingSphere = new Sphere(
    new Vector3(),
    Math.hypot(
      1 + SUN_ACTIVITY_MAX_HEIGHT * SUN_ACTIVITY_MAX_STRETCH,
      halfSpan * (1.25 + SUN_ACTIVITY_LEAN_LIMIT + 2 * SUN_ACTIVITY_WAVE_AMPLITUDE),
      halfSpan *
        SUN_ACTIVITY_DEPTH_RATIO *
        (1 + SUN_ACTIVITY_TWIST_LIMIT + SUN_ACTIVITY_LEAN_LIMIT + 2 * SUN_ACTIVITY_WAVE_AMPLITUDE),
    ),
  );
  return geometry;
}

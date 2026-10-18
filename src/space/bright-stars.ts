/**
 * The bright stars of the shared J2000 catalogue at their real directions on a unit sphere,
 * coloured by B−V and weighted by magnitude: the sky both simulations carry with the camera.
 */
import { BufferAttribute, BufferGeometry, Vector3 } from "three";

import { STARS, starColor } from "@/lib/stars";
import { equatorialToScene } from "@horizon/toolkit/scene";

/**
 * Brightness runs from `floor` for the faintest star up to full at magnitude `full`. With
 * `size`, each star also gets a point size (a `size` attribute); without it, points share one
 * size and brightness alone carries the magnitude.
 */
export function brightStarGeometry({
  floor,
  full,
  size,
}: {
  floor: number;
  full: number;
  size?: (mag: number) => number;
}) {
  const n = STARS.length;
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  const sizes = size ? new Float32Array(n) : null;
  const v = new Vector3();
  for (let i = 0; i < n; i += 1) {
    const [, ra, dec, mag, bv] = STARS[i]!;
    equatorialToScene(ra * 15, dec, v);
    pos.set([v.x, v.y, v.z], i * 3);
    const [r, g, b] = starColor(bv);
    const bright = floor + (1 - floor) * Math.min(1, 10 ** (-0.4 * (mag - full)));
    col.set([(r / 255) * bright, (g / 255) * bright, (b / 255) * bright], i * 3);
    if (sizes && size) sizes[i] = size(mag);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(pos, 3));
  geometry.setAttribute("color", new BufferAttribute(col, 3));
  if (sizes) geometry.setAttribute("size", new BufferAttribute(sizes, 1));
  return geometry;
}

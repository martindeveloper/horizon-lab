/** Vertex-coloured point clouds: the geometry they share and a writer that fills one. */
import { BufferAttribute, BufferGeometry, type Color } from "three";

/** A `position` and `color` geometry over `pos` and `col` (xyz and rgb triples), with a `size` per point when given. */
export function pointsGeometry(pos: Float32Array, col: Float32Array, size?: Float32Array | null) {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(pos, 3));
  geometry.setAttribute("color", new BufferAttribute(col, 3));
  if (size) geometry.setAttribute("size", new BufferAttribute(size, 1));
  return geometry;
}

export type PointWriter = {
  /** Points written so far. */
  readonly count: number;
  /** Adds a point coloured `color` × `brightness`. */
  put(x: number, y: number, z: number, color: Color, brightness: number): void;
  /** The points written, as a geometry over the writer's own buffers. */
  geometry(): BufferGeometry;
};

/** A point buffer sized for `count`; it grows if a sketch writes more, so nothing is dropped. */
export function createPointWriter(count: number): PointWriter {
  let pos = new Float32Array(count * 3);
  let col = new Float32Array(count * 3);
  let n = 0;
  return {
    get count() {
      return n;
    },
    put(x, y, z, c, brightness) {
      if (n * 3 >= pos.length) {
        const grownPos = new Float32Array(Math.max(3, pos.length * 2));
        const grownCol = new Float32Array(grownPos.length);
        grownPos.set(pos);
        grownCol.set(col);
        pos = grownPos;
        col = grownCol;
      }
      const i = n * 3;
      pos[i] = x;
      pos[i + 1] = y;
      pos[i + 2] = z;
      col[i] = c.r * brightness;
      col[i + 1] = c.g * brightness;
      col[i + 2] = c.b * brightness;
      n += 1;
    },
    geometry: () => pointsGeometry(pos.subarray(0, n * 3), col.subarray(0, n * 3)),
  };
}

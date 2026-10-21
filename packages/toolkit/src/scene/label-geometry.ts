/** Label geometry follows rendered globe scales, including exaggerated map markers. */
import { Box3, Matrix4, Vector3, type Mesh, type PerspectiveCamera } from "three";

export type LabelBody = { key: string; mesh: Mesh };
export type LabelBounds = { left: number; right: number; top: number; bottom: number };

const box = new Box3();
const corner = new Vector3();

export function bodyVisible(mesh: Mesh) {
  for (let object: typeof mesh | typeof mesh.parent = mesh; object; object = object.parent) {
    if (!object.visible) return false;
  }
  return true;
}

/** Conservative screen bounds leave room for oblate globes at any viewing angle; `out` is reused. */
export function bodyLabelBounds(
  mesh: Mesh,
  camera: PerspectiveCamera,
  width: number,
  height: number,
  out: LabelBounds = { left: 0, right: 0, top: 0, bottom: 0 },
): LabelBounds | null {
  box.min.set(-1, -1, -1);
  box.max.set(1, 1, 1);
  box.applyMatrix4(mesh.matrixWorld);
  out.left = Infinity;
  out.right = -Infinity;
  out.top = Infinity;
  out.bottom = -Infinity;
  for (let i = 0; i < 8; i += 1) {
    corner.set(
      i & 1 ? box.max.x : box.min.x,
      i & 2 ? box.max.y : box.min.y,
      i & 4 ? box.max.z : box.min.z,
    );
    corner.applyMatrix4(camera.matrixWorldInverse);
    if (corner.z >= 0) return null;
    corner.applyMatrix4(camera.projectionMatrix);
    const x = (corner.x * 0.5 + 0.5) * width;
    const y = (-corner.y * 0.5 + 0.5) * height;
    out.left = Math.min(out.left, x);
    out.right = Math.max(out.right, x);
    out.top = Math.min(out.top, y);
    out.bottom = Math.max(out.bottom, y);
  }
  return out;
}

export function overlapsBody(a: LabelBounds, b: LabelBounds, gap = 6) {
  return (
    a.left < b.right + gap &&
    a.right > b.left - gap &&
    a.top < b.bottom + gap &&
    a.bottom > b.top - gap
  );
}

/** A globe as the depth mask sees it for one frame. */
export type LabelOccluder = {
  key: string;
  /** Visible, with some of it in front of the camera. */
  on: boolean;
  /** The globe's unit sphere from camera space. */
  local: Matrix4;
  /** A ball holding the globe, in camera space. */
  x: number;
  y: number;
  z: number;
  radius: number;
};

const view = new Matrix4();

/** Each body's globe for `labelDepthMask`, once a frame after the bodies have their poses;
 * `out`'s records are reused.
 */
export function labelOccluders(
  bodies: readonly LabelBody[],
  camera: PerspectiveCamera,
  out: LabelOccluder[] = [],
) {
  if (out.length > bodies.length) out.length = bodies.length;
  for (let i = 0; i < bodies.length; i += 1) {
    const { key, mesh } = bodies[i]!;
    const occluder = (out[i] ??= {
      key,
      on: false,
      local: new Matrix4(),
      x: 0,
      y: 0,
      z: 0,
      radius: 0,
    });
    occluder.key = key;
    occluder.on = false;
    if (!bodyVisible(mesh)) continue;
    const e = view.multiplyMatrices(camera.matrixWorldInverse, mesh.matrixWorld).elements;
    /* The linear part's largest stretch, bounded by Gershgorin on its columns' Gram matrix:
       exact for a rotated, scaled sphere, still a bound under shear. */
    const xx = e[0] * e[0] + e[1] * e[1] + e[2] * e[2];
    const yy = e[4] * e[4] + e[5] * e[5] + e[6] * e[6];
    const zz = e[8] * e[8] + e[9] * e[9] + e[10] * e[10];
    const xy = Math.abs(e[0] * e[4] + e[1] * e[5] + e[2] * e[6]);
    const xz = Math.abs(e[0] * e[8] + e[1] * e[9] + e[2] * e[10]);
    const yz = Math.abs(e[4] * e[8] + e[5] * e[9] + e[6] * e[10]);
    occluder.radius = Math.sqrt(Math.max(xx + xy + xz, yy + xy + yz, zz + xz + yz));
    occluder.x = e[12];
    occluder.y = e[13];
    occluder.z = e[14];
    // A globe wholly behind the camera covers nothing.
    occluder.on = occluder.radius > 0 && occluder.radius - occluder.z > 0;
    if (occluder.on) occluder.local.copy(view).invert();
  }
  return out;
}

/** A label's last mask: its runs of visible pixels and the CSS value they made. */
export type LabelMaskCache = { w: number; h: number; runs: number[]; value: string };

export const labelMaskCache = (): LabelMaskCache => ({ w: 0, h: 0, runs: [], value: "none" });

/* Per covering globe: the unit sphere's camera origin, |origin|² − 1, and the ray direction
   as a pixel's x and y step it. */
const STRIDE = 13;
let rays = new Float64Array(STRIDE * 4);
/* Visible runs as (row, start, length). */
let runs = new Int32Array(768);

/** Alpha mask for a screen-aligned label at its anchor's camera-space depth.
 * Rays use the same oriented ellipsoids as the globes. A nearer label never
 * loses pixels to a farther globe, even when their screen bounds overlap.
 * Only globes nearer than the anchor whose cone of sight meets the label's are
 * marched, a few multiply-adds a pixel; with `cache`, an unchanged mask returns
 * the same string, so the caller writes it only when it changes.
 */
export function labelDepthMask(
  rect: LabelBounds,
  anchor: Vector3,
  key: string,
  occluders: readonly LabelOccluder[],
  camera: PerspectiveCamera,
  width: number,
  height: number,
  cache?: LabelMaskCache,
) {
  const w = Math.ceil(rect.right - rect.left);
  const h = Math.ceil(rect.bottom - rect.top);
  if (w <= 0 || h <= 0) return "none";
  const v = camera.matrixWorldInverse.elements;
  const depth = -(v[2] * anchor.x + v[6] * anchor.y + v[10] * anchor.z + v[14]);
  const limit = depth * (1 - 1e-7);
  /* A pixel (px, py) looks along (ax px + bx, ay py + by, −1) in camera space, so a hit's
     ray parameter is its depth. */
  const p = camera.projectionMatrix.elements;
  const ax = 2 / (width * p[0]);
  const bx = (p[8] - 1) / p[0];
  const ay = -2 / (height * p[5]);
  const by = (1 + p[9]) / p[5];
  // The label's cone of sight: its centre ray and the cosine of its widest corner.
  const left = rect.left;
  const top = rect.top;
  const cx = ax * (left + w / 2) + bx;
  const cy = ay * (top + h / 2) + by;
  const cl = Math.hypot(cx, cy, 1);
  let cosLabel = 1;
  for (let i = 0; i < 4; i += 1) {
    const kx = ax * (i & 1 ? left + w : left) + bx;
    const ky = ay * (i & 2 ? top + h : top) + by;
    cosLabel = Math.min(cosLabel, (cx * kx + cy * ky + 1) / (cl * Math.hypot(kx, ky, 1)));
  }
  const sinLabel = Math.sqrt(Math.max(0, 1 - cosLabel * cosLabel));
  let n = 0;
  for (const occluder of occluders) {
    if (!occluder.on || occluder.key === key) continue;
    const { x, y, z, radius } = occluder;
    // Every point of the globe is at least this deep: none can cover a nearer label.
    if (-z - radius >= limit) continue;
    const distance = Math.hypot(x, y, z);
    if (distance > radius) {
      const sinGlobe = radius / distance;
      const cosGlobe = Math.sqrt(1 - sinGlobe * sinGlobe);
      const cos = (cx * x + cy * y - z) / (cl * distance);
      if (cos < cosGlobe * cosLabel - sinGlobe * sinLabel - 1e-9) continue;
    }
    if (rays.length < (n + 1) * STRIDE) {
      const grown = new Float64Array(rays.length * 2);
      grown.set(rays);
      rays = grown;
    }
    const l = occluder.local.elements;
    const k = n * STRIDE;
    rays[k] = l[12];
    rays[k + 1] = l[13];
    rays[k + 2] = l[14];
    rays[k + 3] = l[12] * l[12] + l[13] * l[13] + l[14] * l[14] - 1;
    for (let c = 0; c < 3; c += 1) {
      rays[k + 4 + c] = ax * l[c]!;
      rays[k + 7 + c] = ay * l[4 + c]!;
      rays[k + 10 + c] = bx * l[c]! + by * l[4 + c]! - l[8 + c]!;
    }
    n += 1;
  }
  if (!n) return "none";
  let covered = false;
  let count = 0;
  for (let y = 0; y < h; y += 1) {
    const py = top + y + 0.5;
    let start = -1;
    for (let x = 0; x <= w; x += 1) {
      let visible = false;
      if (x < w) {
        const px = left + x + 0.5;
        visible = true;
        for (let k = 0; k < n * STRIDE; k += STRIDE) {
          const dx = rays[k + 4]! * px + rays[k + 7]! * py + rays[k + 10]!;
          const dy = rays[k + 5]! * px + rays[k + 8]! * py + rays[k + 11]!;
          const dz = rays[k + 6]! * px + rays[k + 9]! * py + rays[k + 12]!;
          const od = rays[k]! * dx + rays[k + 1]! * dy + rays[k + 2]! * dz;
          const dd = dx * dx + dy * dy + dz * dz;
          const disc = od * od - dd * rays[k + 3]!;
          if (disc < 0) continue;
          const root = Math.sqrt(disc);
          const far = (root - od) / dd;
          if (far < 0) continue;
          const near = (-od - root) / dd;
          if ((near >= 0 ? near : far) < limit) {
            visible = false;
            break;
          }
        }
        if (!visible) covered = true;
      }
      if (visible && start < 0) start = x;
      if (!visible && start >= 0) {
        if (runs.length < count + 3) {
          const grown = new Int32Array(runs.length * 2);
          grown.set(runs);
          runs = grown;
        }
        runs[count] = y;
        runs[count + 1] = start;
        runs[count + 2] = x - start;
        count += 3;
        start = -1;
      }
    }
  }
  if (!covered) return "none";
  if (cache && cache.w === w && cache.h === h && cache.runs.length === count) {
    let same = true;
    for (let i = 0; i < count && same; i += 1) same = cache.runs[i] === runs[i];
    if (same) return cache.value;
  }
  let path = "";
  for (let i = 0; i < count; i += 3) {
    const row = runs[i]!;
    const from = runs[i + 1]!;
    path += `M${from} ${row}h${runs[i + 2]!}v1H${from}z`;
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><path fill="white" d="${path}"/></svg>`;
  const value = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
  if (cache) {
    cache.w = w;
    cache.h = h;
    cache.runs.length = count;
    for (let i = 0; i < count; i += 1) cache.runs[i] = runs[i]!;
    cache.value = value;
  }
  return value;
}

export type LabelTarget = { key: string; rect: LabelBounds };

/** The label at (x, y): each rect grows by `pad` and to at least `reach` px a side (a finger),
 * and of the labels it falls in, the one whose text is nearest wins.
 */
export function labelAt(targets: readonly LabelTarget[], x: number, y: number, reach = 0, pad = 0) {
  let best: string | null = null;
  let bestGap = Infinity;
  let bestOff = Infinity;
  for (const { key, rect } of targets) {
    const cx = (rect.left + rect.right) / 2;
    const cy = (rect.top + rect.bottom) / 2;
    const halfW = Math.max((rect.right - rect.left) / 2 + pad, reach / 2);
    const halfH = Math.max((rect.bottom - rect.top) / 2 + pad, reach / 2);
    if (Math.abs(x - cx) > halfW || Math.abs(y - cy) > halfH) continue;
    const gap = Math.hypot(
      Math.max(rect.left - x, 0, x - rect.right),
      Math.max(rect.top - y, 0, y - rect.bottom),
    );
    const off = Math.hypot(x - cx, y - cy);
    if (gap < bestGap || (gap === bestGap && off < bestOff)) {
      best = key;
      bestGap = gap;
      bestOff = off;
    }
  }
  return best;
}

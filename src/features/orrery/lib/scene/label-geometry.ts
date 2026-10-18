/** Label geometry follows rendered globe scales, including exaggerated map markers. */
import { Box3, Ray, Sphere, Vector3, type Mesh, type PerspectiveCamera } from "three";

export type LabelBody = { key: string; mesh: Mesh };
export type LabelBounds = { left: number; right: number; top: number; bottom: number };

const origin = new Vector3();
const direction = new Vector3();
const hit = new Vector3();
const ray = new Ray();
const sphere = new Sphere(new Vector3(), 1);
const box = new Box3();
const corner = new Vector3();

export function bodyVisible(mesh: Mesh) {
  for (let object: typeof mesh | typeof mesh.parent = mesh; object; object = object.parent) {
    if (!object.visible) return false;
  }
  return true;
}

/** Conservative screen bounds leave room for oblate globes at any viewing angle. */
export function bodyLabelBounds(
  mesh: Mesh,
  camera: PerspectiveCamera,
  width: number,
  height: number,
): LabelBounds | null {
  box.min.set(-1, -1, -1);
  box.max.set(1, 1, 1);
  box.applyMatrix4(mesh.matrixWorld);
  const bounds = { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity };
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
    bounds.left = Math.min(bounds.left, x);
    bounds.right = Math.max(bounds.right, x);
    bounds.top = Math.min(bounds.top, y);
    bounds.bottom = Math.max(bounds.bottom, y);
  }
  return bounds;
}

export function overlapsBody(a: LabelBounds, b: LabelBounds, gap = 6) {
  return (
    a.left < b.right + gap &&
    a.right > b.left - gap &&
    a.top < b.bottom + gap &&
    a.bottom > b.top - gap
  );
}

/** Alpha mask for a screen-aligned label at its anchor's camera-space depth.
 * Rays use the same oriented ellipsoids as the globes. A nearer label never
 * loses pixels to a farther globe, even when their screen bounds overlap.
 */
export function labelDepthMask(
  rect: LabelBounds,
  anchor: Vector3,
  key: string,
  bodies: readonly LabelBody[],
  bounds: readonly (LabelBounds | null)[],
  camera: PerspectiveCamera,
  width: number,
  height: number,
) {
  const candidates = bodies.flatMap((body, i) =>
    body.key !== key && bodyVisible(body.mesh) && (!bounds[i] || overlapsBody(rect, bounds[i], 0))
      ? [{ inverse: body.mesh.matrixWorld.clone().invert(), world: body.mesh.matrixWorld }]
      : [],
  );
  if (!candidates.length) return "none";
  const depth = -anchor.clone().applyMatrix4(camera.matrixWorldInverse).z;
  const w = Math.ceil(rect.right - rect.left);
  const h = Math.ceil(rect.bottom - rect.top);
  if (w <= 0 || h <= 0) return "none";
  const sample = new Vector3();
  const view = new Vector3();
  camera.getWorldPosition(origin);
  let covered = false;
  let path = "";
  for (let y = 0; y < h; y += 1) {
    let start = -1;
    for (let x = 0; x <= w; x += 1) {
      let visible = false;
      if (x < w) {
        sample
          .set(
            ((rect.left + x + 0.5) / width) * 2 - 1,
            1 - ((rect.top + y + 0.5) / height) * 2,
            0.5,
          )
          .unproject(camera);
        direction.subVectors(sample, origin).normalize();
        visible = !candidates.some((body) => {
          ray.set(origin, direction).applyMatrix4(body.inverse);
          if (!ray.intersectSphere(sphere, hit)) return false;
          view.copy(hit).applyMatrix4(body.world).applyMatrix4(camera.matrixWorldInverse);
          return -view.z < depth * (1 - 1e-7);
        });
        if (!visible) covered = true;
      }
      if (visible && start < 0) start = x;
      if (!visible && start >= 0) {
        path += `M${start} ${y}h${x - start}v1H${start}z`;
        start = -1;
      }
    }
  }
  if (!covered) return "none";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><path fill="white" d="${path}"/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
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

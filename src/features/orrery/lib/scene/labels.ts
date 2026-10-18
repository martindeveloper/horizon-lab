/** DOM labels pinned to scene points, written only when their text or position changes. */
import { Vector3 } from "three";

import type { Labels, SceneKit } from "./kit";
import { bodyLabelBounds, bodyVisible, labelDepthMask, type LabelBody } from "./label-geometry";

export type LabelStyle = {
  strong?: boolean;
  /** Text other than the translated label for the key. */
  text?: string;
  below?: boolean;
  kind?: "distance";
};

/** `on` is a switch or a presence 0..1 (labels fade with their layer; below ~2 % they hide). */
export type PlaceLabel = (
  key: string,
  x: number,
  y: number,
  z: number,
  on: boolean | number,
  style?: LabelStyle,
) => void;

export const STRONG: LabelStyle = { strong: true };
export const BELOW: LabelStyle = { below: true };

export function createLabels(
  { scope, camera, viewport }: SceneKit,
  root: HTMLElement,
  labels: Labels,
) {
  let bodies: readonly LabelBody[] = [];
  const pending = new Map<string, Parameters<PlaceLabel>>();
  const point = new Vector3();
  const spans = new Map<string, HTMLSpanElement>();
  // CSSOM may normalize "10.0px" to "10px"; compare our last output string.
  const masks = new WeakMap<HTMLSpanElement, string>();
  const transforms = new WeakMap<HTMLSpanElement, string>();
  /* Opacity in 1/32 steps, written only when the step changes. */
  const alphas = new WeakMap<HTMLSpanElement, number>();
  /* Live readouts gain and lose a digit as they play; a pill keeps its widest recent text
     and lets go only when the text gets much shorter (another body, another unit). */
  const held = new WeakMap<HTMLSpanElement, number>();
  const projected = new Vector3();
  const hide = (el: HTMLSpanElement) => {
    if (el.style.display !== "none") el.style.display = "none";
  };
  scope.defer(() => {
    for (const el of spans.values()) el.remove();
    spans.clear();
  });

  let bounds: ReturnType<typeof bodyLabelBounds>[] = [];
  const draw: PlaceLabel = (key, x, y, z, on, style) => {
    let el = spans.get(key);
    if (!el) {
      el = document.createElement("span");
      el.className = "orrery-label";
      root.appendChild(el);
      spans.set(key, el);
    }
    const label = style?.text ?? labels()[key] ?? key;
    const kind = style?.kind;
    if (el.textContent !== label) {
      el.textContent = label;
      if (kind) {
        const last = held.get(el) ?? 0;
        const chars = label.length > last || label.length < last - 3 ? label.length : last;
        if (chars !== last) {
          el.style.setProperty("--chars", String(chars));
          held.set(el, chars);
        }
      }
    }
    const weight = style?.strong ? "strong" : undefined;
    if (el.dataset.weight !== weight) {
      if (weight) el.dataset.weight = weight;
      else delete el.dataset.weight;
    }
    if (el.dataset.kind !== kind) {
      if (kind) el.dataset.kind = kind;
      else delete el.dataset.kind;
    }
    const alpha = typeof on === "number" ? on : on ? 1 : 0;
    if (alpha < 0.02) return hide(el);
    const step = Math.round(alpha * 32);
    if (alphas.get(el) !== step) {
      el.style.opacity = step >= 32 ? "" : String(step / 32);
      alphas.set(el, step);
    }
    point.set(x, y, z);
    projected.copy(point).applyMatrix4(camera.matrixWorldInverse);
    if (projected.z >= 0) return hide(el);
    projected.copy(point).project(camera);
    if (projected.z > 1) return hide(el);
    const { width, height } = viewport;
    const sx = (projected.x * 0.5 + 0.5) * width;
    let sy = (-projected.y * 0.5 + 0.5) * height;
    if (sx < 4 || sy < 56 || sx > width - 4 || sy > height - 150) return hide(el);
    if (el.style.display !== "block") el.style.display = "block";
    const ownIndex = bodies.findIndex((body) => body.key === key);
    const own = bounds[ownIndex];
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    if (own && !kind) sy = style?.below ? own.bottom + 6 : own.top - 6;
    const dy =
      own && !kind
        ? style?.below
          ? "0%"
          : "-100%"
        : kind
          ? "-50%"
          : style?.below
            ? "40%"
            : "-140%";
    const top =
      sy +
      (dy === "-100%"
        ? -h
        : dy === "-50%"
          ? -h / 2
          : dy === "40%"
            ? h * 0.4
            : dy === "-140%"
              ? -h * 1.4
              : 0);
    const rect = { left: sx - w / 2, right: sx + w / 2, top, bottom: top + h };
    if (rect.left < 4 || rect.right > width - 4 || rect.top < 56 || rect.bottom > height - 150)
      return hide(el);
    // DOM labels cannot share WebGL's depth buffer. Mask only the covered pixels,
    // at the anchor's depth, rather than hiding the label when its anchor is covered.
    const mask = labelDepthMask(rect, point, key, bodies, bounds, camera, width, height);
    if (masks.get(el) !== mask) {
      el.style.maskImage = mask;
      masks.set(el, mask);
    }
    const transform = `translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px) translate(-50%, ${dy})`;
    if (transforms.get(el) !== transform) {
      el.style.transform = transform;
      transforms.set(el, transform);
    }
  };

  const place: PlaceLabel = (...args) => {
    pending.set(args[0], args);
  };

  return {
    place,
    setBodies: (next: readonly LabelBody[]) => {
      bodies = next;
    },
    /** Resolve after all bodies have their current frame positions and scales. */
    flush: () => {
      for (const body of bodies) body.mesh.updateWorldMatrix(true, false);
      bounds = bodies.map(({ mesh }) =>
        bodyVisible(mesh) ? bodyLabelBounds(mesh, camera, viewport.width, viewport.height) : null,
      );
      for (const args of pending.values()) draw(...args);
      pending.clear();
    },
    /** Hides every label in `keys`. */
    hideAll: (keys: readonly string[]) => {
      for (const key of keys) place(key, 0, 0, 0, false);
    },
  };
}

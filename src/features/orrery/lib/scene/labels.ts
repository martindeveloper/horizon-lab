/** DOM labels pinned to scene points, written only when their text or position changes. */
import { Vector3 } from "three";

import type { Labels, SceneKit } from "./kit";

export type LabelStyle = {
  strong?: boolean;
  /** Text other than the translated label for the key. */
  text?: string;
  below?: boolean;
  kind?: "distance";
};

export type PlaceLabel = (
  key: string,
  x: number,
  y: number,
  z: number,
  on: boolean,
  style?: LabelStyle,
) => void;

export const STRONG: LabelStyle = { strong: true };
export const BELOW: LabelStyle = { below: true };

export function createLabels(
  { scope, camera, viewport }: SceneKit,
  root: HTMLElement,
  labels: Labels,
) {
  const spans = new Map<string, HTMLSpanElement>();
  // CSSOM may normalize "10.0px" to "10px"; compare our last output string.
  const transforms = new WeakMap<HTMLSpanElement, string>();
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

  const place: PlaceLabel = (key, x, y, z, on, style) => {
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
    if (!on) return hide(el);
    projected.set(x, y, z).project(camera);
    if (projected.z > 1) return hide(el);
    const { width, height } = viewport;
    const sx = (projected.x * 0.5 + 0.5) * width;
    const sy = (-projected.y * 0.5 + 0.5) * height;
    if (sx < 4 || sy < 56 || sx > width - 4 || sy > height - 150) return hide(el);
    if (el.style.display !== "block") el.style.display = "block";
    const dy = kind ? "-50%" : style?.below ? "40%" : "-140%";
    const transform = `translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px) translate(-50%, ${dy})`;
    if (transforms.get(el) !== transform) {
      el.style.transform = transform;
      transforms.set(el, transform);
    }
  };

  return {
    place,
    /** Hides every label in `keys`. */
    hideAll: (keys: readonly string[]) => {
      for (const key of keys) place(key, 0, 0, 0, false);
    },
  };
}

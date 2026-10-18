/** DOM labels pinned to scene points, written only when their text or position changes. */
import { Vector3 } from "three";

import type { LabelText, SceneBasics } from "./kit";
import {
  bodyLabelBounds,
  bodyVisible,
  labelDepthMask,
  type LabelBody,
  type LabelBounds,
  type LabelTarget,
} from "./label-geometry";

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

/** Labels fainter than this do not take taps. */
const READABLE = 0.3;
/** Gap kept between two labels, CSS px; closer, the less important one steps aside. */
const LABEL_GAP = 2;

/** A drawn label as a tap target: `clear` when no globe covers any of its text. */
export type LabelHit = LabelTarget & { clear: boolean };
type Target = LabelBounds & { alpha: number; clear: boolean; shown: boolean };

export const STRONG: LabelStyle = { strong: true };
export const BELOW: LabelStyle = { below: true };

/** Where labels may sit: CSS px kept clear at each edge (a header, a dock, a side control). */
export type LabelInsets = { top: number; bottom: number; left: number; right: number };

const DEFAULT_INSETS: LabelInsets = { top: 56, bottom: 150, left: 4, right: 4 };

export function createLabels(
  { scope, camera, viewport }: SceneBasics,
  root: HTMLElement,
  labels: LabelText,
  options: {
    /** Each label's class; `scene-label` is styled by `@horizon/toolkit/scene.css`. */
    className?: string;
    /** Fixed, or read once a frame when the controls over the stage move. */
    insets?: LabelInsets | (() => LabelInsets);
  } = {},
) {
  const { className = "scene-label", insets = DEFAULT_INSETS } = options;
  let inset = DEFAULT_INSETS;
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
  /* Where each label sits on screen, for taps: one record per label, rewritten each frame. */
  const targets = new Map<string, Target>();
  /* Each body's place in `bodies` and `bounds`. */
  const indexOf = new Map<string, number>();
  /* Labels drawn last frame, which keep their place when another one comes to overlap them. */
  let kept = new Set<string>();
  const hide = (key: string, el: HTMLSpanElement) => {
    const target = targets.get(key);
    if (target) target.shown = false;
    if (el.style.display !== "none") el.style.display = "none";
  };
  scope.defer(() => {
    for (const el of spans.values()) el.remove();
    spans.clear();
    targets.clear();
  });

  let bounds: ReturnType<typeof bodyLabelBounds>[] = [];
  const draw: PlaceLabel = (key, x, y, z, on, style) => {
    let el = spans.get(key);
    if (!el) {
      el = document.createElement("span");
      el.className = className;
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
    if (alpha < 0.02) return hide(key, el);
    const step = Math.round(alpha * 32);
    if (alphas.get(el) !== step) {
      el.style.opacity = step >= 32 ? "" : String(step / 32);
      alphas.set(el, step);
    }
    point.set(x, y, z);
    projected.copy(point).applyMatrix4(camera.matrixWorldInverse);
    if (projected.z >= 0) return hide(key, el);
    projected.copy(point).project(camera);
    if (projected.z > 1) return hide(key, el);
    const { width, height } = viewport;
    const sx = (projected.x * 0.5 + 0.5) * width;
    let sy = (-projected.y * 0.5 + 0.5) * height;
    if (sx < inset.left || sy < inset.top || sx > width - inset.right || sy > height - inset.bottom)
      return hide(key, el);
    if (el.style.display !== "block") el.style.display = "block";
    const ownIndex = indexOf.get(key);
    const own = ownIndex === undefined ? undefined : bounds[ownIndex];
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
    let rect = targets.get(key);
    if (!rect) {
      rect = { left: 0, right: 0, top: 0, bottom: 0, alpha: 0, clear: false, shown: false };
      targets.set(key, rect);
    }
    rect.left = sx - w / 2;
    rect.right = sx + w / 2;
    rect.top = top;
    rect.bottom = top + h;
    if (
      rect.left < inset.left ||
      rect.right > width - inset.right ||
      rect.top < inset.top ||
      rect.bottom > height - inset.bottom
    )
      return hide(key, el);
    // DOM labels cannot share WebGL's depth buffer. Mask only the covered pixels,
    // at the anchor's depth, rather than hiding the label when its anchor is covered.
    const mask = labelDepthMask(rect, point, key, bodies, bounds, camera, width, height);
    rect.alpha = alpha;
    rect.clear = mask === "none";
    rect.shown = true;
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

  /**
   * Strong names first, then names, then distances; a label already shown before a new one,
   * and a faint one (fading in or out) after every readable one.
   */
  const rank = (key: string, el: HTMLSpanElement, rect: Target) =>
    (el.dataset.weight ? 0 : el.dataset.kind ? 4 : 2) +
    (kept.has(key) ? 0 : 1) +
    (rect.alpha < READABLE ? 6 : 0);
  /**
   * Overlapping labels cannot both be read, least of all on a phone: each label is drawn only
   * where no more important one already sits, so names win over rulers and nothing flickers
   * as two labels cross.
   */
  const declutter = () => {
    const shown: { key: string; el: HTMLSpanElement; rect: Target; rank: number }[] = [];
    for (const [key, rect] of targets) {
      const el = spans.get(key);
      if (rect.shown && el) shown.push({ key, el, rect, rank: rank(key, el, rect) });
    }
    shown.sort((a, b) => a.rank - b.rank);
    const placed: Target[] = [];
    const next = new Set<string>();
    for (const { key, el, rect } of shown) {
      const blocked = placed.some(
        (o) =>
          rect.left < o.right + LABEL_GAP &&
          rect.right > o.left - LABEL_GAP &&
          rect.top < o.bottom + LABEL_GAP &&
          rect.bottom > o.top - LABEL_GAP,
      );
      if (blocked) hide(key, el);
      else {
        placed.push(rect);
        next.add(key);
      }
    }
    kept = next;
  };

  return {
    place,
    setBodies: (next: readonly LabelBody[]) => {
      bodies = next;
      indexOf.clear();
      next.forEach((body, i) => indexOf.set(body.key, i));
    },
    /** Resolve after all bodies have their current frame positions and scales. */
    flush: () => {
      inset = typeof insets === "function" ? insets() : insets;
      for (const body of bodies) body.mesh.updateWorldMatrix(true, false);
      bounds = bodies.map(({ mesh }) =>
        bodyVisible(mesh) ? bodyLabelBounds(mesh, camera, viewport.width, viewport.height) : null,
      );
      for (const args of pending.values()) draw(...args);
      pending.clear();
      declutter();
    },
    /** Labels readable enough to tap, in viewport px, of the keys `accept` takes. */
    hits: (accept: (key: string) => boolean): LabelHit[] => {
      const out: LabelHit[] = [];
      for (const [key, target] of targets)
        if (target.shown && target.alpha >= READABLE && accept(key))
          out.push({ key, rect: target, clear: target.clear });
      return out;
    },
    /** Hides every label in `keys`. */
    hideAll: (keys: readonly string[]) => {
      for (const key of keys) place(key, 0, 0, 0, false);
    },
  };
}

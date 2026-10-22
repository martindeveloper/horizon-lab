/** DOM labels pinned to scene points, written only when their text or position changes. */
import { Vector3 } from "three";

import type { LabelText, SceneBasics } from "./kit";
import {
  bodyLabelBounds,
  bodyVisible,
  labelDepthMask,
  labelMaskCache,
  labelOccluders,
  type LabelBody,
  type LabelBounds,
  type LabelMaskCache,
  type LabelOccluder,
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

/* One label across frames: what `place` last asked, its element and what was last written. */
type Entry = {
  key: string;
  el: HTMLSpanElement | null;
  rect: Target;
  x: number;
  y: number;
  z: number;
  on: boolean | number;
  style: LabelStyle | undefined;
  /* Placed since the last flush. */
  queued: boolean;
  text: string | null;
  strong: boolean;
  kind: LabelStyle["kind"];
  /* Live readouts gain and lose a digit as they play; a pill keeps its widest recent text
     and lets go only when the text gets much shorter (another body, another unit). */
  chars: number;
  /* CSS size, measured again only after the text, weight or kind change. */
  width: number;
  height: number;
  measured: boolean;
  /* The anchor on screen this frame. */
  sx: number;
  sy: number;
  // CSSOM may normalize "10.0px" to "10px"; compare our last output strings.
  display: string;
  transform: string;
  mask: string;
  masks: LabelMaskCache;
  /* Opacity in 1/32 steps, written only when the step changes. */
  step: number;
  /* Drawn last frame: it keeps its place when another one comes to overlap it. */
  kept: boolean;
  rank: number;
};

export const STRONG: LabelStyle = { strong: true };
export const BELOW: LabelStyle = { below: true };

/** Where labels may sit: CSS px kept clear at each edge (a header, a dock, a side control). */
export type LabelInsets = { top: number; bottom: number; left: number; right: number };

/** Where labels keep clear by default: a 56 px header, a 150 px dock and a 4 px edge each side. */
export const DEFAULT_INSETS: LabelInsets = { top: 56, bottom: 150, left: 4, right: 4 };

const byRank = (a: Entry, b: Entry) => a.rank - b.rank;

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
  /* Every label by key, in the order first placed; `queue` holds this frame's, `drawn` those
     on screen, `shown` and `placed` the declutter's, all reused from frame to frame. */
  const entries = new Map<string, Entry>();
  const all: Entry[] = [];
  const queue: Entry[] = [];
  const drawn: Entry[] = [];
  const shown: Entry[] = [];
  const placed: Target[] = [];
  const point = new Vector3();
  const projected = new Vector3();
  /* Each body's place in `bodies` and `bounds`. */
  const indexOf = new Map<string, number>();
  const bounds: (LabelBounds | null)[] = [];
  const boxes: LabelBounds[] = [];
  const occluders: LabelOccluder[] = [];
  let measuredWidth = 0;
  let measuredHeight = 0;
  const remeasure = () => {
    for (const entry of all) entry.measured = false;
  };
  /* A web font arriving changes every label's size. */
  const fonts = typeof document === "undefined" ? undefined : document.fonts;
  fonts?.addEventListener("loadingdone", remeasure);
  scope.defer(() => {
    fonts?.removeEventListener("loadingdone", remeasure);
    for (const entry of all) entry.el?.remove();
    entries.clear();
    all.length = 0;
    queue.length = 0;
  });

  const hide = (entry: Entry) => {
    entry.rect.shown = false;
    if (entry.el && entry.display !== "none") {
      entry.el.style.display = "none";
      entry.display = "none";
    }
  };

  const hidden = (entry: Entry) => {
    hide(entry);
    return false;
  };

  /* First pass, writes only: content, weight, kind, opacity and whether the anchor is on
     screen. True when the label needs its size and a place. */
  const write = (entry: Entry, text: Record<string, string>) => {
    let el = entry.el;
    if (!el) {
      el = document.createElement("span");
      el.className = className;
      root.appendChild(el);
      entry.el = el;
    }
    const { key, style } = entry;
    const label = style?.text ?? text[key] ?? key;
    const kind = style?.kind;
    if (entry.text !== label) {
      el.textContent = label;
      entry.text = label;
      entry.measured = false;
      if (kind) {
        const last = entry.chars;
        const chars = label.length > last || label.length < last - 3 ? label.length : last;
        if (chars !== last) {
          el.style.setProperty("--chars", String(chars));
          entry.chars = chars;
        }
      }
    }
    const strong = style?.strong === true;
    if (entry.strong !== strong) {
      if (strong) el.dataset.weight = "strong";
      else delete el.dataset.weight;
      entry.strong = strong;
      entry.measured = false;
    }
    if (entry.kind !== kind) {
      if (kind) el.dataset.kind = kind;
      else delete el.dataset.kind;
      entry.kind = kind;
      entry.measured = false;
    }
    const { on } = entry;
    const alpha = typeof on === "number" ? on : on ? 1 : 0;
    if (alpha < 0.02) return hidden(entry);
    const step = Math.round(alpha * 32);
    if (entry.step !== step) {
      el.style.opacity = step >= 32 ? "" : String(step / 32);
      entry.step = step;
    }
    entry.rect.alpha = alpha;
    point.set(entry.x, entry.y, entry.z);
    projected.copy(point).applyMatrix4(camera.matrixWorldInverse);
    if (projected.z >= 0) return hidden(entry);
    projected.copy(point).project(camera);
    if (projected.z > 1) return hidden(entry);
    const { width, height } = viewport;
    const sx = (projected.x * 0.5 + 0.5) * width;
    const sy = (-projected.y * 0.5 + 0.5) * height;
    if (sx < inset.left || sy < inset.top || sx > width - inset.right || sy > height - inset.bottom)
      return hidden(entry);
    if (entry.display !== "block") {
      el.style.display = "block";
      entry.display = "block";
    }
    entry.sx = sx;
    entry.sy = sy;
    return true;
  };

  /* Last pass, after every size is known: place, mask and move. */
  const draw = (entry: Entry, el: HTMLSpanElement) => {
    const { key, kind, style, rect, sx, width: w, height: h } = entry;
    const { width, height } = viewport;
    let sy = entry.sy;
    const ownIndex = indexOf.get(key);
    const own = ownIndex === undefined ? undefined : bounds[ownIndex];
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
      return hide(entry);
    // DOM labels cannot share WebGL's depth buffer. Mask only the covered pixels,
    // at the anchor's depth, rather than hiding the label when its anchor is covered.
    point.set(entry.x, entry.y, entry.z);
    const mask = labelDepthMask(rect, point, key, occluders, camera, width, height, entry.masks);
    rect.clear = mask === "none";
    rect.shown = true;
    if (entry.mask !== mask) {
      el.style.maskImage = mask;
      entry.mask = mask;
    }
    const transform = `translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px) translate(-50%, ${dy})`;
    if (entry.transform !== transform) {
      el.style.transform = transform;
      entry.transform = transform;
    }
  };

  const place: PlaceLabel = (key, x, y, z, on, style) => {
    let entry = entries.get(key);
    if (!entry) {
      entry = {
        key,
        el: null,
        rect: { left: 0, right: 0, top: 0, bottom: 0, alpha: 0, clear: false, shown: false },
        x: 0,
        y: 0,
        z: 0,
        on: false,
        style: undefined,
        queued: false,
        text: null,
        strong: false,
        kind: undefined,
        chars: 0,
        width: 0,
        height: 0,
        measured: false,
        sx: 0,
        sy: 0,
        display: "",
        transform: "",
        mask: "",
        masks: labelMaskCache(),
        step: -1,
        kept: false,
        rank: 0,
      };
      entries.set(key, entry);
      all.push(entry);
    }
    entry.x = x;
    entry.y = y;
    entry.z = z;
    entry.on = on;
    entry.style = style;
    if (!entry.queued) {
      entry.queued = true;
      queue.push(entry);
    }
  };

  /**
   * Strong names first, then names, then distances; a label already shown before a new one,
   * and a faint one (fading in or out) after every readable one.
   */
  const rank = (entry: Entry) =>
    (entry.strong ? 0 : entry.kind ? 4 : 2) +
    (entry.kept ? 0 : 1) +
    (entry.rect.alpha < READABLE ? 6 : 0);
  /**
   * Overlapping labels cannot both be read, least of all on a phone: each label is drawn only
   * where no more important one already sits, so names win over rulers and nothing flickers
   * as two labels cross.
   */
  const declutter = () => {
    shown.length = 0;
    for (const entry of all) {
      if (entry.rect.shown && entry.el) {
        entry.rank = rank(entry);
        shown.push(entry);
      }
      entry.kept = false;
    }
    shown.sort(byRank);
    placed.length = 0;
    for (const entry of shown) {
      const { rect } = entry;
      let blocked = false;
      for (const o of placed) {
        if (
          rect.left < o.right + LABEL_GAP &&
          rect.right > o.left - LABEL_GAP &&
          rect.top < o.bottom + LABEL_GAP &&
          rect.bottom > o.top - LABEL_GAP
        ) {
          blocked = true;
          break;
        }
      }
      if (blocked) hide(entry);
      else {
        placed.push(rect);
        entry.kept = true;
      }
    }
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
      const { width, height } = viewport;
      for (const body of bodies) body.mesh.updateWorldMatrix(true, false);
      bounds.length = bodies.length;
      for (let i = 0; i < bodies.length; i += 1) {
        const { mesh } = bodies[i]!;
        const box = (boxes[i] ??= { left: 0, right: 0, top: 0, bottom: 0 });
        bounds[i] = bodyVisible(mesh) ? bodyLabelBounds(mesh, camera, width, height, box) : null;
      }
      labelOccluders(bodies, camera, occluders);
      /* A resized stage may restyle the labels (a phone's smaller type). */
      if (measuredWidth !== width || measuredHeight !== height) {
        measuredWidth = width;
        measuredHeight = height;
        remeasure();
      }
      // Writes, one read of the sizes that changed, then writes: one layout a frame at most.
      const text = labels();
      drawn.length = 0;
      for (const entry of queue) {
        entry.queued = false;
        if (write(entry, text)) drawn.push(entry);
      }
      queue.length = 0;
      for (const entry of drawn) {
        if (entry.measured || !entry.el) continue;
        entry.width = entry.el.offsetWidth;
        entry.height = entry.el.offsetHeight;
        // A label root not laid out yet measures nothing; try again next frame.
        entry.measured = entry.width > 0 || entry.height > 0;
      }
      for (const entry of drawn) if (entry.el) draw(entry, entry.el);
      declutter();
    },
    /** Labels readable enough to tap, in viewport px, of the keys `accept` takes. */
    hits: (accept: (key: string) => boolean): LabelHit[] => {
      const out: LabelHit[] = [];
      for (const { key, rect } of all)
        if (rect.shown && rect.alpha >= READABLE && accept(key))
          out.push({ key, rect, clear: rect.clear });
      return out;
    },
    hideAll: (keys: readonly string[]) => {
      for (const key of keys) place(key, 0, 0, 0, false);
    },
  };
}

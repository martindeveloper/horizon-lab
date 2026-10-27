/** Taps on a canvas: a name tapped squarely wins, then the objects under the pointer, then a near miss. */
import { Raycaster, Vector2, type Intersection, type Object3D, type Ray } from "three";

import { TAP_SLOP_PX } from "../camera";
import type { SceneBasics } from "./kit";
import { labelAt } from "./label-geometry";
import type { LabelHit } from "./labels";

/** A fingertip, CSS px across: near misses on touch still reach a name this close. */
export const FINGER_PX = 44;
/** A small target's reach, CSS px from its centre: under a fingertip anywhere on it. */
export const TAP_REACH_PX = FINGER_PX / 2;

/** A second tap on the same thing within this window means more (a close-up), ms. */
export const DOUBLE_TAP_MS = 380;

/**
 * Tells a second tap on the same key within `windowMs` from a first: the first tap remembers
 * its key, the second answers true and forgets it, so a third starts over.
 */
export function createDoubleTap(windowMs = DOUBLE_TAP_MS, now = () => performance.now()) {
  let lastKey = "";
  let lastAt = 0;
  return (key: string) => {
    const at = now();
    const twice = key === lastKey && at - lastAt < windowMs;
    lastKey = twice ? "" : key;
    lastAt = at;
    return twice;
  };
}

/** What a tap landed on: an object's `userData.pick` (and instance), or what a label opens. */
export type TapTarget = { pick: unknown; instance?: number | undefined };

export function createTapPicking(
  { scope, camera }: Pick<SceneBasics, "scope" | "camera">,
  canvas: HTMLCanvasElement,
  options: {
    pickables: Object3D[];
    /** Which of the shown objects under the pointer (nearest first) a tap meant; the nearest by default. */
    choose?: (hits: Intersection[], ray: Ray) => Intersection | undefined;
    /** Render layers to raycast besides the default one. */
    layers?: readonly number[];
    /** Taps are ignored while something else holds the camera. */
    blocked: () => boolean;
    /** Names readable enough to tap. */
    labels: () => LabelHit[];
    /** What a name opens. */
    labelPick: (key: string) => unknown;
    /** A tap: on something, or on nothing (null). */
    onTap: (target: TapTarget | null) => void;
  },
) {
  const raycaster = new Raycaster();
  for (const layer of options.layers ?? []) raycaster.layers.enable(layer);
  const pointer = new Vector2();
  /** Where each pointer now down went down; a press that grew a second one was a pinch. */
  const down = new Map<number, { x: number; y: number }>();
  let pinch = false;
  const shown = (object: Object3D | null): boolean =>
    !object || (object.visible && shown(object.parent));

  const under = (event: PointerEvent): TapTarget | null => {
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const labels = options.labels();
    const squarely = labelAt(
      labels.filter((label) => label.clear),
      x,
      y,
      0,
      2,
    );
    if (squarely) return { pick: options.labelPick(squarely) };
    pointer.set((x / rect.width) * 2 - 1, -(y / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster
      .intersectObjects(options.pickables, false)
      .filter((candidate) => shown(candidate.object));
    const hit = options.choose ? options.choose(hits, raycaster.ray) : hits[0];
    if (hit) return { pick: hit.object.userData.pick, instance: hit.instanceId };
    const near = labelAt(labels, x, y, event.pointerType === "mouse" ? 0 : FINGER_PX, 4);
    return near ? { pick: options.labelPick(near) } : null;
  };

  const onDown = (event: PointerEvent) => {
    down.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (down.size > 1) pinch = true;
  };
  /** Lets a pointer go; true when it ends a single press, not a pinch. */
  const release = (event: PointerEvent) => {
    const single = down.delete(event.pointerId) && !pinch;
    if (down.size === 0) pinch = false;
    return single;
  };
  const onUp = (event: PointerEvent) => {
    const start = down.get(event.pointerId);
    if (!release(event) || !start || options.blocked()) return;
    if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > TAP_SLOP_PX) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    options.onTap(under(event));
  };

  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointercancel", release);
  scope.defer(() => {
    canvas.removeEventListener("pointerdown", onDown);
    canvas.removeEventListener("pointerup", onUp);
    canvas.removeEventListener("pointercancel", release);
  });
}

/** Taps on a canvas: a name tapped squarely wins, then the objects under the pointer, then a near miss. */
import { Raycaster, Vector2, type Object3D } from "three";

import type { SceneBasics } from "./kit";
import { labelAt } from "./label-geometry";
import type { LabelHit } from "./labels";

/** A fingertip: near misses on touch still reach a name this close. */
const FINGER_PX = 44;
/** A press that moved farther than this was a drag, not a tap. */
const DRAG_PX = 6;

/** What a tap landed on: an object's `userData.pick` (and instance), or what a label opens. */
export type TapTarget = { pick: unknown; instance?: number | undefined };

export function createTapPicking(
  { scope, camera }: Pick<SceneBasics, "scope" | "camera">,
  canvas: HTMLCanvasElement,
  options: {
    pickables: Object3D[];
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
    const hit = raycaster
      .intersectObjects(options.pickables, false)
      .find((candidate) => shown(candidate.object));
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
    if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > DRAG_PX) return;
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

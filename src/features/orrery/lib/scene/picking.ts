/** Taps on the canvas or a name select what is under them; a second tap on a body flies in. */
import { Raycaster, Vector2, type Object3D } from "three";

import { planetElements } from "../model/elements";
import { migrationProgress } from "../model/timeline";
import { TRACERS, tracerElements } from "../model/tracers";
import { hasSurface, type Selection, type useOrrery } from "../store";
import type { SceneKit } from "./kit";
import { labelAt } from "./label-geometry";
import type { LabelHit } from "./labels";
import { GALAXY_LAYER } from "./lod";

/** A second tap on the same body within this window flies in for a close-up. */
const DOUBLE_TAP_MS = 380;
/** A fingertip: near misses on touch still reach a name this close. */
const FINGER_PX = 44;

export function createPicking(
  { scope, camera }: SceneKit,
  canvas: HTMLCanvasElement,
  store: typeof useOrrery,
  options: {
    pickables: Object3D[];
    /** Taps are ignored while the guide or a close-up holds the camera. */
    blocked: () => boolean;
    distance: () => number;
    /** Names readable enough to tap, and what each opens. */
    labels: () => LabelHit[];
    labelPick: (key: string) => Selection | undefined;
  },
) {
  const raycaster = new Raycaster();
  /* The Galaxy draws in its own pass but is picked like the rest. */
  raycaster.layers.enable(GALAXY_LAYER);
  const pointer = new Vector2();
  let downX = 0;
  let downY = 0;
  let lastTapKey = "";
  let lastTapAt = 0;
  const shown = (object: Object3D | null): boolean =>
    !object || (object.visible && shown(object.parent));

  /* Names sit over the scene: one tapped squarely wins; a near miss only where nothing is hit. */
  const under = (event: PointerEvent): { pick: unknown; instance?: number | undefined } | null => {
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
    downX = event.clientX;
    downY = event.clientY;
  };
  const onUp = (event: PointerEvent) => {
    /* In a close-up, taps never pull the camera away; Back, Escape or zooming out do. */
    if (options.blocked()) return;
    if (Math.hypot(event.clientX - downX, event.clientY - downY) > 6) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const api = store.getState();
    const target = under(event);
    if (!target) {
      api.select(null);
      return;
    }
    const { pick, instance } = target;
    if (!isSelection(pick)) return;
    const distance = options.distance();
    if (pick.kind === "tracer") {
      const index = instance ?? -1;
      const tr = TRACERS[index];
      if (!tr) return;
      const el = tracerElements(tr, migrationProgress(api.yearsAgo), 0);
      const apo = el.a * (1 + Math.min(0.995, el.e));
      api.setView(apo > 8_000 ? "oort" : apo > 350 ? "scattered" : apo > 45 ? "kuiper" : "giants");
      api.select({ kind: "tracer", index });
      return;
    }
    if (pick.kind === "planet") {
      const a = planetElements(pick.id, 1, 0, new Date()).a;
      if (distance > a * 8 || distance < a * 0.4)
        api.setView(a < 2 ? "inner" : a < 12 ? "giants" : "kuiper");
    } else if (pick.kind === "named") {
      api.setView(pick.id === "sedna" ? "scattered" : pick.id === "pluto" ? "kuiper" : "giants");
    } else if (pick.kind === "population" && pick.id === "asteroids") api.setView("inner");
    else if (pick.kind === "star" && distance < 50_000) return;
    const key = JSON.stringify(pick);
    const at = performance.now();
    const twice = key === lastTapKey && at - lastTapAt < DOUBLE_TAP_MS;
    lastTapKey = twice ? "" : key;
    lastTapAt = at;
    api.select(pick);
    if (twice && hasSurface(pick)) api.enterCloseUp();
  };

  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointerup", onUp);
  scope.defer(() => {
    canvas.removeEventListener("pointerdown", onDown);
    canvas.removeEventListener("pointerup", onUp);
  });
}

function isSelection(value: unknown): value is Selection {
  if (typeof value !== "object" || value === null || !("kind" in value)) return false;
  if (value.kind === "sun") return true;
  if (value.kind === "tracer") return "index" in value && typeof value.index === "number";
  return (
    (value.kind === "planet" ||
      value.kind === "named" ||
      value.kind === "population" ||
      value.kind === "galaxy" ||
      value.kind === "cosmos" ||
      value.kind === "star") &&
    "id" in value &&
    typeof value.id === "string"
  );
}

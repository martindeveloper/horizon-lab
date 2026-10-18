/** Taps on the canvas select what is under them; a second tap on a body flies in. */
import { Raycaster, Vector2, type Object3D } from "three";

import { planetElements } from "../model/elements";
import { migrationProgress } from "../model/timeline";
import { TRACERS, tracerElements } from "../model/tracers";
import { hasSurface, type Selection, type useOrrery } from "../store";
import type { SceneKit } from "./kit";
import { GALAXY_LAYER } from "./lod";

/** A second tap on the same body within this window flies in for a close-up. */
const DOUBLE_TAP_MS = 380;

export function createPicking(
  { scope, camera }: SceneKit,
  canvas: HTMLCanvasElement,
  store: typeof useOrrery,
  options: {
    pickables: Object3D[];
    /** Taps are ignored while the guide or a close-up holds the camera. */
    blocked: () => boolean;
    distance: () => number;
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

  const onDown = (event: PointerEvent) => {
    downX = event.clientX;
    downY = event.clientY;
  };
  const onUp = (event: PointerEvent) => {
    /* In a close-up, taps never pull the camera away; Back, Escape or zooming out do. */
    if (options.blocked()) return;
    if (Math.hypot(event.clientX - downX, event.clientY - downY) > 6) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const rect = canvas.getBoundingClientRect();
    pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster
      .intersectObjects(options.pickables, false)
      .filter((hit) => shown(hit.object));
    const hit = hits[0];
    const api = store.getState();
    if (!hit) {
      api.select(null);
      return;
    }
    const pick = hit.object.userData.pick;
    if (!isSelection(pick)) return;
    const distance = options.distance();
    if (pick.kind === "tracer") {
      const index = hit.instanceId ?? -1;
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
      value.kind === "star") &&
    "id" in value &&
    typeof value.id === "string"
  );
}

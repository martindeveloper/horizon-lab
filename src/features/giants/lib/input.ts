import { TAP_SLOP_PX, wheelPixels } from "@horizon/toolkit/camera";
import type { DisposalScope } from "@horizon/toolkit/rendering";
import { isSceneShortcut } from "@horizon/toolkit/ui";

import type { Stage } from "./model/ladder";
import { RUNG_IDS } from "./model/rungs";
import { DRAG_RUNGS, SNAP_DELAY_MS, WHEEL_RUNGS } from "./parameters";
import { useGiants } from "./store";

/** Wheel, pointer and keyboard gestures, translated into ladder or pair navigation. */
export function createGiantsInput(
  resources: DisposalScope,
  host: HTMLElement,
  {
    inputAllowed,
    surveying,
    stage,
    pick,
    globeAt,
    turn,
    release,
    lastRung,
    navigation,
  }: {
    inputAllowed: () => boolean;
    surveying: () => boolean;
    stage: () => Stage;
    pick: (x: number, y: number) => number | null;
    globeAt: (x: number, y: number) => number | null;
    turn: (index: number, dx: number, dy: number, dt: number) => void;
    release: (index: number, moving: boolean) => void;
    lastRung: number;
    navigation: {
      paired: () => boolean;
      take: () => void;
      nearest: () => number;
      stop: () => void;
      nudge: (by: number) => void;
      drag: (by: number) => void;
      coast: (by: number, velocity: number | null) => void;
      snap: () => void;
    };
  },
) {
  let snapTimer: number | undefined;
  const snapSoon = () => {
    window.clearTimeout(snapTimer);
    snapTimer = window.setTimeout(navigation.snap, SNAP_DELAY_MS);
  };
  resources.defer(() => window.clearTimeout(snapTimer));

  const onWheel = (event: WheelEvent) => {
    if (!inputAllowed()) return;
    event.preventDefault();
    /* A wheel over the overview goes back to the ladder, where the camera was. */
    if (surveying()) return useGiants.getState().setOverview(false);
    const pixels = wheelPixels(event.deltaY, event.deltaMode, host.clientHeight);
    const across = wheelPixels(event.deltaX, event.deltaMode, host.clientWidth);
    const by = ((pixels + across) / 100) * WHEEL_RUNGS;
    /* Side by side, the wheel zooms between the two and rests wherever it leaves them. */
    navigation.nudge(by);
    if (navigation.paired()) return;
    snapSoon();
  };
  host.addEventListener("wheel", onWheel, { passive: false });
  resources.defer(() => host.removeEventListener("wheel", onWheel));

  /**
   * One pointer's drag: where it started, how far it went, its recent speed in rungs a second,
   * and what it took hold of as it went down: a globe it turns, or the camera it climbs the
   * ladder with (neither over the overview, where it only taps).
   */
  type Drag = {
    id: number;
    x: number;
    y: number;
    moved: number;
    last: number;
    velocity: number;
    globe: number | null;
    camera: boolean;
  };
  let drag: Drag | null = null;
  const climbOf = (dx: number, dy: number) => (-(dx + dy) / stage().height) * DRAG_RUNGS;
  const onDown = (event: PointerEvent) => {
    /* One pointer holds the stage at a time: a second finger starts nothing and takes nothing over. */
    if (drag) return;
    if (!inputAllowed() || (event.pointerType === "mouse" && event.button !== 0)) return;
    /* A body's name is a button: its own click opens the card, so it starts no drag. */
    if (event.target instanceof Element && event.target.closest("[data-rung]")) return;
    /* On a globe the hand turns it and leaves the camera be; elsewhere it takes the camera
       where it is, and a glide or a pending snap stops here. Over the overview it only taps. */
    const tapOnly = surveying();
    const globe = tapOnly ? null : globeAt(event.clientX, event.clientY);
    const camera = globe === null && !tapOnly;
    if (camera) {
      if (!navigation.paired()) window.clearTimeout(snapTimer);
      navigation.stop();
    }
    drag = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      moved: 0,
      last: event.timeStamp,
      velocity: 0,
      globe,
      camera,
    };
    host.setPointerCapture(event.pointerId);
  };
  const onMove = (event: PointerEvent) => {
    if (!drag || event.pointerId !== drag.id) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    drag.moved += Math.hypot(dx, dy);
    drag.x = event.clientX;
    drag.y = event.clientY;
    const dt = Math.max(1, event.timeStamp - drag.last) / 1000;
    drag.last = event.timeStamp;
    if (drag.globe !== null) {
      if (drag.moved <= TAP_SLOP_PX) return;
      const index = drag.globe;
      turn(index, dx, dy, dt);
      return;
    }
    if (surveying()) return;
    const climb = climbOf(dx, dy);
    drag.velocity = 0.7 * drag.velocity + 0.3 * (climb / dt);
    if (drag.moved > TAP_SLOP_PX) {
      if (!navigation.paired()) window.clearTimeout(snapTimer);
      navigation.drag(climb);
    }
  };
  /**
   * Ends the live drag: what it held is let go, then a tap acts. `lifted` is the pointer's
   * release; without one the gesture was cancelled (the system took the touch, the guide
   * opened) and ends as a hand lifted at rest: no tap, no flick.
   */
  const end = (lifted: PointerEvent | null) => {
    if (!drag) return;
    const ended = drag;
    drag = null;
    if (host.hasPointerCapture(ended.id)) host.releasePointerCapture(ended.id);
    const dragged = ended.moved > TAP_SLOP_PX;
    const moving = lifted !== null && dragged && lifted.timeStamp - ended.last < 80;
    if (ended.globe !== null) {
      /* A turned globe coasts if flicked, and later goes home by itself (`grab.ts`). */
      if (dragged) release(ended.globe, moving);
    } else if (ended.camera) {
      /* The camera settles on a rung, stopped mid-glide by a tap as much as dragged; a flick
         carries on a little first, the glide taking over the hand's speed. Side by side it
         settles wherever it comes to rest on the pair's rail. */
      navigation.coast(moving ? ended.velocity * 0.18 : 0, moving ? ended.velocity : null);
    }
    if (lifted === null || dragged) return;
    const index = pick(lifted.clientX, lifted.clientY);
    if (index !== null) useGiants.getState().goTo(RUNG_IDS[index]!);
  };
  const onUp = (event: PointerEvent) => {
    if (event.pointerId === drag?.id) end(event);
  };
  const onCancel = (event: PointerEvent) => {
    if (event.pointerId === drag?.id) end(null);
  };
  host.addEventListener("pointerdown", onDown);
  host.addEventListener("pointermove", onMove);
  host.addEventListener("pointerup", onUp);
  host.addEventListener("pointercancel", onCancel);
  resources.defer(() => {
    host.removeEventListener("pointerdown", onDown);
    host.removeEventListener("pointermove", onMove);
    host.removeEventListener("pointerup", onUp);
    host.removeEventListener("pointercancel", onCancel);
  });

  /* Left and right step along the ladder, Home and End go to its ends; up rises to the
     overview and down goes back to the ladder. */
  const STEPS: Record<string, number | "first" | "last" | "overview" | "ladder"> = {
    ArrowRight: 1,
    PageDown: 1,
    ArrowLeft: -1,
    PageUp: -1,
    Home: "first",
    End: "last",
    ArrowUp: "overview",
    ArrowDown: "ladder",
  };
  const onKey = (event: KeyboardEvent) => {
    const step = STEPS[event.key];
    /* A button a click left focused (a body's name, Overview) leaves the arrows to the scene. */
    if (step === undefined || !inputAllowed() || !isSceneShortcut(event, { controls: "buttons" })) {
      return;
    }
    if (step === "ladder" && !surveying()) return;
    event.preventDefault();
    const state = useGiants.getState();
    switch (step) {
      case "overview":
        state.setOverview(true);
        break;
      case "ladder":
        state.setOverview(false);
        break;
      case "first":
        navigation.take();
        state.go(0);
        break;
      case "last":
        navigation.take();
        state.go(lastRung);
        break;
      default:
        navigation.take();
        state.go(navigation.nearest() + step);
    }
  };
  window.addEventListener("keydown", onKey);
  resources.defer(() => window.removeEventListener("keydown", onKey));

  return {
    get dragging() {
      return drag !== null;
    },
    cancel: () => end(null),
  };
}

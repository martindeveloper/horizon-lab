/**
 * Looking round from orbit: a drag turns the view, a double tap or click brings it back to
 * rest, the arrow keys turn it. Nothing zooms: the disc's size is the Sun's story, set by the
 * framing as its radius changes, so a wheel or a pinch is taken and does nothing (the page
 * neither scrolls nor scales under the scene). The drag is the kit's orbit input
 * (`createOrbitInput`: pointer capture, drag, pinch, wheel), read as a turn of the view rather
 * than of an orbit; the double tap and the keys are this view's own. Canvas-local; the engine
 * owns the view, eases it to where the input aims it and clamps it so the Sun and the limb
 * stay in frame.
 */
import { TAP_SLOP_PX, createOrbitInput } from "@horizon/toolkit/camera";
import { isSceneShortcut } from "@horizon/toolkit/ui";

export type LookInputOptions = {
  /** Turns the view by radians (yaw left, pitch up): a drag carries the scene with the hand. */
  turn: (yaw: number, pitch: number) => void;
  /** A double tap or click: the view back to rest. */
  reset: () => void;
  /** Radians per CSS pixel of drag now: the view's own, so the scene stays under the hand. */
  perPixel: () => number;
  /** Input is ignored while this is false (the help tour drives the view). */
  enabled: () => boolean;
};

/** A second tap within this long (ms) and this near (CSS px) of the first is a double tap. */
const DOUBLE_TAP_MS = 320;
const DOUBLE_TAP_PX = 24;
/** A key's turn, radians. */
const KEY_TURN = Math.PI / 36;
/** The orbit input's distance, unread: it only needs bounds. */
const ROOM = { min: 0.5, max: 2 } as const;

export function createLookInput(canvas: HTMLCanvasElement, options: LookInputOptions) {
  const gestures = createOrbitInput(canvas, {
    getPose: () => ({ azimuth: 0, inclination: 0, distance: 1 }),
    onChange: (pose, source) => {
      if (source.kind === "drag") {
        options.turn(-pose.azimuth, pose.inclination);
      }
    },
    enabled: options.enabled,
    distance: ROOM,
    inclination: { min: -Math.PI / 2, max: Math.PI / 2 },
    dragSensitivity: { azimuth: 1, inclination: 1 },
    dragScale: () => options.perPixel(),
  });
  let lastTap: { at: number; x: number; y: number } | null = null;
  const tap = (event: PointerEvent) => {
    if (!options.enabled() || !event.isPrimary) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const now = performance.now();
    const near =
      lastTap &&
      now - lastTap.at < DOUBLE_TAP_MS &&
      Math.hypot(event.clientX - lastTap.x, event.clientY - lastTap.y) < DOUBLE_TAP_PX;
    if (near) {
      lastTap = null;
      options.reset();
    } else lastTap = { at: now, x: event.clientX, y: event.clientY };
  };
  /* A press that became a drag is not the first half of a double tap. */
  const moved = (event: PointerEvent) => {
    if (lastTap && Math.hypot(event.clientX - lastTap.x, event.clientY - lastTap.y) > TAP_SLOP_PX) {
      lastTap = null;
    }
  };
  const key = (event: KeyboardEvent) => {
    if (!options.enabled() || !isSceneShortcut(event)) return;
    switch (event.key) {
      case "ArrowLeft":
        options.turn(KEY_TURN, 0);
        break;
      case "ArrowRight":
        options.turn(-KEY_TURN, 0);
        break;
      case "ArrowUp":
        options.turn(0, KEY_TURN);
        break;
      case "ArrowDown":
        options.turn(0, -KEY_TURN);
        break;
      default:
        return;
    }
    event.preventDefault();
  };
  canvas.addEventListener("pointerdown", tap);
  canvas.addEventListener("pointermove", moved);
  window.addEventListener("keydown", key);
  return () => {
    gestures.dispose();
    canvas.removeEventListener("pointerdown", tap);
    canvas.removeEventListener("pointermove", moved);
    window.removeEventListener("keydown", key);
  };
}

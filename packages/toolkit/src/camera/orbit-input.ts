import { clamp } from "../math/index";
import type { OrbitPose } from "./flight";
import { wheelPixels } from "./flight-input";

export type OrbitInputOptions = {
  getPose: () => OrbitPose;
  onChange: (pose: OrbitPose) => void;
  enabled?: () => boolean;
  distance: { min: number; max: number };
  inclination?: { min: number; max: number };
  dragSensitivity?: { azimuth: number; inclination: number };
  wheelSensitivity?: (distance: number, trackpadPinch: boolean) => number;
};

/** Canvas-local input. No store, camera singleton, animation loop or renderer dependency. */
/** Two fingers closer than this (CSS px) are not yet a pinch; the zoom baseline waits. */
const PINCH_MIN_PX = 24;
/** A press that moved farther than this (CSS px) was a drag, not a tap. */
export const TAP_SLOP_PX = 6;

export function createOrbitInput(canvas: HTMLCanvasElement, options: OrbitInputOptions) {
  if (
    !Number.isFinite(options.distance.min) ||
    !Number.isFinite(options.distance.max) ||
    options.distance.min <= 0 ||
    options.distance.max <= options.distance.min
  )
    throw new RangeError("Orbit distance bounds require 0 < min < max");
  const pointers = new Map<number, { x: number; y: number }>();
  const previousTouchAction = canvas.style.touchAction;
  const bounds = options.inclination ?? { min: -1.35, max: 1.35 };
  const sensitivity = options.dragSensitivity ?? { azimuth: 0.005, inclination: 0.004 };
  let dragging = false;
  let pinchLock = false;
  let lastX = 0,
    lastY = 0,
    pinch0 = 0,
    dist0 = 0;
  const enabled = () => options.enabled?.() ?? true;
  const distance = (value: number) => clamp(value, options.distance.min, options.distance.max);
  function gap() {
    const [a, b] = [...pointers.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  }
  function cancel() {
    for (const id of pointers.keys())
      if (canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
    pointers.clear();
    dragging = false;
    pinchLock = false;
    pinch0 = 0;
  }
  function down(event: PointerEvent) {
    if (!enabled() || (event.pointerType === "mouse" && event.button !== 0)) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    canvas.setPointerCapture(event.pointerId);
    if (pointers.size === 1) {
      dragging = true;
      pinchLock = false;
      lastX = event.clientX;
      lastY = event.clientY;
    } else {
      dragging = false;
      pinchLock = true;
      pinch0 = gap() > PINCH_MIN_PX ? gap() : 0;
      dist0 = options.getPose().distance;
    }
  }
  function move(event: PointerEvent) {
    if (!enabled()) {
      cancel();
      return;
    }
    if (!pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const pose = options.getPose();
    if (pointers.size >= 2) {
      const currentGap = gap();
      if (currentGap > PINCH_MIN_PX) {
        if (pinch0 <= PINCH_MIN_PX) {
          // Fingers can start very close together. Begin the pinch once separable,
          // keeping the current zoom as its baseline rather than locking forever.
          pinch0 = currentGap;
          dist0 = pose.distance;
        } else options.onChange({ ...pose, distance: distance((dist0 * pinch0) / currentGap) });
      }
      return;
    }
    if (pinchLock || !dragging) return;
    const dx = event.clientX - lastX,
      dy = event.clientY - lastY;
    lastX = event.clientX;
    lastY = event.clientY;
    options.onChange({
      ...pose,
      azimuth: pose.azimuth - dx * sensitivity.azimuth,
      inclination: clamp(pose.inclination + dy * sensitivity.inclination, bounds.min, bounds.max),
    });
  }
  function up(event: PointerEvent) {
    if (!pointers.delete(event.pointerId)) return;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    if (pointers.size >= 2) {
      pinch0 = gap() > PINCH_MIN_PX ? gap() : 0;
      dist0 = options.getPose().distance;
    } else if (pointers.size === 1) {
      dragging = false;
      pinchLock = true;
    } else cancel();
  }
  function wheel(event: WheelEvent) {
    if (!enabled()) return;
    event.preventDefault();
    if (pointers.size >= 2) return;
    const pose = options.getPose();
    const sensitivity = options.wheelSensitivity?.(pose.distance, event.ctrlKey) ?? 0.001;
    const pixels = wheelPixels(event.deltaY, event.deltaMode, canvas.clientHeight);
    options.onChange({
      ...pose,
      distance: distance(pose.distance * Math.exp(pixels * sensitivity)),
    });
  }
  canvas.style.touchAction = "none";
  canvas.addEventListener("pointerdown", down);
  canvas.addEventListener("pointermove", move);
  canvas.addEventListener("pointerup", up);
  canvas.addEventListener("pointercancel", up);
  canvas.addEventListener("lostpointercapture", up);
  canvas.addEventListener("wheel", wheel, { passive: false });
  window.addEventListener("blur", cancel);
  return {
    get active() {
      return dragging || pointers.size >= 2;
    },
    cancel,
    dispose() {
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", up);
      canvas.removeEventListener("lostpointercapture", up);
      canvas.removeEventListener("wheel", wheel);
      window.removeEventListener("blur", cancel);
      cancel();
      canvas.style.touchAction = previousTouchAction;
    },
  };
}

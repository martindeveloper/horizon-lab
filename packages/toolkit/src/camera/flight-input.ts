/**
 * Canvas-local input for flying a ship: pointer drag to look, wheel to throttle, keyboard
 * axes and a gamepad. Like `createOrbitInput`, it owns no camera: it reports look deltas and
 * an axes object, and the host's integrator decides what they do. No store, loop or renderer.
 */

/** What the pilot is asking for. One object per input, written in place every change. */
export type FlightAxes = {
  /** −1…1: forward (W, left stick up) positive. */
  thrust: number;
  /** −1…1: right (D, left stick right) positive. */
  strafe: number;
  /** −1…1: up (R) positive, down (F) negative. */
  lift: number;
  /** −1…1: E positive, Q negative; the integrator defines the sense. */
  roll: number;
  /** 0…1: Shift, or the right trigger's travel. */
  boost: number;
  /** 0…1: X, or the left trigger's travel; the integrator says what it brakes against. */
  brake: number;
  /** Space held: hold position, the integrator's way. */
  park: boolean;
};

export type FlightInputOptions = {
  /** A pointer drag or the right stick, in CSS pixels (the stick: pixels per poll). */
  onLook: (dx: number, dy: number) => void;
  /** The axes changed (a key went down or up, or a gamepad poll read something). */
  onAxes: (axes: FlightAxes) => void;
  /** Wheel travel normalized to pixels (16 per line, the canvas height per page); `trackpadPinch` is ctrl+wheel. */
  onWheel: (deltaPixels: number, trackpadPinch: boolean) => void;
  enabled?: () => boolean;
  /**
   * Whether a key event is the scene's to take (the app passes its scene-shortcut test);
   * keys with ctrl, alt or meta held are never taken. Default: every key.
   */
  isShortcut?: (event: KeyboardEvent) => boolean;
  /** Keys count only while focus is inside this element or the canvas; default the canvas's parent. */
  stage?: Element | null;
  /** Below this stick travel a gamepad axis reads zero (default `STICK_DEADZONE`). */
  deadzone?: number;
  /** Pixels of look per poll at full right-stick deflection (default `STICK_LOOK_PX`). */
  stickLook?: number;
};

export type FlightInput = {
  /** True while a drag, a held key or a live gamepad reading is on. */
  readonly active: boolean;
  /** The one axes object the input writes; read it, never keep a copy. */
  readonly axes: FlightAxes;
  /** Lets go of everything: pointer capture, keys and the axes (a scripted flight takes over). */
  cancel(): void;
  dispose(): void;
};

/** Stick travel treated as centred. */
export const STICK_DEADZONE = 0.15;
/** Look pixels per poll at full right-stick deflection. */
export const STICK_LOOK_PX = 24;
/** How often a connected gamepad is read, ms. */
export const GAMEPAD_POLL_MS = 250;
/** Pixels one page of wheel scroll stands for when the canvas has no height yet. */
const PAGE_FALLBACK_PX = 800;
/** Standard-mapping gamepad button indices. */
const LEFT_TRIGGER = 6;
const RIGHT_TRIGGER = 7;

/**
 * `event.code` of every key the input reads: the pilot's hands stay on these. None is a key the
 * stage's own chrome takes (F toggles immersive view), so both act with focus in the stage.
 */
export const FLIGHT_KEYS = new Set([
  "KeyW",
  "KeyS",
  "KeyA",
  "KeyD",
  "KeyQ",
  "KeyE",
  "KeyR",
  "KeyV",
  "KeyX",
  "ShiftLeft",
  "ShiftRight",
  "Space",
]);

export function createFlightAxes(): FlightAxes {
  return { thrust: 0, strafe: 0, lift: 0, roll: 0, boost: 0, brake: 0, park: false };
}

const axis = (keys: ReadonlySet<string>, positive: string, negative: string) =>
  (keys.has(positive) ? 1 : 0) - (keys.has(negative) ? 1 : 0);

/** The axes a set of held key codes asks for, written into `out` (opposed keys cancel). */
export function flightAxesFromKeys(keys: ReadonlySet<string>, out: FlightAxes) {
  out.thrust = axis(keys, "KeyW", "KeyS");
  out.strafe = axis(keys, "KeyD", "KeyA");
  out.lift = axis(keys, "KeyR", "KeyV");
  out.roll = axis(keys, "KeyE", "KeyQ");
  out.boost = keys.has("ShiftLeft") || keys.has("ShiftRight") ? 1 : 0;
  out.brake = keys.has("KeyX") ? 1 : 0;
  out.park = keys.has("Space");
  return out;
}

/** A stick reading with its deadzone removed and the rest stretched back to ±1. */
export function stickValue(raw: number, deadzone = STICK_DEADZONE) {
  const size = Math.abs(raw);
  if (!(size > deadzone)) return 0;
  return Math.sign(raw) * Math.min(1, (size - deadzone) / (1 - deadzone));
}

/** Wheel travel in pixels: lines are 16 px, a page the canvas height. */
export function wheelPixels(deltaY: number, deltaMode: number, clientHeight: number) {
  const unit = deltaMode === 1 ? 16 : deltaMode === 2 ? clientHeight || PAGE_FALLBACK_PX : 1;
  return deltaY * unit;
}

/** True when the axes ask for nothing. */
export function axesIdle(axes: FlightAxes) {
  return (
    axes.thrust === 0 &&
    axes.strafe === 0 &&
    axes.lift === 0 &&
    axes.roll === 0 &&
    axes.boost === 0 &&
    axes.brake === 0 &&
    !axes.park
  );
}

/**
 * The standard-mapping readings of one gamepad onto the axes: left stick thrust and strafe,
 * triggers boost and brake; the right stick is returned as look pixels. Keyboard values
 * already in `out` win where they are larger, so both can be held at once.
 */
export function readGamepad(
  pad: { axes: ReadonlyArray<number>; buttons: ReadonlyArray<{ value: number }> },
  out: FlightAxes,
  deadzone = STICK_DEADZONE,
  stickLook = STICK_LOOK_PX,
) {
  const stick = (i: number) => stickValue(pad.axes[i] ?? 0, deadzone);
  const trigger = (i: number) => Math.min(1, Math.max(0, pad.buttons[i]?.value ?? 0));
  const thrust = -stick(1);
  const strafe = stick(0);
  if (Math.abs(thrust) > Math.abs(out.thrust)) out.thrust = thrust;
  if (Math.abs(strafe) > Math.abs(out.strafe)) out.strafe = strafe;
  out.boost = Math.max(out.boost, trigger(RIGHT_TRIGGER));
  out.brake = Math.max(out.brake, trigger(LEFT_TRIGGER));
  return { dx: stick(2) * stickLook, dy: stick(3) * stickLook };
}

export function createFlightInput(
  canvas: HTMLCanvasElement,
  options: FlightInputOptions,
): FlightInput {
  const axes = createFlightAxes();
  const keys = new Set<string>();
  const previousTouchAction = canvas.style.touchAction;
  const deadzone = options.deadzone ?? STICK_DEADZONE;
  const stickLook = options.stickLook ?? STICK_LOOK_PX;
  const stage = options.stage === undefined ? canvas.parentElement : options.stage;
  let pointer: number | null = null;
  let lastX = 0;
  let lastY = 0;
  let poll: ReturnType<typeof setInterval> | null = null;
  let padLive = false;
  const enabled = () => options.enabled?.() ?? true;

  function publish() {
    flightAxesFromKeys(keys, axes);
    options.onAxes(axes);
  }
  function releasePointer() {
    if (pointer !== null && canvas.hasPointerCapture(pointer))
      canvas.releasePointerCapture(pointer);
    pointer = null;
  }
  function cancel() {
    releasePointer();
    if (keys.size > 0 || !axesIdle(axes)) {
      keys.clear();
      publish();
    }
  }
  function down(event: PointerEvent) {
    if (!enabled() || (event.pointerType === "mouse" && event.button !== 0)) return;
    if (pointer !== null) return;
    pointer = event.pointerId;
    canvas.setPointerCapture(event.pointerId);
    lastX = event.clientX;
    lastY = event.clientY;
  }
  function move(event: PointerEvent) {
    if (pointer !== event.pointerId) return;
    if (!enabled()) {
      cancel();
      return;
    }
    const dx = event.clientX - lastX;
    const dy = event.clientY - lastY;
    lastX = event.clientX;
    lastY = event.clientY;
    if (dx !== 0 || dy !== 0) options.onLook(dx, dy);
  }
  function up(event: PointerEvent) {
    if (pointer === event.pointerId) releasePointer();
  }
  function wheel(event: WheelEvent) {
    if (!enabled()) return;
    event.preventDefault();
    options.onWheel(wheelPixels(event.deltaY, event.deltaMode, canvas.clientHeight), event.ctrlKey);
  }
  /** Single-key shortcuts act only while the stage holds focus (WCAG 2.1.4). */
  function focused() {
    const target = document.activeElement;
    if (!target) return false;
    return target === canvas || canvas.contains(target) || (stage?.contains(target) ?? false);
  }
  function takes(event: KeyboardEvent) {
    if (!FLIGHT_KEYS.has(event.code) || event.ctrlKey || event.altKey || event.metaKey)
      return false;
    if (!enabled() || !focused()) return false;
    return options.isShortcut?.(event) ?? true;
  }
  function keydown(event: KeyboardEvent) {
    if (!takes(event)) return;
    event.preventDefault();
    if (event.repeat || keys.has(event.code)) return;
    keys.add(event.code);
    publish();
  }
  function keyup(event: KeyboardEvent) {
    if (!keys.delete(event.code)) return;
    if (FLIGHT_KEYS.has(event.code)) event.preventDefault();
    publish();
  }
  function readPads() {
    if (!enabled()) return;
    flightAxesFromKeys(keys, axes);
    let dx = 0;
    let dy = 0;
    let any = false;
    for (const pad of navigator.getGamepads()) {
      if (!pad) continue;
      any = true;
      const look = readGamepad(pad, axes, deadzone, stickLook);
      dx += look.dx;
      dy += look.dy;
    }
    if (!any) {
      stopPolling();
      return;
    }
    if (dx !== 0 || dy !== 0) options.onLook(dx, dy);
    const live = !axesIdle(axes) || dx !== 0 || dy !== 0;
    if (live || padLive) options.onAxes(axes);
    padLive = live;
  }
  function startPolling() {
    if (poll !== null || typeof navigator.getGamepads !== "function") return;
    poll = setInterval(readPads, GAMEPAD_POLL_MS);
  }
  function stopPolling() {
    if (poll === null) return;
    clearInterval(poll);
    poll = null;
    if (padLive) {
      padLive = false;
      publish();
    }
  }
  function disconnected() {
    const pads = navigator.getGamepads();
    if (!pads.some(Boolean)) stopPolling();
  }

  canvas.style.touchAction = "none";
  canvas.addEventListener("pointerdown", down);
  canvas.addEventListener("pointermove", move);
  canvas.addEventListener("pointerup", up);
  canvas.addEventListener("pointercancel", up);
  canvas.addEventListener("lostpointercapture", up);
  canvas.addEventListener("wheel", wheel, { passive: false });
  window.addEventListener("keydown", keydown);
  window.addEventListener("keyup", keyup);
  window.addEventListener("blur", cancel);
  window.addEventListener("gamepadconnected", startPolling);
  window.addEventListener("gamepaddisconnected", disconnected);
  if (typeof navigator !== "undefined" && typeof navigator.getGamepads === "function")
    try {
      if (navigator.getGamepads().some(Boolean)) startPolling();
    } catch {
      /* Some browsers refuse getGamepads() before a user gesture; the connect event starts it. */
    }

  return {
    get active() {
      return pointer !== null || keys.size > 0 || padLive;
    },
    axes,
    cancel,
    dispose() {
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", up);
      canvas.removeEventListener("lostpointercapture", up);
      canvas.removeEventListener("wheel", wheel);
      window.removeEventListener("keydown", keydown);
      window.removeEventListener("keyup", keyup);
      window.removeEventListener("blur", cancel);
      window.removeEventListener("gamepadconnected", startPolling);
      window.removeEventListener("gamepaddisconnected", disconnected);
      stopPolling();
      cancel();
      canvas.style.touchAction = previousTouchAction;
    },
  };
}

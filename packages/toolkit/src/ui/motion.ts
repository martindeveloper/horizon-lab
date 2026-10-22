import { prefersReducedMotion } from "../environment";

export type MotionDuration = "feedback" | "control" | "reveal" | "scene";
export type MotionEase = "standard" | "enter" | "exit";

/** The header's responsive spring; settling time is not a fixed transition duration. */
export const controlSpring = { type: "spring", stiffness: 520, damping: 38, mass: 0.7 } as const;

/** Read the CSS tokens for Web Animations, including local overrides. Call only on a mounted element. */
export function uiMotion(
  element: Element,
  duration: MotionDuration,
  ease: MotionEase = "standard",
) {
  const style = getComputedStyle(element);
  const value = style.getPropertyValue(`--transition-duration-${duration}`).trim();
  const time = /^(\d*\.?\d+)(ms|s)$/.exec(value);
  const ms = time ? Number(time[1]) * (time[2] === "s" ? 1000 : 1) : 0;
  return {
    duration: prefersReducedMotion() ? 0 : ms,
    easing: style.getPropertyValue(`--ease-${ease}`).trim() || "linear",
  };
}

/**
 * Wait for this element's finite animations/transitions, not descendants or ambient loops.
 * Reading getAnimations flushes the new CSS state. Cancellation also settles the wait (e.g.
 * reduced motion changing live). Call the returned cleanup before reversing/reopening a view
 * so an old completion cannot remove its new contents. With no motion, settle in a microtask.
 * An optional minimum hold is independent of the animation duration.
 */
export function afterMotion(element: Element, onFinish: () => void, minimumMs = 0) {
  let active = true;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const hold =
    minimumMs > 0
      ? new Promise<void>((resolve) => {
          timer = setTimeout(resolve, minimumMs);
        })
      : Promise.resolve();
  const animations = element
    .getAnimations()
    .filter((animation) => Number.isFinite(Number(animation.effect?.getComputedTiming().endTime)));
  void Promise.allSettled([hold, ...animations.map((animation) => animation.finished)]).then(() => {
    if (active) onFinish();
  });
  return () => {
    active = false;
    clearTimeout(timer);
  };
}

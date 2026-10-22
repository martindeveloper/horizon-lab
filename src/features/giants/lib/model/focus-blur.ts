import { smoothstep } from "@horizon/toolkit/math";

/** Presentation blur in CSS pixels, unrelated to physical distance. The nearest body stays
 * sharp throughout a flight; both neighbours are sharp at the halfway handover. Tiny discs
 * get proportionally less blur, so they remain visible rather than dissolving into the sky. */
export function focusBlurRadius(index: number, place: number, radius: number): number {
  return Math.min(2, Math.max(0, radius) * 0.12) * smoothstep(0.5, 1, Math.abs(index - place));
}

/** A short, frame-rate-independent toggle fade; reduced motion changes it immediately. */
export function fadeFocusBlur(level: number, enabled: boolean, dt: number, reduced: boolean) {
  const target = enabled ? 1 : 0;
  if (reduced) return target;
  const next = target + (level - target) * Math.exp(-Math.max(0, dt) * 12);
  return Math.abs(next - target) < 0.001 ? target : next;
}

/** Conservative visibility test for the filter's padded ellipses, in back-to-front order.
 * False guarantees a copy-only frame. Keep the shader's 4% + 4px padding and 10px fade.
 * A sharp foreground disc containing the viewport also erases every mask behind it. */
export function needsFocusBlur(
  shapes: readonly { x: number; y: number; z: number; w: number }[],
  radii: ArrayLike<number>,
  count: number,
  width: number,
  height: number,
) {
  for (let i = count - 1; i >= 0; i--) {
    const shape = shapes[i]!;
    const ax = shape.z * 1.04 + 4;
    const ay = shape.w * 1.04 + 4;
    if (radii[i]! > 0) {
      // The shader fades in elliptical distance, so its support is wider on the long axis.
      const padding = 1 + 10 / Math.min(ax, ay);
      if (
        shape.x + ax * padding >= 0 &&
        shape.x - ax * padding <= width &&
        shape.y + ay * padding >= 0 &&
        shape.y - ay * padding <= height
      )
        return true;
    } else {
      const dx = Math.max(Math.abs(shape.x), Math.abs(width - shape.x)) / ax;
      const dy = Math.max(Math.abs(shape.y), Math.abs(height - shape.y)) / ay;
      if (dx * dx + dy * dy < 1 - 1e-6) return false;
    }
  }
  return false;
}

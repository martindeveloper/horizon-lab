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

/** Rain-drop clocks. Radii in units of M. Schwarzschild teaching geodesic. */

export const DROP_START = [22, 17.5, 13.2, 9.2, 5.8];
/** Azimuth offsets from the camera, so the chain sits on the near face. */
const DROP_SPREAD = [-0.42, -0.21, 0, 0.21, 0.42];

export const RAIN_FLOOR = 2.06;

/** Real seconds between flashes for a clock ticking at the far-away rate. */
export const FLASH_PERIOD = 0.9;
/** Lifetime of an emitted flash ring, in real seconds. */
export const FLASH_LIFE = 1.8;
/** Fade-out after a beacon reaches the horizon floor, in real seconds. */
export const FADE_LIFE = 1.6;

export type Flash = { r: number; age: number; rate: number };

export type Drop = {
  r: number;
  spread: number;
  tau: number;
  phase: number;
  gone: boolean;
  fade: number;
  flashes: Flash[];
};

/** Every drop back at its start radius, with staggered flash phases. */
export function freshDrops(): Drop[] {
  return DROP_START.map((r, i) => ({
    r,
    spread: DROP_SPREAD[i] ?? 0,
    tau: 0,
    phase: (i * 0.37) % 1,
    gone: false,
    fade: 0,
    flashes: [],
  }));
}

const DEEP_RED: [number, number, number] = [138, 42, 26];
const AMBER: [number, number, number] = [226, 150, 82];
const WARM_WHITE: [number, number, number] = [244, 236, 216];

/** Warm white at the far-away rate, through amber, to deep red at the horizon. */
export function beaconColor(rate: number): [number, number, number] {
  const x = Math.min(1, Math.max(0, rate));
  const [a, b, k] = x < 0.5 ? [DEEP_RED, AMBER, x * 2] : [AMBER, WARM_WHITE, x * 2 - 1];
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
}

/** CSS rgba() with a clamped, three-decimal alpha. */
export function rgba([r, g, b]: [number, number, number], alpha: number) {
  return `rgba(${r.toFixed(0)}, ${g.toFixed(0)}, ${b.toFixed(0)}, ${Math.max(0, alpha).toFixed(3)})`;
}

/** Simulation paces: coordinate time (units of M) per real second. */
export const SPEEDS = [
  { id: "slow", label: "Slow", rate: 2.2 },
  { id: "class", label: "Class", rate: 5 },
  { id: "fast", label: "Fast", rate: 10.5 },
] as const;

export type SpeedId = (typeof SPEEDS)[number]["id"];

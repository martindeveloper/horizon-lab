import { toLogFraction } from "@horizon/toolkit/math";

import { horizonOverM, iscoOverM, photonOverM } from "./physics";

export type PinId = "horizon" | "photon" | "isco" | "doppler";

export const PIN_IDS: PinId[] = ["horizon", "photon", "isco", "doppler"];

/** Equatorial radius in units of M for this hole’s spin. */
export function pinRadius(id: PinId, spin: number): number {
  if (id === "horizon") return horizonOverM(spin);
  if (id === "photon") return photonOverM(spin);
  if (id === "isco") return iscoOverM(spin);
  return Math.min(11.4, Math.max(iscoOverM(spin) * 1.35, 7.2));
}

export const PIN_RING_COLOR: Record<PinId, string> = {
  horizon: "#c45b4a",
  photon: "#e2c56a",
  isco: "#d4d0c8",
  doppler: "#9aa3b0",
};

export function ringPoints(radius: number, n = 128): { x: number; y: number; z: number }[] {
  const pts: { x: number; y: number; z: number }[] = [];
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * Math.PI * 2;
    pts.push({ x: radius * Math.sin(t), y: 0, z: radius * Math.cos(t) });
  }
  return pts;
}

/** Radial gauge range in units of M, drawn on a log scale. */
const GAUGE_MIN_R = 1;
const GAUGE_MAX_R = 100;

/** Gauge position for radius r: 0 at the bottom (r = M), 1 at the top. */
export const gaugeFraction = (r: number) => toLogFraction(r, GAUGE_MIN_R, GAUGE_MAX_R);

/** Log-scale minor ticks: 1…9, 10…90, 100. */
export const GAUGE_TICKS = (() => {
  const ticks: { r: number; major: boolean }[] = [];
  for (let decade = GAUGE_MIN_R; decade < GAUGE_MAX_R; decade *= 10) {
    for (let k = 1; k < 10; k++) ticks.push({ r: decade * k, major: k === 1 });
  }
  ticks.push({ r: GAUGE_MAX_R, major: true });
  return ticks;
})();

/** Gauge radius text: fewer decimals as r grows. */
export function formatR(r: number) {
  return r < 10 ? r.toFixed(2) : r < 100 ? r.toFixed(1) : r.toFixed(0);
}

/** Push label centres apart by at least `gap`, keeping them inside [0, height]. */
export function spreadLabels(ys: number[], gap: number, height: number): number[] {
  const order = ys.map((y, i) => ({ y, i })).sort((a, b) => a.y - b.y);
  const out = order.map((o) => o.y);
  const at = (index: number) => {
    const value = out[index];
    if (value === undefined) throw new Error("Label index is out of range.");
    return value;
  };
  for (let i = 1; i < out.length; i++) out[i] = Math.max(at(i), at(i - 1) + gap);
  const last = out.length - 1;
  if (last >= 0) out[last] = Math.min(at(last), height);
  for (let i = last - 1; i >= 0; i--) out[i] = Math.min(at(i), at(i + 1) - gap);
  if (out.length > 0) out[0] = Math.max(at(0), 0);
  for (let i = 1; i < out.length; i++) out[i] = Math.max(at(i), at(i - 1) + gap);
  const result = Array.from<number>({ length: ys.length });
  order.forEach((o, k) => {
    result[o.i] = at(k);
  });
  return result;
}

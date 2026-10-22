/** Passive plasma tracers integrated through the SAME kinematic reconnection velocity. */
import { clamp01 } from "@horizon/toolkit/math";

import type { Region } from "./contract";
import { displayHeight, displayWidth, type Geometry } from "./eruption";
import { eruptionBasis, eruptionPoint } from "./eruption-lines";
import { X_POINT_S } from "./parameters";
import { transportAt } from "./reconnection";

// Illustrative tracer sampling, not particle counts or measured plasma density.
export const FLOW_PARTICLES = 64;
const STEPS = 600;
const DT = (1 - X_POINT_S) / STEPS;
let tracks: Float32Array | null = null;

/** Stored reference-plane trajectories make scrubbing exactly reversible. */
function trajectories() {
  if (tracks) return tracks;
  tracks = new Float32Array((STEPS + 1) * FLOW_PARTICLES * 2);
  const v1 = { vx: 0, vy: 0, resistivity: 0 },
    v2 = { ...v1 },
    v3 = { ...v1 },
    v4 = { ...v1 };
  for (let k = 0; k < FLOW_PARTICLES; k++) {
    const side = k % 2 === 0 ? 1 : -1;
    const branch = Math.floor(k / 2) % 2 === 0 ? 1 : -1;
    let x = side * (0.08 + 0.065 * (Math.floor(k / 4) % 4));
    let y = 1 + branch * (0.025 + 0.025 * Math.floor(k / 16));
    for (let i = 0; i <= STEPS; i++) {
      const at = 2 * (i * FLOW_PARTICLES + k);
      tracks[at] = x;
      tracks[at + 1] = y;
      if (i === STEPS) break;
      const s = X_POINT_S + i * DT;
      transportAt(x, y, s, v1);
      transportAt(x + (DT * v1.vx) / 2, y + (DT * v1.vy) / 2, s + DT / 2, v2);
      transportAt(x + (DT * v2.vx) / 2, y + (DT * v2.vy) / 2, s + DT / 2, v3);
      transportAt(x + DT * v3.vx, y + DT * v3.vy, s + DT, v4);
      x += (DT * (v1.vx + 2 * v2.vx + 2 * v3.vx + v4.vx)) / 6;
      y += (DT * (v1.vy + 2 * v2.vy + 2 * v3.vy + v4.vy)) / 6;
    }
  }
  return tracks;
}

export function flowReferenceAt(k: number, s: number, out: [number, number] = [0, 0]) {
  const table = trajectories();
  const u = clamp01((s - X_POINT_S) / (1 - X_POINT_S)) * STEPS;
  const i = Math.min(STEPS - 1, Math.floor(u));
  const a = 2 * (i * FLOW_PARTICLES + k),
    b = a + 2 * FLOW_PARTICLES;
  out[0] = table[a]! + (table[b]! - table[a]!) * (u - i);
  out[1] = table[a + 1]! + (table[b + 1]! - table[a + 1]!) * (u - i);
  return out;
}

const ref: [number, number] = [0, 0];
export function eruptionFlow(region: Region, g: Geometry, out: Float32Array) {
  eruptionBasis(region);
  for (let k = 0; k < FLOW_PARTICLES; k++) {
    flowReferenceAt(k, g.s, ref);
    eruptionPoint(
      out,
      3 * k,
      ref[0] * g.lambda * displayWidth(ref[1], g),
      displayHeight(ref[1], g),
      0,
    );
  }
}

import { CME_THICKNESS } from "../parameters";
import { directionOf, type SunFrame } from "./frame";

export type SunViewport = { width: number; height: number; fov: number; bottomInset?: number };
export type EruptionEnvelope = { centre: number; radius: number };

const envelopes = new WeakMap<SunFrame, { revision: number; envelope: EruptionEnvelope }>();

/** The erupting rope, flare loops and ejection, including shell thickness.
 * The extended overlying field is context; fitting its distant traces would
 * shrink the event to a speck as the field opens. */
export function eruptionEnvelope(frame: SunFrame): EruptionEnvelope {
  const cached = envelopes.get(frame);
  if (cached?.revision === frame.eruptionRevision) return cached.envelope;
  const eruption = frame.eruption;
  const region = eruption && frame.regions.find((r) => r.id === eruption.regionId);
  let low = 1;
  let high = 1.24;
  let width = 0.12;
  if (eruption && region) {
    const axis = directionOf(region.lat, region.lon);
    for (const line of eruption.lines) {
      if (line.kind !== "rope" && line.kind !== "postflare") continue;
      for (let i = 0; i < line.count; i++) {
        const x = line.points[3 * i]!;
        const y = line.points[3 * i + 1]!;
        const z = line.points[3 * i + 2]!;
        const along = x * axis[0] + y * axis[1] + z * axis[2];
        low = Math.min(low, along);
        high = Math.max(high, along);
        width = Math.max(width, Math.sqrt(Math.max(0, x * x + y * y + z * z - along * along)));
      }
    }
    if (eruption.cmePresence > 0) {
      const front = eruption.cmeFront * (1 + CME_THICKNESS);
      high = Math.max(high, front);
      width = Math.max(width, front * Math.sin(eruption.cmeSpread));
    }
  }
  const envelope = { centre: (low + high) / 2, radius: Math.hypot((high - low) / 2, width) };
  envelopes.set(frame, { revision: frame.eruptionRevision, envelope });
  return envelope;
}

/** The scene's usable rectangle. Its centre rises above a tall mobile dock. */
export function frameInsets(viewport: SunViewport) {
  const h = Math.max(1, viewport.height);
  const short = h < 480;
  const top = Math.min(h * 0.2, short ? 72 : 112);
  const bottom = Math.min(h * 0.4, viewport.bottomInset || (short ? 100 : 190));
  return { top, bottom, offsetY: (bottom - top) / 2 };
}

/** Fit a sphere inside both frustum axes, leaving room for the shared chrome and dock. */
export function framedDistance(radius: number, viewport: SunViewport): number {
  const { width, height, fov } = viewport;
  const w = Math.max(1, width);
  const h = Math.max(1, height);
  const { top, bottom } = frameInsets(viewport);
  const vertical = Math.max(0.2, 1 - (top + bottom) / h);
  const horizontal = Math.max(0.2, (w - Math.min(64, w * 0.12)) / h);
  const halfAngle = Math.atan(Math.tan((fov * Math.PI) / 360) * Math.min(vertical, horizontal));
  return radius / Math.sin(halfAngle);
}

/** Canvas drawing for the lit pin: its ring and the leader’s target on it. */

import { projectWorld, type CameraSnapshot } from "@horizon/toolkit/camera";

import { ringPoints, type PinId } from "../lib/pins";

/** Dashed equatorial ring of radius `radius` (units of M), projected through the camera. */
export function drawRing(
  cam: CameraSnapshot,
  ctx: CanvasRenderingContext2D,
  radius: number,
  color: string,
  width: number,
  height: number,
  alpha: number,
) {
  const pts = ringPoints(radius, 128);
  ctx.beginPath();
  let started = false;
  for (const p of pts) {
    const s = projectWorld(cam, p.x, p.y, p.z, width, height);
    if (!s.visible) {
      started = false;
      continue;
    }
    if (!started) {
      ctx.moveTo(s.x, s.y);
      started = true;
    } else ctx.lineTo(s.x, s.y);
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.1;
  ctx.setLineDash([5, 7]);
  ctx.globalAlpha = 0.78 * alpha;
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.setLineDash([]);
}

/**
 * Where the leader from the gauge meets the ring. Doppler points at the
 * approaching (brighter) side of the disk; the radii point at the nearest
 * visible part of their ring that lies past the anchor.
 */
export function ringTarget(
  cam: CameraSnapshot,
  id: PinId,
  radius: number,
  ax: number,
  ay: number,
  width: number,
  height: number,
) {
  if (id === "doppler") {
    const theta = Math.atan2(cam.posX, cam.posZ) + Math.PI * 0.5;
    const s = projectWorld(
      cam,
      radius * Math.sin(theta),
      0,
      radius * Math.cos(theta),
      width,
      height,
    );
    if (s.visible) return s;
  }
  let best: { x: number; y: number } | null = null;
  let bestD = Infinity;
  let ahead: { x: number; y: number } | null = null;
  let aheadD = Infinity;
  for (const p of ringPoints(radius, 96)) {
    const s = projectWorld(cam, p.x, p.y, p.z, width, height, { padding: 0 });
    if (!s.visible) continue;
    const d = Math.hypot(s.x - ax, s.y - ay);
    if (d < bestD) {
      bestD = d;
      best = s;
    }
    if (s.x > ax + 24 && d < aheadD) {
      aheadD = d;
      ahead = s;
    }
  }
  return ahead ?? best;
}

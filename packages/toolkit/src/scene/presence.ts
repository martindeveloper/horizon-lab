/**
 * How present something is, 0..1, so nothing pops while a log-scale zoom glides:
 *
 * - size: how many CSS pixels a world length covers at a distance (`createScreenScale`);
 * - bands: soft log-distance bands (`rising`, `fade`) and one framing rule (`framed`);
 * - switches: faders that ease in and out over time when a toggle flips (`createFaders`);
 * - levels: discrete choices with hysteresis (`pickLevel`);
 * - draws: a material faded past what a display shows draws nothing (`fadeMaterial`).
 */
import type { Material, PerspectiveCamera, Vector3 } from "three";

import { logFraction, smoothstep } from "../math";
import { worldPerPixel, type Viewport } from "./kit";

/** 0 below `from`, 1 above `to`, eased in log space. */
export const rising = (x: number, from: number, to: number) =>
  x <= from ? 0 : x >= to ? 1 : smoothstep(0, 1, logFraction(x, from, to));

/**
 * A presence band over distance: eases in from `inFrom` to `inTo`, out from `outFrom` to
 * `outTo`, in log space. Omit a side (0 / Infinity) to leave it open.
 */
export function fade(inFrom: number, inTo: number, outFrom = Infinity, outTo = Infinity) {
  return (d: number) =>
    (inTo > 0 ? rising(d, inFrom, inTo) : 1) *
    (Number.isFinite(outFrom) ? 1 - rising(d, outFrom, outTo) : 1);
}

/**
 * The framing rule markers, labels and orbits share, as fractions of the camera distance
 * `d`: something reaching `far` from the aim reads once it spans a few per cent of the view,
 * and gives way as its near side `near` leaves the frame or as it wraps the camera.
 */
export function framed(near: number, far: number, d: number) {
  return (
    rising(far / d, 0.025, 0.045) * (1 - rising(near / d, 0.8, 1.1)) * (1 - rising(far / d, 2.2, 3))
  );
}

/** The faintest opacity that shows: below half of one 8-bit step, a blended colour rounds away. */
export const FAINTEST_OPACITY = 0.5 / 255;

/**
 * Fades `material` to `opacity` and skips its draws while that is too faint to show, on every
 * object it is on; each object keeps its own `visible`. Returns whether it draws.
 */
export function fadeMaterial(material: Material, opacity: number) {
  material.opacity = opacity;
  material.visible = opacity > FAINTEST_OPACITY;
  return material.visible;
}

/** Steps a level up past each threshold and back down only below `1 − gap` of it. */
export function pickLevel(current: number, value: number, up: readonly number[], gap = 0.18) {
  let level = current;
  while (level < up.length && value > up[level]!) level += 1;
  while (level > 0 && value < up[level - 1]! * (1 - gap)) level -= 1;
  return level;
}

/** A switch that eases between off (0) and on (1) over `seconds`, smooth at both ends. */
export type Fader = { readonly value: number; to: (on: boolean) => number };

/** One per engine: `begin` each frame with its time step; `busy` while a fader still moves. */
export function createFaders() {
  let unsettled = 0;
  let dt = 0;
  return {
    begin(frameDt: number) {
      dt = frameDt;
      unsettled = 0;
    },
    /** A fader moved this frame and has further to go: keep frames coming. */
    get busy() {
      return unsettled > 0;
    },
    /** A fader's first call shows the switch as it is; only later changes ease. */
    fader: (seconds = 0.45): Fader => {
      let t = 0;
      let value = 0;
      let fresh = true;
      return {
        get value() {
          return value;
        },
        to(next: boolean) {
          const goal = next ? 1 : 0;
          if (fresh) {
            fresh = false;
            t = value = goal;
          }
          if (t !== goal) {
            t = goal > t ? Math.min(1, t + dt / seconds) : Math.max(0, t - dt / seconds);
            value = smoothstep(0, 1, t);
            if (t !== goal) unsettled += 1;
          }
          return value;
        },
      };
    },
  };
}

/**
 * Screen size of world lengths for a perspective camera, for detail and marker sizes. A stage
 * under 480 px tall counts as 480, so a small stage keeps the detail of a phone's; the scale
 * bar (`scaleBar`) measures the true stage.
 */
export function createScreenScale(camera: PerspectiveCamera, viewport: Pick<Viewport, "height">) {
  const { fov } = camera;
  const pxWorld = (distance: number, px: number) =>
    worldPerPixel(fov, distance, Math.max(480, viewport.height)) * px;
  return {
    /** World size of `px` CSS pixels at `distance` from the camera. */
    pxWorld,
    /** On-screen radius in CSS pixels of a sphere of world radius `r` centred at `at`. */
    px: (r: number, at: Vector3) => r / pxWorld(Math.max(1e-12, camera.position.distanceTo(at)), 1),
  };
}

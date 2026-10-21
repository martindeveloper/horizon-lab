/**
 * The ship's feel, the View panel's "Ship feel" (off by default; off, nothing here runs):
 *
 * - a crash holds the scene a moment, then jolts the camera by the speed it struck at;
 * - the drive spools up as the autopilot finishes aligning, rather than snapping on;
 * - the view widens a little while the drive burns or the boost is held.
 *
 * The arrival's settle into orbit is the ship camera's (`ship-camera.ts`), the gauge's easing
 * the cockpit's. Reduced motion keeps none of the motion; the crash still holds.
 */
import { Euler, Quaternion, type PerspectiveCamera } from "three";

import { clamp, smootherstep } from "@horizon/toolkit/math";

import { ALIGN_S, driveLit, type FlightPhase } from "../model/autopilot";

/** Real seconds the scene holds after an impact before the crash is told and the jolt starts. */
const HOLD_S = 0.12;
/** The jolt: its largest angle, radians (0.6°), at an impact this fast, km/s, and its decay, s. */
const JOLT_RAD = (0.6 * Math.PI) / 180;
const JOLT_FULL_KM_S = 2;
const JOLT_TAU_S = 0.11;
const JOLT_S = 0.5;
/** The drive spools up over the align's last this many seconds. */
const SPOOL_S = 0.6;
/** How far the view widens at full drive, degrees, and how fast it eases there and back, s. */
const WIDEN_DEG = 3;
const WIDEN_TAU_S = 0.08;

export type ShipFeel = ReturnType<typeof createShipFeel>;

export function createShipFeel(camera: PerspectiveCamera) {
  const baseFov = camera.fov;
  let widen = 0;
  /** Seconds since the impact, while it plays; its strength 0…1; what to do once held. */
  let since = -1;
  let strength = 0;
  let told: (() => void) | null = null;
  const jolt = new Euler();
  const turn = new Quaternion();

  return {
    /** An impact plays, or the view is still easing back. */
    get busy() {
      return since >= 0 || widen > 1e-3;
    },
    /** The ship struck at `speed` km/s: the scene holds, `then` tells the crash, the jolt follows. */
    impact(speed: number, then: () => void) {
      since = 0;
      strength = clamp(speed / JOLT_FULL_KM_S, 0.3, 1);
      told = then;
    },
    /** The real seconds the ship may step this frame: none while an impact holds. */
    step(dt: number) {
      if (since < 0) return dt;
      since += dt;
      if (since < HOLD_S) return 0;
      told?.();
      told = null;
      if (since > HOLD_S + JOLT_S) since = -1;
      return dt;
    },
    /**
     * How far the autopilot's drive has spooled up, 0…1, `t` real seconds into a flight: rising
     * through the align, full while it burns or brakes, off through the flip and on a coast.
     */
    spool(phase: FlightPhase | null, t: number) {
      if (phase !== "align") return driveLit(phase) ? 1 : 0;
      return smootherstep(clamp((t - (ALIGN_S - SPOOL_S)) / SPOOL_S, 0, 1));
    },
    /**
     * After the ship has placed the camera: the jolt onto its attitude, and the view widened by
     * `drive` (0…1, the autopilot's burn or the boost). `still` (reduced motion) skips both.
     */
    apply(dt: number, drive: number, still: boolean) {
      const jolting = since >= HOLD_S && !still;
      if (jolting) {
        const t = since - HOLD_S;
        /* Three axes out of step, scaled so the turn never passes the jolt's angle. */
        const a = (JOLT_RAD * strength * Math.exp(-t / JOLT_TAU_S)) / Math.sqrt(2.36);
        jolt.set(
          a * Math.sin(t * 71),
          a * Math.sin(t * 53 + 1.3),
          0.6 * a * Math.sin(t * 37 + 2.1),
        );
        camera.quaternion.multiply(turn.setFromEuler(jolt));
      }
      const target = still ? 0 : WIDEN_DEG * clamp(drive, 0, 1);
      const next = widen + (target - widen) * (1 - Math.exp(-dt / WIDEN_TAU_S));
      const settled = Math.abs(next - target) < 1e-3 ? target : next;
      if (settled !== widen) {
        widen = settled;
        camera.fov = baseFov + widen;
        camera.updateProjectionMatrix();
      }
      if (jolting) camera.updateMatrixWorld();
    },
    /** The switch went off: the view back at once, no impact left playing. */
    reset() {
      told?.();
      told = null;
      since = -1;
      if (widen === 0) return;
      widen = 0;
      camera.fov = baseFov;
      camera.updateProjectionMatrix();
    },
  };
}

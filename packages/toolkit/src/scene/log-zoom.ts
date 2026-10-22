/**
 * One zoom across many scales. Distance moves in log space: a critically damped spring
 * follows wheel and pinch, and flights run a quintic path that leaves at the zoom's current
 * speed and lands at rest. Someone else may write the distance between steps (a guided tour,
 * a close-up); the zoom then carries that speed on, unless the change was a cut.
 */
import { clamp, smootherstep } from "../math";

/** Zoom bounds, world units. */
export type ZoomLimits = { min: number; max: number };

type Flight = {
  from: number;
  to: number;
  /** Leaving speed, in log distance per unit of flight progress. */
  lead: number;
  t: number;
  seconds: number;
};

/** A flight's length grows with the scales it crosses. */
const flightSeconds = (efolds: number) => clamp(0.9 + 0.2 * Math.abs(efolds), 0.9, 6);

export function createLogZoom(
  distance: number,
  options: {
    limits: () => ZoomLimits;
    /** Spring rates (1/s): wheel steps glide into each other, pinches track the fingers. */
    wheelRate?: number;
    pinchRate?: number;
    /** Speed (e-folds/s) taken over from another owner of the distance; a larger jump is a cut. */
    maxCarry?: number;
  },
) {
  const { limits, wheelRate = 11, pinchRate = 30, maxCarry = 40 } = options;
  /** Destination (log), speed (e-folds/s), spring rate, and the distance last written. */
  let target = Math.log(distance);
  let speed = 0;
  let rate = wheelRate;
  let written = distance;
  let flight: Flight | null = null;

  const zoom = {
    /** Where the zoom is heading, world units. */
    get target() {
      return Math.exp(target);
    },
    get flying() {
      return flight !== null;
    },
    /** A flight, or the spring still gliding or yet to leave for a new target. */
    get moving() {
      return flight !== null || speed !== 0 || Math.abs(Math.log(written) - target) >= 1e-4;
    },
    /** Input asks for a distance; `direct` (a pinch) follows closely. Returns it clamped. */
    zoomTo(next: number, direct: boolean) {
      const bounds = limits();
      const clamped = clamp(next, bounds.min, bounds.max);
      flight = null;
      target = Math.log(clamped);
      rate = direct ? pinchRate : wheelRate;
      return clamped;
    },
    /** The distance was set outright (a snap, a landing): nothing left to glide. */
    settle(at: number) {
      flight = null;
      target = Math.log(at);
      speed = 0;
      written = at;
    },
    /** Ends a flight; the zoom glides to rest from its current speed, without turning back. */
    cancel(at: number) {
      if (!flight) return;
      flight = null;
      const bounds = limits();
      target = clamp(Math.log(at) + speed / rate, Math.log(bounds.min), Math.log(bounds.max));
    },
    /** Flies from `from` to `to`, carrying the zoom's current speed out. */
    fly(from: number, to: number) {
      const a = Math.log(from);
      const b = Math.log(to);
      const seconds = flightSeconds(b - a);
      flight = { from: a, to: b, lead: speed * seconds, t: 0, seconds };
    },
    /**
     * Advances the flight or the spring from `at`, the distance now. With `held`, another owner
     * moves the distance: only follow it. `clampToLimits` glides back inside limits that moved.
     * Returns the new distance and, during a flight, its progress 0..1.
     */
    step(dt: number, at: number, held = false, clampToLimits = true) {
      if (at !== written) {
        const jump = Math.log(at / written);
        speed = dt > 0 && Math.abs(jump) < 0.5 ? clamp(jump / dt, -maxCarry, maxCarry) : 0;
        target = Math.log(at);
        flight = null;
      }
      if (held) {
        written = at;
        return { distance: at, progress: null };
      }
      let x = Math.log(at);
      let progress: number | null = null;
      if (flight) {
        flight.t = Math.min(1, flight.t + dt / flight.seconds);
        const s = flight.t;
        progress = s;
        /* Quintic Hermite: leaves at the zoom's speed, lands at rest, no jerk at either end. */
        const s2 = s * s;
        const land = smootherstep(s);
        const carry = s - 6 * s2 * s + 8 * s2 * s2 - 3 * s2 * s2 * s;
        const landRate = 30 * s2 * (1 - s) * (1 - s);
        const carryRate = 1 - 18 * s2 + 32 * s2 * s - 15 * s2 * s2;
        const gap = flight.to - flight.from;
        x = flight.from + gap * land + flight.lead * carry;
        speed = (gap * landRate + flight.lead * carryRate) / flight.seconds;
        target = x;
        if (s >= 1) {
          x = flight.to;
          target = x;
          speed = 0;
          flight = null;
        }
      } else if (clampToLimits) {
        const bounds = limits();
        target = clamp(target, Math.log(bounds.min), Math.log(bounds.max));
      }
      if (!flight && (speed !== 0 || x !== target)) {
        /* Critically damped spring toward the target, solved exactly for this step. */
        const w = rate;
        const gap = x - target;
        const decay = Math.exp(-w * dt);
        const push = (speed + w * gap) * dt;
        x = target + (gap + push) * decay;
        speed = (speed - w * push) * decay;
        if (Math.abs(x - target) < 1e-4 && Math.abs(speed) < 1e-3) {
          x = target;
          speed = 0;
        }
      }
      written = Math.exp(x);
      return { distance: written, progress };
    },
  };
  return zoom;
}

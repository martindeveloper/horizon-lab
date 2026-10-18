import {
  SUN_ACTIVITY_CYCLE_SECONDS,
  SUN_ACTIVITY_LEAN_LIMIT,
  SUN_ACTIVITY_MAX_STRETCH,
  SUN_ACTIVITY_REGION_COUNT,
  SUN_ACTIVITY_TWIST_LIMIT,
  PROMINENCE_REGIONS,
} from "./solar-activity";

const STEP = 1 / 120;
const CYCLE_TICKS = SUN_ACTIVITY_CYCLE_SECONDS * 120;
const TAU = Math.PI * 2;

function ramp(start: number, end: number, phase: number) {
  const t = Math.max(0, Math.min(1, (phase - start) / (end - start)));
  return t * t * (3 - 2 * t);
}

function pulse(start: number, peak: number, end: number, phase: number) {
  return ramp(start, peak, phase) * (1 - ramp(peak, end, phase));
}

/**
 * Four damped modes per prominence: height, two bends, and twist. An authored
 * stress/release cycle drives their inertia and recoil; this is NOT an MHD solver.
 * The shader deforms the density continuously, with zero displacement at the roots.
 * Fixed steps make 24/30/60 Hz playback agree. Only 24 floats reach the GPU per frame.
 */
export function createSolarActivityDynamics() {
  const position = new Float64Array(SUN_ACTIVITY_REGION_COUNT * 4);
  const velocity = new Float64Array(position.length);
  const values = new Float32Array(position.length);
  let tick = 0;
  let pending = 0;

  function integrate() {
    const phase = tick / CYCLE_TICKS;
    for (let region = 0; region < SUN_ACTIVITY_REGION_COUNT; region++) {
      const p = (phase + PROMINENCE_REGIONS[region]![5]) % 1;
      const rise = ramp(0.06, 0.43, p) * (1 - ramp(0.54, 0.79, p));
      const launch = pulse(0.39, 0.48, 0.6, p);
      const recoil = pulse(0.52, 0.59, 0.68, p);
      const sign = region % 2 === 0 ? 1 : -1;
      for (let axis = 0; axis < 4; axis++) {
        const i = region * 4 + axis;
        let target: number, frequency: number, damping: number, force: number, limit: number;
        if (axis === 0) {
          target = 0.38 + 0.84 * rise + 0.65 * launch;
          frequency = 2.8;
          damping = 0.58;
          force = 0;
          limit = SUN_ACTIVITY_MAX_STRETCH;
        } else {
          frequency = axis === 3 ? 2.5 : 2.1;
          damping = axis === 3 ? 0.42 : 0.34;
          target =
            sign *
            (0.08 * Math.sin(TAU * p + axis) +
              (axis === 1 ? 0.27 : axis === 2 ? -0.18 : 0.24) * rise);
          force = sign * (axis === 2 ? -1 : 1) * (1.35 * launch - 2.5 * recoil);
          limit = axis === 3 ? SUN_ACTIVITY_TWIST_LIMIT : SUN_ACTIVITY_LEAN_LIMIT;
        }
        const acceleration =
          frequency * frequency * (target - position[i]!) -
          2 * damping * frequency * velocity[i]! +
          force;
        velocity[i] = velocity[i]! + acceleration * STEP;
        const next = position[i]! + velocity[i] * STEP;
        const bounded = Math.max(axis === 0 ? 0.25 : -limit, Math.min(limit, next));
        position[i] = bounded;
        if (bounded !== next) velocity[i] = 0;
      }
    }
    tick = (tick + 1) % CYCLE_TICKS;
  }

  function reset() {
    position.fill(0);
    velocity.fill(0);
    tick = 0;
    pending = 0;
    // Settle the staggered regions before the first image, including reduced-motion views.
    for (let i = 0; i < CYCLE_TICKS * 2; i++) integrate();
    values.set(position);
  }
  reset();

  return {
    values,
    get time() {
      return tick * STEP;
    },
    reset,
    advance(dt: number, animate: boolean) {
      if (!animate || !Number.isFinite(dt) || dt <= 0) return;
      // A hidden tab resumes from its held pose, without a burst of catch-up work.
      pending += Math.min(dt, 0.1);
      while (pending + 1e-10 >= STEP) {
        integrate();
        pending = Math.max(0, pending - STEP);
      }
      values.set(position);
    },
  };
}

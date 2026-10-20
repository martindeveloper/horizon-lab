import {
  PROMINENCE_REGIONS,
  SUN_ACTIVITY_CYCLE_SECONDS,
  SUN_ACTIVITY_DRAIN_SPEED,
  SUN_ACTIVITY_ERUPTION_DRAIN,
  SUN_ACTIVITY_FAST_RISE_END,
  SUN_ACTIVITY_FAST_RISE_START,
  SUN_ACTIVITY_MAX_LIFT,
  SUN_ACTIVITY_REGION_COUNT,
  SUN_ACTIVITY_SLOW_RISE_LIFT,
  SUN_ACTIVITY_SLOW_RISE_START,
  SUN_ACTIVITY_SWAY_DAMPING,
  SUN_ACTIVITY_SWAY_KICK,
  SUN_ACTIVITY_SWAY_LIMIT,
  SUN_ACTIVITY_SWAY_PERIOD_MIN,
  SUN_ACTIVITY_TIME_SCALE,
} from "./solar-activity";

const STEP = 1 / 120;
const CYCLE_TICKS = SUN_ACTIVITY_CYCLE_SECONDS * 120;
const SWAY_OMEGA = (Math.PI * 2) / ((SUN_ACTIVITY_SWAY_PERIOD_MIN * 60) / SUN_ACTIVITY_TIME_SCALE);
/** The drained length wraps far beyond a thread's streak period, keeping the uniform precise. */
const FLOW_WRAP = 256;

const smooth = (t: number) => {
  const s = Math.max(0, Math.min(1, t));
  return s * s * (3 - 2 * s);
};

/** Each region's eruption rocks the others, less the farther apart they are on the sphere. */
const KICKS = PROMINENCE_REGIONS.map(([lat, lon]) =>
  PROMINENCE_REGIONS.map(([lat2, lon2]) => {
    const cosine =
      Math.sin(lat) * Math.sin(lat2) + Math.cos(lat) * Math.cos(lat2) * Math.cos(lon - lon2);
    return SUN_ACTIVITY_SWAY_KICK * Math.exp(-Math.acos(Math.max(-1, Math.min(1, cosine))));
  }),
);

/**
 * A region's course through its cycle, from its phase alone: how far the body has risen
 * (the slow rise of hours, then the fast rise of an eruption), how much of it is still
 * condensed (it thins away as it erupts and re-forms over hours), and how fast its threads
 * drain. The schedule is authored (Sterling & Moore 2005, ApJ 630, 1148; Chen 2011, LRSP 8, 1).
 */
export function regionCourse(phase: number) {
  if (phase < SUN_ACTIVITY_SLOW_RISE_START) return { lift: 1, fade: 1, drain: 1 };
  if (phase < SUN_ACTIVITY_FAST_RISE_START) {
    const t =
      (phase - SUN_ACTIVITY_SLOW_RISE_START) /
      (SUN_ACTIVITY_FAST_RISE_START - SUN_ACTIVITY_SLOW_RISE_START);
    return { lift: 1 + (SUN_ACTIVITY_SLOW_RISE_LIFT - 1) * t * t, fade: 1, drain: 1 + 0.5 * t };
  }
  if (phase < SUN_ACTIVITY_FAST_RISE_END) {
    const t =
      (phase - SUN_ACTIVITY_FAST_RISE_START) /
      (SUN_ACTIVITY_FAST_RISE_END - SUN_ACTIVITY_FAST_RISE_START);
    return {
      lift:
        SUN_ACTIVITY_SLOW_RISE_LIFT * (SUN_ACTIVITY_MAX_LIFT / SUN_ACTIVITY_SLOW_RISE_LIFT) ** t,
      // The rising body stays condensed until late in its climb, then thins away quickly.
      fade: 1 - smooth(t * t * t),
      drain: SUN_ACTIVITY_ERUPTION_DRAIN,
    };
  }
  const t = (phase - SUN_ACTIVITY_FAST_RISE_END) / (1 - SUN_ACTIVITY_FAST_RISE_END);
  return { lift: 1, fade: smooth(t), drain: 0.5 };
}

/**
 * Four values per prominence reach the GPU: lift, fade, sway and drained length. Lift, fade
 * and the drain rate follow the authored cycle; the sway is a damped kink oscillation, kicked
 * by the other regions' eruptions; the drained length integrates the drain rate so a change
 * of speed never jumps the threads. Fixed steps make 24/30/60 Hz playback agree. This is
 * NOT an MHD solver.
 */
export function createSolarActivityDynamics() {
  const values = new Float32Array(SUN_ACTIVITY_REGION_COUNT * 4);
  const sway = new Float64Array(SUN_ACTIVITY_REGION_COUNT);
  const swayRate = new Float64Array(SUN_ACTIVITY_REGION_COUNT);
  const flow = new Float64Array(SUN_ACTIVITY_REGION_COUNT);
  let tick = 0;
  let pending = 0;

  const phaseOf = (region: number, at: number) =>
    (at / CYCLE_TICKS + PROMINENCE_REGIONS[region]![5]) % 1;

  function integrate() {
    for (let region = 0; region < SUN_ACTIVITY_REGION_COUNT; region++) {
      const before = phaseOf(region, tick);
      const after = phaseOf(region, tick + 1);
      if (before < SUN_ACTIVITY_FAST_RISE_START && after >= SUN_ACTIVITY_FAST_RISE_START) {
        for (let other = 0; other < SUN_ACTIVITY_REGION_COUNT; other++)
          if (other !== region)
            swayRate[other] = swayRate[other]! + KICKS[region]![other]! * SWAY_OMEGA;
      }
    }
    tick = (tick + 1) % CYCLE_TICKS;
    for (let region = 0; region < SUN_ACTIVITY_REGION_COUNT; region++) {
      const { lift, fade, drain } = regionCourse(phaseOf(region, tick));
      const acceleration =
        -SWAY_OMEGA * SWAY_OMEGA * sway[region]! -
        2 * SUN_ACTIVITY_SWAY_DAMPING * SWAY_OMEGA * swayRate[region]!;
      swayRate[region] = swayRate[region]! + acceleration * STEP;
      const next = sway[region]! + swayRate[region]! * STEP;
      sway[region] = Math.max(-SUN_ACTIVITY_SWAY_LIMIT, Math.min(SUN_ACTIVITY_SWAY_LIMIT, next));
      if (sway[region] !== next) swayRate[region] = 0;
      flow[region] = (flow[region]! + SUN_ACTIVITY_DRAIN_SPEED * drain * STEP) % FLOW_WRAP;
      values[region * 4] = lift;
      values[region * 4 + 1] = fade;
      values[region * 4 + 2] = sway[region]!;
      values[region * 4 + 3] = flow[region]!;
    }
  }

  function reset() {
    tick = 0;
    pending = 0;
    sway.fill(0);
    swayRate.fill(0);
    flow.fill(0);
    for (let region = 0; region < SUN_ACTIVITY_REGION_COUNT; region++) {
      const { lift, fade } = regionCourse(phaseOf(region, 0));
      values.set([lift, fade, 0, 0], region * 4);
    }
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
    },
  };
}

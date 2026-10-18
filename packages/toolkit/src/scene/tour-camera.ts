/**
 * A guided tour's camera on an orbit rig: one flight to each shot, shaped and timed by the shot,
 * then a slow drift round while the shot is read, until the viewer takes the camera.
 */
import { sampleOrbitFlight, type OrbitFlight, type OrbitPose } from "../camera";
import { wrapSigned } from "../math";
import type { OrbitRig } from "./orbit-rig";

/** Where a tour step puts the camera, and how it gets there. */
export type TourShot = OrbitPose & {
  /** Flight shaping (see `sampleOrbitFlight`) and its length in seconds. */
  flight?: Pick<OrbitFlight, "lift" | "swing" | "lead"> & { duration?: number };
  /** Slow orbit while the shot is held, rad/s; by default 0.01 the way the flight turned. */
  drift?: number;
};

/** Seconds a flight to this shot takes. */
export const tourFlightSeconds = (shot: TourShot) => shot.flight?.duration ?? 6;

/**
 * Camera pose `t` of the way from `from` to a shot: the shorter way round in azimuth and
 * log-linear in distance, so a jump across scales reads as one steady move instead of a lurch
 * at the end. The shot may arc, swing and lead the turn on the way.
 */
export function sampleTourFlight(t: number, from: OrbitPose, to: TourShot | OrbitPose) {
  return sampleOrbitFlight(t, from, {
    yaw: wrapSigned(to.azimuth - from.azimuth, Math.PI * 2),
    inclination: to.inclination,
    distance: to.distance,
    ...("flight" in to ? to.flight : undefined),
  });
}

export type TourCamera = ReturnType<typeof createTourCamera>;

export function createTourCamera(
  rig: Pick<OrbitRig, "pose" | "cancel" | "settle">,
  options: {
    /** While it matches, shots land at once and nothing drifts. */
    reduceMotion: { matches: boolean };
    /** Something else holds the camera still for now (a close-up). */
    holdBlocked?: () => boolean;
  },
) {
  const { pose } = rig;
  /* The shot flown to (by its key), the pose the flight left from and its progress 0..1. */
  let key: number | null = null;
  let shot: TourShot | null = null;
  let from: OrbitPose = { ...pose };
  let t = 1;
  /* Hold: a slow orbit while a landed shot is read, until the viewer takes the camera. */
  let holdT = 0;
  let holdDir = 1;
  let holdOff = false;

  const holding = () =>
    shot !== null &&
    t >= 1 &&
    !holdOff &&
    !options.reduceMotion.matches &&
    !(options.holdBlocked?.() ?? false);

  return {
    /** The current shot has landed (or there is none). */
    get landed() {
      return t >= 1;
    },
    /** Frames are needed while a shot is flown or held. */
    get busy() {
      return t < 1 || holding();
    },
    /** Ends any flight; the camera belongs to someone else now. */
    cancel: () => {
      t = 1;
    },
    /** The viewer moved the camera: no flight, no hold, until the next shot. */
    takeOver: () => {
      t = 1;
      holdOff = true;
    },
    /**
     * Flies to `next` when its key changes (null: no tour), or holds over a landed shot. Call
     * before the rig steps.
     */
    step(nextKey: number | null, next: TourShot | null, dt: number) {
      if (nextKey !== key) {
        key = nextKey;
        shot = next;
        holdT = 0;
        holdOff = false;
        if (next) {
          from = { ...pose };
          t = 0;
          holdDir = Math.sign(wrapSigned(next.azimuth - pose.azimuth, Math.PI * 2)) || 1;
          rig.cancel();
        } else t = 1;
      }
      if (!shot) return;
      if (t < 1) {
        t = options.reduceMotion.matches ? 1 : Math.min(1, t + dt / tourFlightSeconds(shot));
        Object.assign(pose, sampleTourFlight(t, from, shot));
        if (t >= 1) rig.settle();
      } else if (holding()) {
        holdT += dt;
        pose.azimuth += (shot.drift ?? 0.01 * holdDir) * (1 - Math.exp(-holdT / 3)) * dt;
      }
    },
  };
}

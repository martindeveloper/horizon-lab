import { sampleOrbitFlight } from "@horizon/toolkit/camera";
import { clamp01, lerp, smootherstep } from "@horizon/toolkit/math";

import type { CameraPose } from "./frame";
import type { TourPose } from "./holes/types";

/**
 * The guide's camera, as pure functions of time: the engine steps them frame by
 * frame and the bench samples them at any elapsed time, so both fly the same path.
 */

/** The camera `t` (0–1) of the way from `from` into a beat: the orbit flight, roll eased alongside. */
export function tourPose(beat: TourPose, from: CameraPose, t: number): CameraPose {
  return {
    ...sampleOrbitFlight(t, from, beat),
    roll: lerp(from.roll, beat.roll ?? 0, smootherstep(t)),
  };
}

/** Where a beat lands, and so where the next one flies from. */
export const tourEnd = (beat: TourPose, from: CameraPose) => tourPose(beat, from, 1);

/** How long a hold's drift takes to reach its full rate, and its push to settle, in seconds. */
const DRIFT_RAMP = 3;
const CREEP_SETTLE = 18;

/** The camera `held` seconds after landing on a beat: a slow orbit that eases in, and a push that settles. */
export function holdPose(beat: TourPose, landed: CameraPose, held: number): CameraPose {
  const drift = beat.drift ?? 0.008 * Math.sign(beat.yaw);
  const settle = 1 - (1 + held / CREEP_SETTLE) * Math.exp(-held / CREEP_SETTLE);
  return {
    azimuth: landed.azimuth + drift * (held - DRIFT_RAMP * (1 - Math.exp(-held / DRIFT_RAMP))),
    inclination: landed.inclination,
    distance: landed.distance * (1 - (beat.creep ?? 0.05) * settle),
    roll: landed.roll,
  };
}

/** The camera `elapsed` seconds into a tour flown beat after beat from `home`, with no holds. */
export function tourAt(beats: readonly TourPose[], home: CameraPose, elapsed: number): CameraPose {
  let from = home;
  let start = 0;
  for (const beat of beats) {
    const end = start + beat.duration;
    if (elapsed <= end) return tourPose(beat, from, clamp01((elapsed - start) / beat.duration));
    from = tourEnd(beat, from);
    start = end;
  }
  return from;
}

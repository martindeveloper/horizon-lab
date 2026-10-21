/**
 * A trip's two clocks, by drive: how long it takes on Earth (coordinate time t) and on board
 * (proper time τ), on the toolkit's relativity (`coastTrip`, `torchTrip`: the torch ship
 * holds its proper acceleration and turns over halfway, so each half is hyperbolic motion),
 * and where a trip is partway through its own time. The toolkit takes accelerations in m/s²,
 * the drives hold them in km/s².
 */
import {
  coastTrip,
  gammaOf,
  properVelocity,
  torchOneWay,
  torchTrip,
} from "@horizon/toolkit/science";

import { C_KM_S, M_PER_KM, type Drive } from "./parameters";

export type TripTimes = {
  /** On Earth's clock, seconds. */
  t: number;
  /** On the ship's clock, seconds. */
  tau: number;
  /** The fastest the ship goes, km/s. */
  peak: number;
};

/** A speed, km/s, from a proper velocity u = γv: below c however large u grows. */
export const speedOfProper = (u: number) => u / gammaOf(u);

/** How long a trip of `km` takes on the two clocks, by drive. */
export function tripTimes(drive: Drive, km: number): TripTimes {
  if (km <= 0) return { t: 0, tau: 0, peak: 0 };
  if (drive.kind === "coast") return { ...coastTrip(km, drive.speed), peak: drive.speed };
  const accel = drive.accel * M_PER_KM;
  const { t, tau } = torchTrip(km, accel);
  return { t, tau, peak: speedOfProper(torchOneWay(tau / 2, accel).u) };
}

/**
 * Where a trip is `s` (0..1 of its proper time) of the way: distance covered as a fraction of
 * the whole, and the share of Earth's clock gone. A coast runs evenly; the torch ship covers
 * little at first and at the end, most in the middle. Deceleration mirrors the acceleration:
 * past halfway, what is left is the first leg run backwards.
 */
export function tripProgress(drive: Drive, km: number, s: number, trip = tripTimes(drive, km)) {
  if (drive.kind === "coast" || km <= 0) return { covered: s, elapsed: s };
  const a = drive.accel * M_PER_KM;
  const tauNow = s * trip.tau;
  if (tauNow <= trip.tau / 2) {
    const first = torchOneWay(tauNow, a);
    return { covered: first.distance / km, elapsed: first.t / trip.t };
  }
  const left = torchOneWay(trip.tau - tauNow, a);
  return { covered: 1 - left.distance / km, elapsed: 1 - left.t / trip.t };
}

/**
 * The ship's proper velocity `s` (0..1 of its proper time) into a trip, km/s: a coast's
 * throughout; the torch ship's c·sinh(aτ/c) on the leg it is on, τ from the nearer end. Kept
 * as proper velocity, never through β, which rounds to 1 long before a long burn ends.
 */
export function tripProperVelocity(drive: Drive, s: number, trip: TripTimes) {
  if (drive.kind === "coast") return properVelocity(drive.speed / C_KM_S);
  return torchOneWay(Math.min(s, 1 - s) * trip.tau, drive.accel * M_PER_KM).u;
}

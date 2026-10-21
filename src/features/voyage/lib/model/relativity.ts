/**
 * A trip's two clocks, by drive: how long it takes on Earth (coordinate time t) and on board
 * (proper time τ), on the toolkit's relativity (`coastTrip`, `torchTrip`: the torch ship
 * holds its proper acceleration and turns over halfway, so each half is hyperbolic motion),
 * and where a trip is partway through its own time.
 */
import { coastTrip, torchOneWay, torchTrip } from "@horizon/toolkit/science";

import { C_KM_S, type Drive } from "./parameters";

export type TripTimes = {
  /** On Earth's clock, seconds. */
  t: number;
  /** On the ship's clock, seconds. */
  tau: number;
  /** The fastest the ship goes, km/s. */
  peak: number;
};

/** How long a trip of `km` takes on the two clocks, by drive. */
export function tripTimes(drive: Drive, km: number): TripTimes {
  if (km <= 0) return { t: 0, tau: 0, peak: 0 };
  if (drive.kind === "coast") return { ...coastTrip(km, drive.speed), peak: drive.speed };
  const { t, tau, gammaMax } = torchTrip(km, drive.accel * 1000);
  return { t, tau, peak: C_KM_S * Math.sqrt(1 - 1 / (gammaMax * gammaMax)) };
}

/**
 * Where a trip is `s` (0..1 of its proper time) of the way: distance covered as a fraction of
 * the whole, and the share of Earth's clock gone. A coast runs evenly; the torch ship covers
 * little at first and at the end, most in the middle. Deceleration mirrors the acceleration:
 * past halfway, what is left is the first leg run backwards.
 */
export function tripProgress(drive: Drive, km: number, s: number, trip = tripTimes(drive, km)) {
  if (drive.kind === "coast" || km <= 0) return { covered: s, elapsed: s };
  const a = drive.accel * 1000;
  const tauNow = s * trip.tau;
  if (tauNow <= trip.tau / 2) {
    const first = torchOneWay(tauNow, a);
    return { covered: first.distance / km, elapsed: first.t / trip.t };
  }
  const left = torchOneWay(trip.tau - tauNow, a);
  return { covered: 1 - left.distance / km, elapsed: 1 - left.t / trip.t };
}

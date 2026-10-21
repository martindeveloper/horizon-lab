/**
 * A trip's two clocks, by drive: how long it takes on Earth (coordinate time t) and on board
 * (proper time τ), on the toolkit's relativity (`coastTrip`, `torchTrip`: the torch ship
 * holds its proper acceleration and turns over halfway, so each half is hyperbolic motion),
 * and where a trip is partway through its own time.
 */
import { coastTrip, torchTrip } from "@horizon/toolkit/science";

import { C_KM_S, type Drive } from "./parameters";

/** The Lorentz factor of a proper speed |u| (km/s). */
export const gammaOfProperSpeed = (u: number) => Math.sqrt(1 + (u * u) / (C_KM_S * C_KM_S));

/** The Lorentz factor of an ordinary speed v (km/s), v < c. */
export const gammaOfSpeed = (v: number) => 1 / Math.sqrt(1 - (v * v) / (C_KM_S * C_KM_S));

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
 * little at first and at the end, most in the middle.
 */
export function tripProgress(drive: Drive, km: number, s: number) {
  if (drive.kind === "coast" || km <= 0) return { covered: s, elapsed: s };
  const c = C_KM_S;
  const a = drive.accel;
  const { tau, t } = tripTimes(drive, km);
  const tauNow = s * tau;
  const half = tau / 2;
  const leg = (tauLeg: number) => ({
    x: ((c * c) / a) * (Math.cosh((a * tauLeg) / c) - 1),
    t: (c / a) * Math.sinh((a * tauLeg) / c),
  });
  const first = leg(Math.min(tauNow, half));
  if (tauNow <= half) return { covered: first.x / km, elapsed: first.t / t };
  /* Deceleration mirrors the acceleration: what is left is the first leg run backwards. */
  const left = leg(tau - tauNow);
  return { covered: 1 - left.x / km, elapsed: 1 - left.t / t };
}

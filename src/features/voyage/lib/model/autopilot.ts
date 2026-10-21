/**
 * The autopilot's flight, as a schedule: where along its route the ship is at each moment of
 * the few seconds the visitor watches, and so where it is on the drive's real trip. The ship
 * leaves its orbit slowly, home receding in even steps of scale; the long middle flashes by;
 * the destination grows in even steps until the ship settles at its arrival distance. Each
 * point on the way is the drive's real trajectory there (distance, speed and both clocks), so
 * only the playback rate, the auto time warp, is the visitor's.
 */
import { clamp, lerp } from "@horizon/toolkit/math";

import { C_KM_S, type Drive } from "./parameters";
import { tripTimes } from "./relativity";

/** What the autopilot is doing: turning onto the route, burning, flipping, braking, coasting. */
export type FlightPhase = "align" | "burn" | "flip" | "brake" | "cruise";

/** Real seconds the ship turns its nose onto the route before the drive lights. */
export const ALIGN_S = 2;
/** Real seconds the flip at the midpoint is announced for. */
const FLIP_S = 1.4;
/** Real seconds of a transit, at least and at most: it grows with the decades of scale crossed. */
const TRANSIT_S = [12, 32] as const;
const SECONDS_PER_DECADE = 1.6;

/** How long the visitor watches a transit of `km`, from an orbit `x0` km out to one `x1` km out. */
export function transitSeconds(km: number, x0: number, x1: number) {
  if (!(km > 0)) return TRANSIT_S[0];
  const decades = (Math.log10(km / Math.max(x0, 1e-9)) + Math.log10(km / Math.max(x1, 1e-9))) / 2;
  return clamp(TRANSIT_S[0] + SECONDS_PER_DECADE * Math.max(0, decades), ...TRANSIT_S);
}

/**
 * Distance covered, km, `w` (0..1) of the way through the transit's playback. The first half
 * grows the distance from the start in log space, from the departure orbit's scale `x0` to
 * half the route, easing in; the second half shrinks what is left to the arrival scale `x1`
 * and on to nothing, easing out. Monotonic, 0 at the start and `km` at the end.
 */
export function transit(w: number, km: number, x0: number, x1: number) {
  if (!(km > 0)) return 0;
  const t = clamp(w, 0, 1);
  const half = km / 2;
  const a = Math.max(x0, 1e-9);
  const b = Math.max(x1, 1e-9);
  if (t <= 0.5) {
    const e = (t / 0.5) ** 2;
    return Math.exp(lerp(Math.log(a), Math.log(half + a), e)) - a;
  }
  const e = 1 - (1 - (t - 0.5) / 0.5) ** 2;
  return km - (Math.exp(lerp(Math.log(half + b), Math.log(b), e)) - b);
}

/**
 * The share of the trip's proper time at which the drive has covered `covered` (0..1) of the
 * route: `tripProgress` turned round. A coast covers its route evenly; the torch ship's leg
 * of x km takes τ = (c/a) acosh(1 + y), y = a x / c² (as a log1p, exact for short legs),
 * mirrored past halfway.
 */
export function progressOf(drive: Drive, km: number, covered: number, trip = tripTimes(drive, km)) {
  const c = clamp(covered, 0, 1);
  if (drive.kind === "coast" || !(km > 0) || !(trip.tau > 0)) return c;
  const { accel } = drive;
  const legTau = (x: number) => {
    const y = (accel * x) / (C_KM_S * C_KM_S);
    return (C_KM_S / accel) * Math.log1p(y + Math.sqrt(y * (y + 2)));
  };
  return c <= 0.5 ? legTau(c * km) / trip.tau : 1 - legTau((1 - c) * km) / trip.tau;
}

/**
 * Whether the drive thrusts in a phase: out on the burn, in on the brake. It is off while the
 * ship turns end over end at the flip, and a coast never lights it; the align spools it up.
 */
export const driveLit = (phase: FlightPhase | null) => phase === "burn" || phase === "brake";

/**
 * The phase at `s` of the trip's proper time, `sinceFlip` real seconds after the midpoint
 * (negative before it): a coast cruises; the torch ship burns, flips at the midpoint, brakes.
 */
export function transitPhase(drive: Drive, s: number, sinceFlip: number): FlightPhase {
  if (drive.kind === "coast") return "cruise";
  if (s < 0.5) return "burn";
  return sinceFlip >= 0 && sinceFlip < FLIP_S ? "flip" : "brake";
}

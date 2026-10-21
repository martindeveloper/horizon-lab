import { distanceTo, isFlyable, type AnchorId } from "../lib/model/anchors";
import { dateAt } from "../lib/model/calendar";
import { scaleFactorAt } from "../lib/model/comoving";
import { DRIVES, type DriveId } from "../lib/model/parameters";
import { tripTimes, type TripTimes } from "../lib/model/relativity";
import type { Fix } from "../lib/store";

/** A moment the lists measure at: Earth's date, and the universe's scale then. */
export type Moment = { now: Date; a: number };

/** The moment of the ship's last fix, `epochMs` being the visit's epoch. */
export const momentOf = (epochMs: number, fix: Fix): Moment => ({
  now: dateAt(epochMs, fix.seconds),
  a: scaleFactorAt(fix.seconds),
});

/** A trip no drive completes, on either clock. */
const NEVER: TripTimes = { t: Infinity, tau: Infinity, peak: 0 };

/**
 * How long a drive takes from the ship to an anchor's place at a moment, on the two clocks;
 * forever to a place no drive reaches (`isFlyable`).
 */
export const tripTo = (
  drive: DriveId,
  id: AnchorId,
  ship: ArrayLike<number>,
  { now, a }: Moment,
) => (isFlyable(id) ? tripTimes(DRIVES[drive], distanceTo(id, now, a, ship)) : NEVER);

/** Earth's clock reads apart from the ship's once they differ by a hundredth. */
export const clocksPart = ({ t, tau }: { t: number; tau: number }) => t > tau * 1.01;

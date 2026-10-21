import { distanceTo, type AnchorId } from "../lib/model/anchors";
import { DRIVES, type DriveId } from "../lib/model/parameters";
import { tripTimes } from "../lib/model/relativity";

/** How long a drive takes from the ship to an anchor's place at `now`, on the two clocks. */
export const tripTo = (drive: DriveId, id: AnchorId, ship: ArrayLike<number>, now: Date) =>
  tripTimes(DRIVES[drive], distanceTo(id, now, ship));

/** Earth's clock reads apart from the ship's once they differ by a hundredth. */
export const clocksPart = ({ t, tau }: { t: number; tau: number }) => t > tau * 1.01;

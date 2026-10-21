import { holeById } from "./holes";
import type { TourPose } from "./holes/types";

/** A guide step: the shot and the card's words. */
export type TourStep = TourPose & {
  kicker: string;
  title: string;
  body: string;
};

/** The hole's guide: its shots in order. */
export function tourFor(presetId: string) {
  return holeById(presetId).tour;
}

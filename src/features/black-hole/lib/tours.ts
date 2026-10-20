import { holeById } from "./holes";
import type { TourPose } from "./holes/types";

export type TourBeat = TourPose & {
  kicker: string;
  title: string;
  body: string;
};

export function tourFor(presetId: string) {
  return holeById(presetId).tour;
}

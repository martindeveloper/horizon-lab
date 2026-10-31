import type { DriftProgramme } from "@/lib/drift";

import { type PaceId } from "./model/chapters";

/**
 * Afterglow's drift is the autoplay: the whole life from the faint young Sun, the vantage
 * moving outward as the Sun approaches, held on one track. "Low Drone Rises" (its arc: a
 * rise at 44 s, a breath near 200 s, its peak at 208–230 s) fits a life that swells to its
 * tip and fades; at half pace the life, its slowed stretches and flights included, runs about
 * one play of the track. The scene flies the drift's camera itself (`model/modes.ts`: a wide,
 * slow sway and slow flights between worlds), so the programme carries only its music and pace.
 */
export const DRIFT: DriftProgramme<never> = {
  music: { track: "Low Drone Rises", period: 225 },
  camera: {},
  shots: [],
};

/** The pace the autoplay runs at: one life in the track's play. */
export const DRIFT_PACE: PaceId = "half";

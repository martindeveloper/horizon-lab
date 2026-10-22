/**
 * What the dock says of a moment: the eruption's stage at its scrub, and the cycle's stage at
 * its phase. Both follow the model's own boundaries (`@/space/sun/model`), so the words change
 * where the physics does.
 */
import { activityAt } from "@/space/sun/model/cycle";
import {
  CYCLE_PERIOD_YR,
  CYCLE_RISE_YR,
  ERUPTION_STAGES,
  X_POINT_S,
} from "@/space/sun/model/parameters";

export const ERUPTION_STAGE_IDS = ["storing", "rising", "xpoint", "reconnecting", "loops"] as const;
export type EruptionStage = (typeof ERUPTION_STAGE_IDS)[number];

/**
 * The eruption's stage at `s`: the field stores energy as the sources converge, the rope rises
 * once it has lost equilibrium, the X-point forms and stretches into a sheet, reconnection
 * flares as the rope breaks loose, then post-flare loops fill in beneath the ejection.
 */
export function eruptionStageAt(s: number): EruptionStage {
  if (s < ERUPTION_STAGES.storage) return "storing";
  if (s < X_POINT_S) return "rising";
  if (s < ERUPTION_STAGES.rise) return "xpoint";
  if (s < ERUPTION_STAGES.breakaway) return "reconnecting";
  return "loops";
}

export const CYCLE_STAGE_IDS = ["minimum", "rising", "maximum", "declining"] as const;
export type CycleStage = (typeof CYCLE_STAGE_IDS)[number];

/** Activity below this share of the peak is a minimum; above the upper one, a maximum. */
const QUIET = 0.1;
const PEAK = 0.8;
/** The phase the cycle peaks at: its rise over its period. */
export const CYCLE_PEAK_PHASE = CYCLE_RISE_YR / CYCLE_PERIOD_YR;

/** The cycle's stage at a phase (0–1 from minimum to minimum), by the activity curve's height. */
export function cycleStageAt(phase: number): CycleStage {
  const activity = activityAt(phase);
  if (activity < QUIET) return "minimum";
  if (activity > PEAK) return "maximum";
  return phase < CYCLE_PEAK_PHASE ? "rising" : "declining";
}

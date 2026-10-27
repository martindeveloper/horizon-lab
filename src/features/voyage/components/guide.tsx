import { GuideCaption } from "@/components/simulations/guide-caption";
import { GuideEquation } from "@/components/simulations/guide-card";
import type { DockInTheWay } from "@/components/simulations/use-dock-clearance";

import { PROSE_FIGURES } from "../lib/model/catalogue";
import { VOYAGE_EQUATIONS } from "../lib/model/equations";
import { TOUR, TOUR_DWELL, type TourStep } from "../lib/model/tour";
import { useVoyage } from "../lib/store";

/** A caption beside the scene (a phone held sideways) leaves the names below it alone. */
const acrossTheMiddle: DockInTheWay = (caption, stage) => {
  const middle = stage.left + stage.width / 2;
  return caption.left < middle && caption.right > middle;
};

/* The scene's names keep above the caption, as they do above the dock. */
const clearance = { inTheWay: acrossTheMiddle, property: "--caption-clear" };

/** The formula behind a step, under its words. */
function StepEquation({ step }: { step: TourStep }) {
  const equation = step.equation ? VOYAGE_EQUATIONS[step.equation] : undefined;
  return equation ? <GuideEquation>{equation.toString()}</GuideEquation> : null;
}

/**
 * The journey's caption, above the flight dock: where the ship is, what to notice, the formula
 * behind it, and the hold.
 */
export function VoyageGuide() {
  const index = useVoyage((s) => s.guideStep);
  const playing = useVoyage((s) => s.guidePlaying);
  const landed = useVoyage((s) => s.guideLanded);
  return (
    <GuideCaption
      namespace="voyage"
      getState={useVoyage.getState}
      tour={TOUR}
      dwell={TOUR_DWELL}
      index={index}
      playing={playing}
      landed={landed}
      className="bottom-(--hud-clear,6rem) pb-2"
      clearance={clearance}
      figures={PROSE_FIGURES}
      extra={(step) => <StepEquation step={step} />}
    />
  );
}

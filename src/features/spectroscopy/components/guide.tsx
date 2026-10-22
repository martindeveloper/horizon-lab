"use client";

import { GuideCaption } from "@/components/simulations/guide-caption";
import { GuideEquation } from "@/components/simulations/guide-card";

import { PROSE_FIGURES } from "../lib/model/catalogue";
import { SPECTROSCOPY_EQUATIONS } from "../lib/model/equations";
import { GUIDE_DWELL, TOUR, type TourStep } from "../lib/model/tour";
import { useSpectroscopy } from "../lib/store";

const equationOf = (step: TourStep) => {
  const equation = step.equation ? SPECTROSCOPY_EQUATIONS[step.equation] : undefined;
  return equation ? <GuideEquation>{equation.toString()}</GuideEquation> : null;
};

/**
 * The guided journey's caption, low over the spectrum (which ends above it, as it does above
 * the dock): where we are, what to notice, the formula behind it, and the hold before the
 * guide moves on.
 */
export function SpectroscopyGuide() {
  const index = useSpectroscopy((s) => s.guideStep);
  const playing = useSpectroscopy((s) => s.guidePlaying);
  const landed = useSpectroscopy((s) => s.guideLanded);
  return (
    <GuideCaption
      namespace="spectroscopy"
      getState={useSpectroscopy.getState}
      tour={TOUR}
      dwell={GUIDE_DWELL}
      index={index}
      playing={playing}
      landed={landed}
      extra={equationOf}
      figures={PROSE_FIGURES}
    />
  );
}

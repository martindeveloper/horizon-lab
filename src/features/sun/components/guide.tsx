"use client";

import { GuideCaption } from "@/components/simulations/guide-caption";
import { GuideEquation } from "@/components/simulations/guide-card";
import { PROSE_FIGURES } from "@/space/sun/catalogue";
import { SUN_EQUATIONS } from "@/space/sun/equations";

import { TOUR, TOUR_DWELL, type TourStep } from "../lib/model/tour";
import { useSun } from "../lib/store";

/** The formula behind a step, under its words. */
function StepEquation({ step }: { step: TourStep }) {
  const equation = step.equation ? SUN_EQUATIONS[step.equation] : undefined;
  return equation ? <GuideEquation>{equation.toString()}</GuideEquation> : null;
}

/** The journey's caption: where we are, what to notice, a figure from the catalogue and its formula. */
export function SunGuide() {
  const index = useSun((s) => s.guideStep);
  const playing = useSun((s) => s.guidePlaying);
  const landed = useSun((s) => s.guideLanded);
  return (
    <GuideCaption
      namespace="sun"
      getState={useSun.getState}
      tour={TOUR}
      dwell={TOUR_DWELL}
      index={index}
      playing={playing}
      landed={landed}
      figures={PROSE_FIGURES}
      extra={(step) => <StepEquation step={step} />}
    />
  );
}

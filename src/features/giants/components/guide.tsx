"use client";

import { GuideCaption } from "@/components/simulations/guide-caption";
import { GuideEquation } from "@/components/simulations/guide-card";

import { GIANTS_EQUATIONS } from "../lib/model/equations";
import { GUIDE_DWELL, TOUR, type TourStep } from "../lib/model/tour";
import { useGiants } from "../lib/store";
import { tourFigure, useDistance, useGiantsT } from "./format";

/** The figure a step quotes and the formula behind it, under its words. */
function StepExtra({ step }: { step: TourStep }) {
  const { t } = useGiantsT();
  const distance = useDistance();
  const equation = step.equation ? GIANTS_EQUATIONS[step.equation] : undefined;
  const value = tourFigure(step, t, distance);
  return (
    <>
      {value && step.figure ? (
        <p className="mt-2 font-mono text-ui text-fg-secondary tabular-nums">
          {t(`tour.figures.${step.figure}`, { value })}
        </p>
      ) : null}
      {equation ? <GuideEquation>{equation.toString()}</GuideEquation> : null}
    </>
  );
}

/** The guided climb's caption: where we are, what to notice, a figure and its formula. */
export function GiantsGuide() {
  const index = useGiants((s) => s.guideStep);
  const playing = useGiants((s) => s.guidePlaying);
  const landed = useGiants((s) => s.guideLanded);
  return (
    <GuideCaption
      namespace="giants"
      getState={useGiants.getState}
      tour={TOUR}
      dwell={GUIDE_DWELL}
      index={index}
      playing={playing}
      landed={landed}
      extra={(step) => <StepExtra step={step} />}
    />
  );
}

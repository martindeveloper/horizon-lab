"use client";

import { useTranslations } from "next-intl";

import { CrossingRow } from "@/components/simulations/crossing-row";
import { GuideCaption } from "@/components/simulations/guide-caption";
import { GuideEquation } from "@/components/simulations/guide-card";
import { HandoffRow } from "@/components/simulations/handoff-link";
import { giantsManifest } from "@/features/giants/manifest";
import { spectroscopyManifest } from "@/features/spectroscopy/manifest";
import { sunManifest } from "@/features/sun/manifest";
import { slugRoutes } from "@/lib/simulation-paths";
import { simulationOn } from "@/lib/simulations";

import { PROSE_FIGURES } from "../lib/model/catalogue";
import { AFTERGLOW_EQUATIONS } from "../lib/model/equations";
import { TOUR, TOUR_DWELL, type Crossing, type TourStep } from "../lib/model/tour";
import { useAfterglow } from "../lib/store";

/** Where each crossing leads: the lab that shows what the step names, when its switch is on. */
const CROSSINGS: Readonly<Record<Exclude<Crossing, "orrery">, string | null>> = {
  sun: simulationOn(sunManifest) ? slugRoutes(sunManifest.routes).pathFor("surface") : null,
  spectroscopy: slugRoutes(spectroscopyManifest.routes).pathFor("stars"),
  giants: simulationOn(giantsManifest)
    ? slugRoutes(giantsManifest.routes).pathFor("sirius-b")
    : null,
};

function StepExtra({ step }: { step: TourStep }) {
  const t = useTranslations("afterglow");
  const equation = step.equation ? AFTERGLOW_EQUATIONS[step.equation] : undefined;
  const end = () => useAfterglow.getState().endGuide();
  const crossing = step.crossing;
  let link = null;
  if (crossing === "orrery") {
    link = (
      <HandoffRow
        to="orrery"
        view="inner"
        onClick={end}
        title={t("tour.crossings.orrery.title")}
        hint={t("tour.crossings.orrery.hint")}
      />
    );
  } else if (crossing && CROSSINGS[crossing]) {
    link = (
      <CrossingRow
        href={CROSSINGS[crossing]}
        onClick={end}
        title={t(`tour.crossings.${crossing}.title`)}
        hint={t(`tour.crossings.${crossing}.hint`)}
      />
    );
  }
  return (
    <>
      {equation ? <GuideEquation>{equation.toString()}</GuideEquation> : null}
      {link ? <div className="mt-2 -mb-1">{link}</div> : null}
    </>
  );
}

const extra = (step: TourStep) => <StepExtra step={step} />;
/**
 * The caption stands on the dock (`--dock-clear`, published at every width), so it publishes
 * its own height under another name: writing the one it stands on would lift it off the screen.
 */
const clearance = { property: "--caption-clear" };

/** The journey's caption: where and when we stand, what to notice, a formula, a way across. */
export function AfterglowGuide() {
  const index = useAfterglow((s) => s.guideStep);
  const playing = useAfterglow((s) => s.guidePlaying);
  const landed = useAfterglow((s) => s.guideLanded);
  return (
    <GuideCaption
      namespace="afterglow"
      getState={useAfterglow.getState}
      tour={TOUR}
      dwell={TOUR_DWELL}
      index={index}
      playing={playing}
      landed={landed}
      className="bottom-(--dock-clear,6rem) pb-2"
      clearance={clearance}
      extra={extra}
      figures={PROSE_FIGURES}
    />
  );
}

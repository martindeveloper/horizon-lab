import { useTranslations } from "next-intl";

import { SimulationImmersive } from "@/components/simulations/immersive";
import { SimulationLoading } from "@/components/simulations/loading";
import { freshVisit, useFreshVisit } from "@/components/simulations/use-fresh-visit";
import { useViewFromPath, type ViewStore } from "@/components/simulations/use-view-from-path";
import { ANCHOR_IDS } from "@/lib/urls";
import { LoadingOverlay, VisualizationShell } from "@horizon/toolkit/ui";

import type { ViewId } from "../lib/model/view-ids";
import { useSpectroscopy } from "../lib/store";
import { pathForView, viewFromPath } from "../routing";
import { SpectroscopyOverlay } from "./overlay";
import { Stage } from "./stage";
import { useGuideMotion } from "./use-guide-motion";

/** Leaving the simulation starts the next visit fresh, with new mystery cases dealt. */
const restore = freshVisit(useSpectroscopy);
const reset = () => {
  restore();
  useSpectroscopy.getState().shuffleCases();
};
const views: ViewStore<ViewId> = useSpectroscopy;

/** The immersive view hides the guide's caption, so it ends the guide; nothing else. */
function leaveGuide() {
  const state = useSpectroscopy.getState();
  if (state.guideOpen) state.endGuide();
}

export function Spectroscopy() {
  const t = useTranslations("spectroscopy");
  const ready = useSpectroscopy((s) => s.ready);
  const view = useSpectroscopy((s) => s.view);

  /* The guide changes the view itself; the address follows it. */
  useViewFromPath(views, viewFromPath, pathForView);
  useGuideMotion();
  useFreshVisit(reset);

  return (
    <VisualizationShell id={ANCHOR_IDS.mainContent} tabIndex={-1} className="h-full">
      <h1 className="sr-only">
        {t("app")} · {t(`views.${view}.title`)}
      </h1>
      <Stage />
      <SimulationImmersive onEnter={leaveGuide}>
        <SpectroscopyOverlay />
      </SimulationImmersive>
      <LoadingOverlay ready={ready}>
        <SimulationLoading title={t("app")} />
      </LoadingOverlay>
    </VisualizationShell>
  );
}

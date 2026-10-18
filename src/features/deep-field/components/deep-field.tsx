import { useTranslations } from "next-intl";

import { freshVisit, useFreshVisit } from "@/components/simulations/fresh-visit";
import { SimulationImmersive } from "@/components/simulations/immersive";
import { SimulationLoading } from "@/components/simulations/loading";
import { useViewFromPath } from "@/components/simulations/use-view-from-path";
import { LoadingOverlay, VisualizationShell } from "@horizon/toolkit/ui";

import { useDeepField } from "../lib/store";
import { viewFromPath } from "../routing";
import { DeepFieldCanvas } from "./canvas";
import { DeepFieldOverlay } from "./overlay";

/** Leaving the simulation starts the next visit fresh. */
const reset = freshVisit(useDeepField);

/** The guide drives the camera; immersive view ends it. */
function leaveGuide() {
  const state = useDeepField.getState();
  if (state.guideOpen) state.endGuide();
}

export function DeepField() {
  const t = useTranslations("deepField");
  const ready = useDeepField((s) => s.ready);
  const view = useDeepField((s) => s.view);

  useViewFromPath(useDeepField.getState, viewFromPath);
  useFreshVisit(reset);

  return (
    <VisualizationShell id="main-content" tabIndex={-1} className="h-full">
      <h1 className="sr-only">
        {t("app")} · {t(`views.${view}`)}
      </h1>
      <DeepFieldCanvas />
      <SimulationImmersive onEnter={leaveGuide}>
        <DeepFieldOverlay />
      </SimulationImmersive>
      <LoadingOverlay ready={ready}>
        <SimulationLoading title={t("app")} />
      </LoadingOverlay>
    </VisualizationShell>
  );
}

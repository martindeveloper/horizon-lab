import { useTranslations } from "next-intl";

import { useSimulationDrift, type DriftStore } from "@/components/simulations/drift";
import { SimulationImmersive } from "@/components/simulations/immersive";
import { SimulationLoading } from "@/components/simulations/loading";
import { freshVisit, useFreshVisit } from "@/components/simulations/use-fresh-visit";
import { useViewFromPath, type ViewStore } from "@/components/simulations/use-view-from-path";
import { LoadingOverlay, VisualizationShell } from "@horizon/toolkit/ui";

import { DRIFT } from "../lib/drift";
import type { ViewId } from "../lib/model/view-ids";
import { useDeepField, type DeepFieldStore } from "../lib/store";
import { viewFromPath } from "../routing";
import { DeepFieldCanvas } from "./canvas";
import { DeepFieldOverlay } from "./overlay";

/** Leaving the simulation starts the next visit fresh. */
const reset = freshVisit(useDeepField);
/** The store as the address sees it, and as the drift's controls do. */
const views: ViewStore<ViewId> = useDeepField;
const driftStore: DriftStore<DeepFieldStore> = useDeepField;

/** The guide drives the camera; immersive view ends it. */
function leaveGuide() {
  const state = useDeepField.getState();
  if (state.guideOpen) state.endGuide();
}

export function DeepField() {
  const t = useTranslations("deepField");
  const ready = useDeepField((s) => s.ready);
  const view = useDeepField((s) => s.view);
  const drift = useSimulationDrift(
    useDeepField((s) => s.drift),
    driftStore,
    DRIFT,
  );

  useViewFromPath(views, viewFromPath);
  useFreshVisit(reset);

  return (
    <VisualizationShell id="main-content" tabIndex={-1} className="h-full">
      <h1 className="sr-only">
        {t("app")} · {t(`views.${view}`)}
      </h1>
      <DeepFieldCanvas />
      <SimulationImmersive onEnter={leaveGuide} drift={drift}>
        <DeepFieldOverlay />
      </SimulationImmersive>
      <LoadingOverlay ready={ready}>
        <SimulationLoading title={t("app")} />
      </LoadingOverlay>
    </VisualizationShell>
  );
}

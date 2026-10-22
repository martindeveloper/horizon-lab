import { useTranslations } from "next-intl";

import { useSimulationDrift, type DriftStore } from "@/components/simulations/drift";
import { SimulationImmersive } from "@/components/simulations/immersive";
import { SimulationLoading } from "@/components/simulations/loading";
import { freshVisit, useFreshVisit } from "@/components/simulations/use-fresh-visit";
import { useViewFromPath, type ViewStore } from "@/components/simulations/use-view-from-path";
import { ANCHOR_IDS } from "@/lib/urls";
import { LoadingOverlay, VisualizationShell } from "@horizon/toolkit/ui";

import { DRIFT } from "../lib/drift";
import type { ViewId } from "../lib/model/views";
import { useSun, type SunStore } from "../lib/store";
import { viewFromPath } from "../routing";
import { SunCanvas } from "./canvas";
import { SunOverlay } from "./overlay";

const reset = freshVisit(useSun);
const views: ViewStore<ViewId> = useSun;
const driftStore: DriftStore<SunStore> = useSun;

/** The guide drives the camera; immersive view ends it. */
function leaveGuide() {
  const state = useSun.getState();
  if (state.guideOpen) state.endGuide();
}

/** The drift's one readout: the view and the light it is seen in. */
function DriftView() {
  const t = useTranslations("sun");
  const view = useSun((s) => s.view);
  const light = useSun((s) => s.light);
  return (
    <>
      {t(`views.${view}`)} · {t(`lights.${light}`)}
    </>
  );
}

export function Sun() {
  const t = useTranslations("sun");
  const ready = useSun((s) => s.ready);
  const view = useSun((s) => s.view);
  const drift = useSimulationDrift(
    useSun((s) => s.drift),
    driftStore,
    DRIFT,
    <DriftView />,
  );

  useViewFromPath(views, viewFromPath);
  useFreshVisit(reset);

  return (
    <VisualizationShell id={ANCHOR_IDS.mainContent} tabIndex={-1} className="h-full">
      <h1 className="sr-only">
        {t("app")} · {t(`views.${view}`)}
      </h1>
      <SunCanvas />
      <SimulationImmersive onEnter={leaveGuide} drift={drift}>
        <SunOverlay />
      </SimulationImmersive>
      <LoadingOverlay ready={ready}>
        <SimulationLoading title={t("app")} />
      </LoadingOverlay>
    </VisualizationShell>
  );
}

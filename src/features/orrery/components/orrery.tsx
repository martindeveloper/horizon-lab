import { useTranslations } from "next-intl";

import { SimulationImmersive } from "@/components/simulations/immersive";
import { SimulationLoading } from "@/components/simulations/loading";
import { freshVisit, useFreshVisit } from "@/components/simulations/use-fresh-visit";
import { useViewFromPath } from "@/components/simulations/use-view-from-path";
import { LoadingOverlay, VisualizationShell } from "@horizon/toolkit/ui";

import { useOrrery } from "../lib/store";
import { viewFromPath } from "../routing";
import { OrreryCanvas } from "./canvas";
import { OrreryOverlay } from "./overlay";
import { SolarActivityNotice } from "./solar-activity-controls";

/** Leaving the simulation starts the next visit fresh. */
const reset = freshVisit(useOrrery);

/** The tour drives the camera; immersive view ends it but keeps panels for the return. */
function leaveGuide() {
  const state = useOrrery.getState();
  if (state.guideOpen) state.endGuide();
}

export function Orrery() {
  const t = useTranslations("orrery");
  const ready = useOrrery((s) => s.ready);
  const view = useOrrery((s) => s.view);

  useViewFromPath(useOrrery.getState, viewFromPath);
  useFreshVisit(reset);

  return (
    <VisualizationShell id="main-content" tabIndex={-1} className="h-full">
      <h1 className="sr-only">
        {t("app")} · {t(`views.${view}`)}
      </h1>
      <OrreryCanvas />
      <SimulationImmersive onEnter={leaveGuide}>
        <OrreryOverlay />
      </SimulationImmersive>
      <SolarActivityNotice />
      <LoadingOverlay ready={ready}>
        <SimulationLoading title={t("app")} />
      </LoadingOverlay>
    </VisualizationShell>
  );
}

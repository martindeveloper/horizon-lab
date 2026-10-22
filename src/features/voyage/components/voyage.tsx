import { useTranslations } from "next-intl";

import { SimulationImmersive } from "@/components/simulations/immersive";
import { SimulationLoading } from "@/components/simulations/loading";
import { freshVisit, useFreshVisit } from "@/components/simulations/use-fresh-visit";
import { useViewFromPath, type ViewStore } from "@/components/simulations/use-view-from-path";
import { ANCHOR_IDS } from "@/lib/urls";
import { LoadingOverlay, VisualizationShell } from "@horizon/toolkit/ui";

import type { ViewId } from "../lib/model/view-ids";
import { useVoyage } from "../lib/store";
import { viewFromPath } from "../routing";
import { VoyageCanvas } from "./canvas";
import { VoyageOverlay } from "./overlay";

/** Leaving the simulation starts the next visit fresh. */
const reset = freshVisit(useVoyage);
/** The store as the address sees it. */
const views: ViewStore<ViewId> = useVoyage;

/** The guide flies the ship; immersive view ends it. */
function leaveGuide() {
  const state = useVoyage.getState();
  if (state.guideOpen) state.endGuide();
}

export function Voyage() {
  const t = useTranslations("voyage");
  const ready = useVoyage((s) => s.ready);
  const view = useVoyage((s) => s.view);

  useViewFromPath(views, viewFromPath);
  useFreshVisit(reset);

  return (
    <VisualizationShell id={ANCHOR_IDS.mainContent} tabIndex={-1} className="h-full">
      <h1 className="sr-only">
        {t("app")} · {t(`views.${view}`)}
      </h1>
      <VoyageCanvas />
      <SimulationImmersive onEnter={leaveGuide}>
        <VoyageOverlay />
      </SimulationImmersive>
      <LoadingOverlay ready={ready}>
        <SimulationLoading title={t("app")} />
      </LoadingOverlay>
    </VisualizationShell>
  );
}

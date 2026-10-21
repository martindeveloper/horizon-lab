import { useTranslations } from "next-intl";

import { SimulationImmersive } from "@/components/simulations/immersive";
import { SimulationLoading } from "@/components/simulations/loading";
import { freshVisit, useFreshVisit } from "@/components/simulations/use-fresh-visit";
import { useViewFromPath, type ViewStore } from "@/components/simulations/use-view-from-path";
import { LoadingOverlay, VisualizationShell } from "@horizon/toolkit/ui";

import type { RungId } from "../lib/model/rungs";
import { useGiants } from "../lib/store";
import { rungFromPath } from "../routing";
import { GiantsCanvas } from "./canvas";
import { GiantsOverlay } from "./overlay";

/** Leaving the simulation starts the next visit fresh. */
const reset = freshVisit(useGiants);
/** The store as the address sees it: a link to a rung flies there; climbing leaves the address be. */
const views: ViewStore<RungId> = useGiants;

/** The immersive view hides the guide's caption, so it ends the guide. */
function leaveGuide() {
  const state = useGiants.getState();
  if (state.guideOpen) state.endGuide();
}

export function Giants() {
  const t = useTranslations("giants");
  const ready = useGiants((s) => s.ready);
  useViewFromPath(views, rungFromPath);
  useFreshVisit(reset);

  return (
    <VisualizationShell id="main-content" tabIndex={-1} className="h-full">
      <h1 className="sr-only">{t("app")}</h1>
      <GiantsCanvas />
      <SimulationImmersive onEnter={leaveGuide}>
        <GiantsOverlay />
      </SimulationImmersive>
      <LoadingOverlay ready={ready}>
        <SimulationLoading title={t("app")} />
      </LoadingOverlay>
    </VisualizationShell>
  );
}

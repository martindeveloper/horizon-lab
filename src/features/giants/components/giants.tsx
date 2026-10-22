import { useTranslations } from "next-intl";

import { useSimulationDrift, type DriftStore } from "@/components/simulations/drift";
import { SimulationImmersive } from "@/components/simulations/immersive";
import { SimulationLoading } from "@/components/simulations/loading";
import { freshVisit, useFreshVisit } from "@/components/simulations/use-fresh-visit";
import { useViewFromPath, type ViewStore } from "@/components/simulations/use-view-from-path";
import { ANCHOR_IDS } from "@/lib/urls";
import { LoadingOverlay, VisualizationShell } from "@horizon/toolkit/ui";

import { DRIFT } from "../lib/drift";
import { rungNameKey } from "../lib/model/names";
import { RUNG_IDS, type RungId } from "../lib/model/rungs";
import { useGiants, type GiantsStore } from "../lib/store";
import { rungFromPath } from "../routing";
import { GiantsCanvas } from "./canvas";
import { GiantsOverlay } from "./overlay";

const reset = freshVisit(useGiants);
/** The store as the address sees it: a link to a rung flies there; climbing leaves the address be. */
const views: ViewStore<RungId> = useGiants;
const driftStore: DriftStore<GiantsStore> = useGiants;

/** The immersive view hides the guide's caption, so it ends the guide. */
function leaveGuide() {
  const state = useGiants.getState();
  if (state.guideOpen) state.endGuide();
}

/** The drift's one readout: the body in focus, since the stage's names step aside in immersive view. */
function DriftBody() {
  const t = useTranslations("giants");
  const focus = useGiants((s) => s.focus);
  return <>{t(rungNameKey(RUNG_IDS[focus] ?? RUNG_IDS[0]))}</>;
}

export function Giants() {
  const t = useTranslations("giants");
  const ready = useGiants((s) => s.ready);
  const drift = useSimulationDrift(
    useGiants((s) => s.drift),
    driftStore,
    DRIFT,
    <DriftBody />,
  );
  useViewFromPath(views, rungFromPath);
  useFreshVisit(reset);

  return (
    <VisualizationShell id={ANCHOR_IDS.mainContent} tabIndex={-1} className="h-full">
      <h1 className="sr-only">{t("app")}</h1>
      <GiantsCanvas />
      <SimulationImmersive onEnter={leaveGuide} drift={drift}>
        <GiantsOverlay />
      </SimulationImmersive>
      <LoadingOverlay ready={ready}>
        <SimulationLoading title={t("app")} />
      </LoadingOverlay>
    </VisualizationShell>
  );
}

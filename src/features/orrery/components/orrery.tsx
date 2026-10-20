import { useFormatter, useTranslations } from "next-intl";

import { useSimulationDrift, type DriftStore } from "@/components/simulations/drift";
import { SimulationImmersive } from "@/components/simulations/immersive";
import { SimulationLoading } from "@/components/simulations/loading";
import { freshVisit, useFreshVisit } from "@/components/simulations/use-fresh-visit";
import { useViewFromPath, type ViewStore } from "@/components/simulations/use-view-from-path";
import type { SolarViewId } from "@/space/solar-system/model/views";
import { LoadingOverlay, VisualizationShell } from "@horizon/toolkit/ui";

import { DRIFT } from "../lib/drift";
import { useOrrery, type OrreryStore } from "../lib/store";
import { viewFromPath } from "../routing";
import { OrreryCanvas } from "./canvas";
import { OrreryOverlay } from "./overlay";
import { SolarActivityNotice } from "./solar-activity-controls";
import { motionRateLabel } from "./time-dock";

/** Leaving the simulation starts the next visit fresh. */
const reset = freshVisit(useOrrery);
/** The store as the address sees it, and as the drift does. */
const views: ViewStore<SolarViewId> = useOrrery;
const driftStore: DriftStore<OrreryStore> = useOrrery;

/** The tour drives the camera; immersive view ends it but keeps panels for the return. */
function leaveGuide() {
  const state = useOrrery.getState();
  if (state.guideOpen) state.endGuide();
}
/** The drift's one readout: how fast the clock runs, since the planets' motion is what it shows. */
function DriftClock() {
  const t = useTranslations("orrery");
  const f = useFormatter();
  const rate = useOrrery((s) => s.driftRate);
  return (
    <>
      {t("toggles.drift")} · {motionRateLabel(t, f, rate)}
    </>
  );
}

export function Orrery() {
  const t = useTranslations("orrery");
  const ready = useOrrery((s) => s.ready);
  const view = useOrrery((s) => s.view);
  const drift = useSimulationDrift(driftStore, DRIFT, <DriftClock />);

  useViewFromPath(views, viewFromPath);
  useFreshVisit(reset);

  return (
    <VisualizationShell id="main-content" tabIndex={-1} className="h-full">
      <h1 className="sr-only">
        {t("app")} · {t(`views.${view}`)}
      </h1>
      <OrreryCanvas />
      <SimulationImmersive onEnter={leaveGuide} drift={drift}>
        <OrreryOverlay />
      </SimulationImmersive>
      <SolarActivityNotice />
      <LoadingOverlay ready={ready}>
        <SimulationLoading title={t("app")} />
      </LoadingOverlay>
    </VisualizationShell>
  );
}

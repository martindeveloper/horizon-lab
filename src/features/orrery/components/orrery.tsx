import { useTranslations } from "next-intl";
import { useLayoutEffect } from "react";

import { SimulationImmersive } from "@/components/simulations/immersive";
import { SimulationLoading } from "@/components/simulations/loading";
import { usePathname } from "@/i18n/navigation";
import { LoadingOverlay, VisualizationShell } from "@horizon/toolkit/ui";

import { useOrrery } from "../lib/store";
import { viewFromPath } from "../routing";
import { OrreryCanvas } from "./canvas";
import { OrreryOverlay } from "./overlay";

/** The tour drives the camera; immersive view ends it but keeps panels for the return. */
function leaveGuide() {
  const state = useOrrery.getState();
  if (state.guideOpen) state.endGuide();
}

export function Orrery() {
  const t = useTranslations("orrery");
  const pathname = usePathname();
  const ready = useOrrery((s) => s.ready);
  const view = useOrrery((s) => s.view);

  useLayoutEffect(() => {
    const id = viewFromPath(pathname);
    const state = useOrrery.getState();
    if (state.view !== id) state.setView(id);
  }, [pathname]);

  return (
    <VisualizationShell id="main-content" tabIndex={-1} className="h-full">
      <h1 className="sr-only">
        {t("app")} · {t(`views.${view}`)}
      </h1>
      <OrreryCanvas />
      <SimulationImmersive onEnter={leaveGuide}>
        <OrreryOverlay />
      </SimulationImmersive>
      <LoadingOverlay ready={ready}>
        <SimulationLoading title={t("app")} />
      </LoadingOverlay>
    </VisualizationShell>
  );
}

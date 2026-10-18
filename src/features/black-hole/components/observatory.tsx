import { useLayoutEffect } from "react";

import { SimulationImmersive } from "@/components/simulations/immersive";
import { freshVisit, useFreshVisit } from "@/components/simulations/use-fresh-visit";
import { BlackHoleCanvas } from "@/features/black-hole/components/canvas";
import { HorizonLoader } from "@/features/black-hole/components/loader";
import { ObservatoryOverlay } from "@/features/black-hole/components/overlay";
import { useBlackHole } from "@/features/black-hole/lib/store";
import { presetFromPath } from "@/features/black-hole/routing";
import { usePathname } from "@/i18n/navigation";
import { VisualizationShell } from "@horizon/toolkit/ui";

import { BLACK_HOLE_PATH } from "../manifest";
import { SceneCameraProvider } from "./scene-camera";

/** Leaving the observatory starts the next visit fresh. */
const reset = freshVisit(useBlackHole);

export function Observatory() {
  const pathname = usePathname();
  useFreshVisit(reset);
  const closePanels = useBlackHole((s) => s.closePanels);

  useLayoutEffect(() => {
    const id = presetFromPath(pathname).id;
    if (!id) return;
    const state = useBlackHole.getState();
    if (pathname === BLACK_HOLE_PATH && state.presetId === "custom") return;
    if (state.presetId !== id) state.applyPreset(id);
  }, [pathname]);

  return (
    <SceneCameraProvider>
      <VisualizationShell id="main-content" tabIndex={-1} className="h-full">
        <BlackHoleCanvas />
        <SimulationImmersive onEnter={closePanels}>
          <ObservatoryOverlay />
        </SimulationImmersive>
        <HorizonLoader />
      </VisualizationShell>
    </SceneCameraProvider>
  );
}

import { useSimulationDrift } from "@/components/simulations/drift";
import { SimulationRoot } from "@/components/simulations/simulation-root";
import type { ViewStore } from "@/components/simulations/use-view-from-path";

import { driftFor } from "../lib/drift";
import { DEFAULT_PRESET_ID } from "../lib/holes/routes";
import { useBlackHole, type BlackHoleStore } from "../lib/store";
import { presetIdFromPath } from "../routing";
import { BlackHoleCanvas } from "./canvas";
import { ObservatoryOverlay } from "./overlay";
import { SceneCameraProvider } from "./scene-camera";

/** The store as the root holds it: a module value, so the component passes no hook. */
const store = useBlackHole;

/**
 * The store as the address sees it: the preset is its view. A hole the visitor has made their
 * own ("custom") lives at the default address, so that address leaves it be.
 */
const views: ViewStore<string> = {
  getState: () => {
    const state = store.getState();
    return {
      view: state.presetId,
      setView: (id) => {
        if (id === DEFAULT_PRESET_ID && state.presetId === "custom") return;
        state.applyPreset(id);
      },
    };
  },
  subscribe: store.subscribe,
};
/** The immersive view closes the panels; the guide keeps running behind the view. */
const closePanels = () => store.getState().closePanels();
/** The first frame with the sky in it. */
const skyReady = (state: BlackHoleStore) => state.skyReady;

export function Observatory() {
  const drift = useSimulationDrift(
    useBlackHole((s) => s.drift),
    store,
    driftFor(useBlackHole((s) => s.diskBrightness)),
  );
  return (
    <SceneCameraProvider>
      <SimulationRoot
        namespace="blackHole"
        store={store}
        views={{ store: views, fromPath: presetIdFromPath }}
        drift={drift}
        ready={skyReady}
        onImmersive={closePanels}
        canvas={<BlackHoleCanvas />}
        overlay={<ObservatoryOverlay />}
      />
    </SceneCameraProvider>
  );
}

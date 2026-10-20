import { mountSceneEngine } from "@/space/bench";
import type { BenchScene, BenchTarget } from "@horizon/toolkit/bench";

import { DEFAULT_VIEW } from "./lib/model/view-ids";
import { createDeepFieldEngine } from "./lib/scene/engine";
import { useDeepField } from "./lib/store";

type DeepFieldBenchScene = BenchScene & { bloom: boolean };

/** The Galaxy (home view) at standard quality, as a visitor first sees it, and the same with bloom on. */
const SCENES: readonly DeepFieldBenchScene[] = [
  {
    id: "home",
    description: "The Galaxy (home view), standard quality",
    tags: ["preset"],
    bloom: false,
  },
  {
    id: "home-bloom",
    description: "The Galaxy (home view), standard quality, bloom on",
    tags: ["effects"],
    bloom: true,
  },
];

/**
 * Headless benchmark target: Deep Field's engine on its store, exactly as the page mounts it,
 * each bench frame one of its frames (`mountSceneEngine`).
 */
export const benchTarget: BenchTarget = {
  id: "deep-field",
  scenes: SCENES,
  mount(sceneId, surface) {
    const scene = SCENES.find((s) => s.id === sceneId);
    if (!scene) throw new Error(`Unknown deep-field scene: ${sceneId}`);
    const store = useDeepField;
    store.getState().resetView();
    store.setState({ view: DEFAULT_VIEW, quality: "standard", bloom: scene.bloom });
    const instance = mountSceneEngine(surface, createDeepFieldEngine, () => store.setState({}));
    return {
      ...instance,
      describe: () => {
        const { view, quality, antialias, bloom } = store.getState();
        return { view, quality, antialias: antialias ?? "default", bloom };
      },
    };
  },
};

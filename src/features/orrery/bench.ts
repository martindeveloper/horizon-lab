import { mountSceneEngine } from "@/space/bench";
import type { BenchScene, BenchTarget } from "@horizon/toolkit/bench";

import { DEFAULT_VIEW } from "./lib/model/views";
import { createOrreryEngine } from "./lib/scene/engine";
import { useOrrery } from "./lib/store";

type OrreryBenchScene = BenchScene & { bloom: boolean };

/** The home view at standard quality, as a visitor first sees it, and the same with bloom on. */
const SCENES: readonly OrreryBenchScene[] = [
  {
    id: "home",
    description: "The giants (home view), standard quality",
    tags: ["preset"],
    bloom: false,
  },
  {
    id: "home-bloom",
    description: "The giants (home view), standard quality, bloom on",
    tags: ["effects"],
    bloom: true,
  },
];

/**
 * Headless benchmark target: the Orrery's engine on its store, exactly as the page mounts it,
 * each bench frame one of its frames (`mountSceneEngine`).
 */
export const benchTarget: BenchTarget = {
  id: "orrery",
  scenes: SCENES,
  mount(sceneId, surface) {
    const scene = SCENES.find((s) => s.id === sceneId);
    if (!scene) throw new Error(`Unknown orrery scene: ${sceneId}`);
    const store = useOrrery;
    store.getState().resetView();
    store.setState({ view: DEFAULT_VIEW, quality: "standard", bloom: scene.bloom, playing: false });
    const instance = mountSceneEngine(surface, createOrreryEngine, () => store.setState({}));
    return {
      ...instance,
      describe: () => {
        const { view, quality, antialias, bloom } = store.getState();
        return { view, quality, antialias: antialias ?? "default", bloom };
      },
    };
  },
};

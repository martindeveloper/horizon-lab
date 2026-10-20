import { mountSceneEngine } from "@/space/bench";
import type { BenchScene, BenchTarget } from "@horizon/toolkit/bench";

import { DEFAULT_VIEW } from "./lib/model/views";
import { createOrreryEngine } from "./lib/scene/engine";
import { useOrrery } from "./lib/store";

type OrreryBenchScene = BenchScene & { bloom: boolean; lens: boolean };

/** The home view at standard quality, as a visitor first sees it, and the same with bloom on and with the lens on. */
const SCENES: readonly OrreryBenchScene[] = [
  {
    id: "home",
    description: "The giants (home view), standard quality",
    tags: ["preset"],
    bloom: false,
    lens: false,
  },
  {
    id: "home-bloom",
    description: "The giants (home view), standard quality, bloom on",
    tags: ["effects"],
    bloom: true,
    lens: false,
  },
  {
    id: "home-lens",
    description: "The giants (home view), standard quality, lens on",
    tags: ["effects"],
    bloom: false,
    lens: true,
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
    store.setState({
      view: DEFAULT_VIEW,
      quality: "standard",
      bloom: scene.bloom,
      lens: scene.lens,
      playing: false,
    });
    const instance = mountSceneEngine(surface, createOrreryEngine, () => store.setState({}));
    return {
      ...instance,
      describe: () => {
        const { view, quality, antialias, bloom, lens } = store.getState();
        return { view, quality, antialias: antialias ?? "default", bloom, lens };
      },
    };
  },
};

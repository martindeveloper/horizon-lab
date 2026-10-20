import { mountSceneEngine } from "@/space/bench";
import type { BenchScene, BenchTarget } from "@horizon/toolkit/bench";
import type { PlanetId } from "@horizon/toolkit/bodies";

import { DEFAULT_VIEW } from "./lib/model/views";
import { createOrreryEngine } from "./lib/scene/engine";
import { useOrrery } from "./lib/store";

type OrreryBenchScene = BenchScene & {
  bloom: boolean;
  lens: boolean;
  /** A close-up of this body, landed: the flight is run before the first frame. */
  closeUp?: PlanetId;
};

/** Frames the mount runs before a close-up scene's first one: the flight in, then its map painted. */
const CLOSE_UP_PREROLL = 600;

/**
 * The home view at standard quality, as a visitor first sees it, the same with bloom on and
 * with the lens on, and a close-up of the Earth (its atmosphere shell over the globe).
 */
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
  {
    id: "earth-close-up",
    description: "Close-up of the Earth, standard quality: the globe under its atmosphere shell",
    tags: ["close-up"],
    bloom: false,
    lens: false,
    closeUp: "earth",
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
    if (scene.closeUp) {
      /* Select the body and fly in, frame by frame, so the timed frames show the landed close-up. */
      store.getState().select({ kind: "planet", id: scene.closeUp });
      store.getState().enterCloseUp();
      for (let index = 0; index < CLOSE_UP_PREROLL; index += 1)
        instance.render({
          index,
          count: CLOSE_UP_PREROLL,
          progress: 0,
          time: index / 60,
          dt: 1 / 60,
        });
    }
    return {
      ...instance,
      describe: () => {
        const { view, quality, antialias, bloom, lens, closeUp } = store.getState();
        return { view, quality, antialias: antialias ?? "default", bloom, lens, closeUp };
      },
    };
  },
};

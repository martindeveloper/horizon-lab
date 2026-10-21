import { mountSceneEngine } from "@/space/bench";
import type { BenchFrame, BenchScene, BenchTarget } from "@horizon/toolkit/bench";

import { placeById } from "./lib/model/places";
import type { ViewId } from "./lib/model/view-ids";
import { createVoyageEngine } from "./lib/scene/engine";
import { useVoyage } from "./lib/store";

type VoyageBenchScene = BenchScene & {
  view: ViewId;
  /** A free flight from the place: the ship turns its back on it and burns at one g. */
  burn?: boolean;
};

/** Ship seconds per real second on the burn: about four months a second. */
const BURN_COMPRESSION = 1e7;
/**
 * Real seconds of the burn, and its frames: six ship-years at one g, past rapidity 6. The
 * starbow forms in the first year (β ≈ 0.75 at 15 %); by the end γ is in the hundreds and
 * the sky, the band and the glowing background all sit in a spot ahead.
 */
const BURN_S = 20;
const BURN_FRAMES = 240;
/** Pad steps that turn the ship round: twelve of 15°. */
const ABOUT_FACE = 12;

/**
 * The ship parked at each place as a visitor arrives, standard quality, the clocks held; and
 * one burn from Earth at one g, the sky crowding ahead and the background glowing by the end.
 */
const SCENES: readonly VoyageBenchScene[] = [
  {
    id: "earth",
    description: "Parked at Earth, standard quality",
    tags: ["preset"],
    view: "earth",
  },
  {
    id: "moon",
    description: "Parked at the Moon, standard quality",
    tags: ["preset"],
    view: "moon",
  },
  {
    id: "saturn",
    description: "Parked at Saturn with its rings, standard quality",
    tags: ["preset"],
    view: "saturn",
  },
  {
    id: "pluto",
    description: "Parked at Pluto, standard quality",
    tags: ["preset"],
    view: "pluto",
  },
  {
    id: "stars",
    description: "Parked at α Centauri A, standard quality",
    tags: ["preset"],
    view: "stars",
  },
  {
    id: "galaxy",
    description: "Parked above the Galaxy, standard quality",
    tags: ["preset"],
    view: "galaxy",
  },
  {
    id: "edge",
    description: "Parked at the edge of the reachable, standard quality",
    tags: ["preset"],
    view: "edge",
  },
  {
    id: "torch-burn",
    description:
      "Free flight from Earth at one g for six ship-years: the starbow, then the sky gathered into a spot ahead",
    tags: ["sequence"],
    view: "earth",
    burn: true,
    script: {
      frames: BURN_FRAMES,
      duration: BURN_S,
      keyframes: [0, 0.15, 0.3, 0.5, 0.8, 1],
    },
  },
];

/**
 * Headless benchmark target: Voyage's engine on its store, exactly as the page mounts it,
 * each bench frame one of its frames (`mountSceneEngine`).
 */
export const benchTarget: BenchTarget = {
  id: "voyage",
  scenes: SCENES,
  mount(sceneId, surface) {
    const scene = SCENES.find((s) => s.id === sceneId);
    if (!scene) throw new Error(`Unknown voyage scene: ${sceneId}`);
    const store = useVoyage;
    store.setState(store.getInitialState(), true);
    store.setState({
      view: scene.view,
      destination: placeById(scene.view).body,
      quality: "standard",
      compression: 0,
    });
    const instance = mountSceneEngine(surface, createVoyageEngine, () => store.setState({}));
    if (scene.burn) {
      /* One parked frame places the camera; then leave, turn round and hold the thrust. */
      const first: BenchFrame = { index: 0, count: 1, progress: 0, time: 0, dt: 1 / 60 };
      instance.render(first);
      store.setState({ mode: "free", drive: "torch", compression: BURN_COMPRESSION });
      store.getState().rotate({ azimuth: ABOUT_FACE, inclination: 0 });
      store.getState().setPilot({ thrust: 1 });
    }
    return {
      ...instance,
      describe: () => {
        const { view, destination, mode, quality, antialias, gamma, speed } = store.getState();
        return {
          view,
          destination,
          mode,
          quality,
          antialias: antialias ?? "default",
          gamma,
          speed,
        };
      },
    };
  },
};

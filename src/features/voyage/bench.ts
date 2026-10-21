import { mountSceneEngine } from "@/space/bench";
import type { BenchFrame, BenchScene, BenchTarget } from "@horizon/toolkit/bench";

import type { AnchorId } from "./lib/model/anchors";
import { PLACE_BODY } from "./lib/model/places";
import type { ViewId } from "./lib/model/view-ids";
import { createVoyageEngine } from "./lib/scene/engine";
import { useVoyage } from "./lib/store";

type VoyageBenchScene = BenchScene & {
  view: ViewId;
  /** A free flight from the place: the ship turns its back on it and burns at one g. */
  burn?: boolean;
  /** The autopilot flies the torch ship from the place to this anchor. */
  flyTo?: AnchorId;
  /** A flight by hand from the place on the light sail, the dust streaming past. */
  cruise?: boolean;
  /** Faint ring systems' long exposure, when the scene sets it rather than the visit's default. */
  faintRings?: boolean;
};

/** Ship seconds per real second on the burn: about four months a second. */
const BURN_WARP = 1e7;
/** And on the sail's cruise: a minute a second. */
const CRUISE_WARP = 60;
/**
 * Real seconds of the burn, and its frames: six ship-years at one g, past rapidity 6. The
 * starbow forms in the first year (β ≈ 0.75 at 15 %); by the end γ is in the hundreds and
 * the sky, the band and the glowing background all sit in a spot ahead.
 */
const BURN_S = 20;
const BURN_FRAMES = 240;
/** The autopilot's flight from Earth to Neptune, its arrival in the last keyframes. */
const NEPTUNE_FLIGHT = { frames: 600, duration: 40, keyframes: [0.6, 0.8, 0.9, 1] };

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
  {
    id: "autopilot",
    description:
      "The autopilot flies the torch ship from Earth to Jupiter: align, burn, flip, brake, arrival",
    tags: ["sequence"],
    view: "earth",
    flyTo: "jupiter",
    script: { frames: 330, duration: 22, keyframes: [0.05, 0.2, 0.4, 0.6, 0.8, 0.95, 1] },
  },
  {
    id: "neptune",
    description:
      "The autopilot flies from Earth to Neptune: its rings in a long exposure, as a visit starts",
    tags: ["sequence"],
    view: "earth",
    flyTo: "neptune",
    script: NEPTUNE_FLIGHT,
  },
  {
    id: "neptune-plain",
    description: "The same flight to Neptune with Faint rings off: the rings as the eye sees them",
    tags: ["sequence", "effects"],
    view: "earth",
    flyTo: "neptune",
    faintRings: false,
    script: NEPTUNE_FLIGHT,
  },
  {
    id: "cruise",
    description: "By hand from Earth on the light sail at a minute a second: the dust streams past",
    tags: ["sequence"],
    view: "earth",
    cruise: true,
    script: { frames: 60, duration: 3, keyframes: [0.5, 1] },
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
      destination: PLACE_BODY[scene.view],
      quality: "standard",
      compression: 0,
    });
    if (scene.faintRings !== undefined)
      store.getState().patchShow({ faintRings: scene.faintRings });
    /* Flown by hand, the bench holds the warp fixed rather than the flight assist's. */
    const warp = scene.burn ? BURN_WARP : scene.cruise ? CRUISE_WARP : null;
    const instance = mountSceneEngine(
      surface,
      (mount) => createVoyageEngine(mount, warp === null ? {} : { warp: () => warp }),
      () => store.setState({}),
    );
    if (scene.burn || scene.flyTo || scene.cruise) {
      /* One parked frame places the camera. */
      const first: BenchFrame = { index: 0, count: 1, progress: 0, time: 0, dt: 1 / 60 };
      instance.render(first);
    }
    if (scene.burn) {
      /* Leave, turn round and open the lever. */
      store.setState({ mode: "free", drive: "torch", compression: 1 });
      store.getState().rotate({ azimuth: ABOUT_FACE, inclination: 0 });
      store.getState().setThrottle(1);
    } else if (scene.flyTo) {
      store.setState({ drive: "torch" });
      store.getState().goTo(scene.flyTo);
    } else if (scene.cruise) {
      store.setState({ mode: "free", drive: "sail", compression: 1 });
      store.getState().setThrottle(1);
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

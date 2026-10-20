import { mountSceneEngine } from "@/space/bench";
import type { BenchScene, BenchTarget } from "@horizon/toolkit/bench";
import type { PlanetId } from "@horizon/toolkit/bodies";

import { SUN_ACTIVITY_CYCLE_SECONDS } from "./lib/model/solar-activity";
import { DEFAULT_VIEW } from "./lib/model/views";
import { createOrreryEngine } from "./lib/scene/engine";
import { useOrrery } from "./lib/store";

type OrreryBenchScene = BenchScene & {
  bloom: boolean;
  lens: boolean;
  /** A close-up of this body, landed: the flight is run before the first frame. */
  closeUp?: PlanetId | "sun";
  /** The Sun's close-up with its optional activity switched on and loaded. */
  solarActivity?: boolean;
};

/** Frames the mount runs before a close-up scene's first one: the flight in, then its map painted. */
const CLOSE_UP_PREROLL = 600;

/** The activity's dynamics advance at most a tenth of a second per frame (`advance`). */
const ACTIVITY_FRAME_S = 0.1;

/**
 * The home view at standard quality, as a visitor first sees it, the same with bloom on and
 * with the lens on, a close-up of the Earth (its atmosphere shell over the globe), and the
 * Sun's close-up: as landed, with its activity on, and the activity's cycle as a sequence.
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
  {
    id: "sun-close-up",
    description: "Close-up of the Sun, standard quality, solar activity off",
    tags: ["close-up"],
    bloom: false,
    lens: false,
    closeUp: "sun",
  },
  {
    id: "sun-activity",
    description: "Close-up of the Sun, standard quality, solar activity on",
    tags: ["close-up", "effects"],
    bloom: false,
    lens: false,
    closeUp: "sun",
    solarActivity: true,
  },
  {
    id: "sun-activity-cycle",
    description: "Close-up of the Sun with solar activity on: one activity cycle",
    tags: ["sequence", "effects"],
    bloom: false,
    lens: false,
    closeUp: "sun",
    solarActivity: true,
    script: {
      frames: Math.round(SUN_ACTIVITY_CYCLE_SECONDS / ACTIVITY_FRAME_S),
      duration: SUN_ACTIVITY_CYCLE_SECONDS,
      keyframes: Array.from({ length: 20 }, (_, i) => i / 20),
    },
  },
  {
    id: "sun-activity-zoom",
    description: "Close-up of the Sun with solar activity on, zoomed in on the limb",
    tags: ["sequence", "effects"],
    bloom: false,
    lens: false,
    closeUp: "sun",
    solarActivity: true,
    script: {
      frames: 300,
      duration: 30,
      input: [{ kind: "wheel", at: 0.02, deltaY: -500 }],
      keyframes: [0.5, 0.99],
    },
  },
];

/**
 * Headless benchmark target: the Orrery's engine on its store, exactly as the page mounts it,
 * each bench frame one of its frames (`mountSceneEngine`).
 */
export const benchTarget: BenchTarget = {
  id: "orrery",
  scenes: SCENES,
  async mount(sceneId, surface) {
    const scene = SCENES.find((s) => s.id === sceneId);
    if (!scene) throw new Error(`Unknown orrery scene: ${sceneId}`);
    const store = useOrrery;
    /* The store outlives a mounted engine: leave an earlier scene's close-up and selection. */
    store.getState().leaveCloseUp(true);
    store.getState().select(null);
    store.getState().resetView();
    store.setState({
      view: DEFAULT_VIEW,
      quality: "standard",
      bloom: scene.bloom,
      lens: scene.lens,
      playing: false,
    });
    const instance = mountSceneEngine(surface, createOrreryEngine, () => store.setState({}));
    const preroll = (count: number) => {
      for (let index = 0; index < count; index += 1)
        instance.render({ index, count, progress: 0, time: index / 60, dt: 1 / 60 });
    };
    if (scene.closeUp) {
      /* Select the body and fly in, frame by frame, so the timed frames show the landed close-up. */
      store
        .getState()
        .select(scene.closeUp === "sun" ? { kind: "sun" } : { kind: "planet", id: scene.closeUp });
      store.getState().enterCloseUp();
      preroll(CLOSE_UP_PREROLL);
    }
    if (scene.solarActivity) {
      /* The effect is an optional chunk, inlined in the bench bundle: its import resolves in a
         few turns. Let it attach, then show it, before the first timed frame. */
      if (!store.getState().solarActivity) store.getState().toggleSolarActivity();
      if (!store.getState().solarActivity)
        throw new Error("solar activity needs the Sun's close-up");
      for (let turn = 0; turn < 10; turn += 1) {
        await new Promise((resolve) => setTimeout(resolve, 10));
        preroll(1);
      }
    }
    return {
      ...instance,
      describe: () => {
        const { view, quality, antialias, bloom, lens, closeUp, solarActivity } = store.getState();
        return {
          view,
          quality,
          antialias: antialias ?? "default",
          bloom,
          lens,
          closeUp: closeUp !== null,
          solarActivity,
        };
      },
    };
  },
};

import { provideAudioMap } from "@/lib/audio-maps";
import { timedDrift } from "@/lib/drift";
import { mountSceneEngine } from "@/space/bench";
import { parseAudioMap } from "@horizon/toolkit/audio";
import type { BenchScene, BenchTarget } from "@horizon/toolkit/bench";

import driftingProbeMap from "../../../bench/fixtures/audio-maps/drifting-probe.json";
import { DRIFT } from "./lib/drift";
import { DEFAULT_VIEW, type ViewId } from "./lib/model/view-ids";
import { createDeepFieldEngine } from "./lib/scene/engine";
import { useDeepField } from "./lib/store";

type DeepFieldBenchScene = BenchScene & {
  bloom: boolean;
  lens: boolean;
  drift?: boolean;
  /** The view the scene opens on; the home view by default. */
  view?: ViewId;
};

/** The fixture map of the drift's track (`bench/fixtures/audio-maps`): the timing the bench replays. */
const DRIFT_MAP = parseAudioMap(driftingProbeMap);
/** One loop of the drift timed to its map; the engine steps at most a tenth of a second a frame. */
const DRIFT_LOOP = timedDrift(DRIFT, DRIFT_MAP).loop;

/**
 * The Galaxy (home view) at standard quality, as a visitor first sees it, and the same with bloom
 * on and with the lens on; the planets at their largest in Deep Field and the scattered view, with
 * their orbits; the cosmic map's scales, where its populations fade in and out; and the drift.
 */
const SCENES: readonly DeepFieldBenchScene[] = [
  {
    id: "home",
    description: "The Galaxy (home view), standard quality",
    tags: ["preset"],
    bloom: false,
    lens: false,
  },
  {
    id: "home-bloom",
    description: "The Galaxy (home view), standard quality, bloom on",
    tags: ["effects"],
    bloom: true,
    lens: false,
  },
  {
    id: "home-lens",
    description: "The Galaxy (home view), standard quality, lens on",
    tags: ["effects"],
    bloom: false,
    lens: true,
  },
  {
    id: "inner",
    description: "The inner planets, standard quality: the bodies at their largest in Deep Field",
    tags: ["solar", "view"],
    bloom: false,
    lens: false,
    view: "inner",
  },
  {
    id: "scattered",
    description: "The solar system's scattered view, standard quality: its orbits",
    tags: ["view"],
    bloom: false,
    lens: false,
    view: "scattered",
  },
  ...(["local-group", "virgo-supercluster", "cosmic-web", "observable-universe"] as const).map(
    (view): DeepFieldBenchScene => ({
      id: view,
      description: `The ${view.replace(/-/g, " ")} view, standard quality`,
      tags: ["cosmos"],
      bloom: false,
      lens: false,
      view,
    }),
  ),
  {
    id: "drift",
    description: "One loop of the drift, timed to its track's map, from the home view",
    tags: ["sequence", "camera", "drift"],
    bloom: false,
    lens: false,
    drift: true,
    script: {
      frames: Math.ceil(DRIFT_LOOP / 0.1),
      duration: DRIFT_LOOP,
      keyframes: Array.from({ length: 24 }, (_, i) => i / 23),
    },
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
    store.setState({
      view: scene.view ?? DEFAULT_VIEW,
      quality: "standard",
      bloom: scene.bloom,
      lens: scene.lens,
    });
    /* A drift scene plays the drift as the page would once its map has loaded and its loader lifted. */
    if (DRIFT.music?.track) provideAudioMap(DRIFT.music.track, scene.drift ? DRIFT_MAP : null);
    store.getState().stopDrift();
    if (scene.drift) {
      store.getState().startDrift();
      store.getState().readyDrift();
    }
    const instance = mountSceneEngine(surface, createDeepFieldEngine, () => store.setState({}));
    return {
      ...instance,
      describe: () => {
        const { view, quality, antialias, bloom, lens, drift } = store.getState();
        return { view, quality, antialias: antialias ?? "default", bloom, lens, drift };
      },
    };
  },
};

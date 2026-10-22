import { provideAudioMap } from "@/lib/audio-maps";
import { timedDrift } from "@/lib/drift";
import { mountSceneEngine } from "@/space/bench";
import { prominenceDensity } from "@/space/sun/graphics/prominence/volume";
import { parseAudioMap } from "@horizon/toolkit/audio";
import type { BenchScene, BenchTarget } from "@horizon/toolkit/bench";
import type { RenderQuality } from "@horizon/toolkit/rendering";

import lowDroneRisesMap from "../../../bench/fixtures/audio-maps/low-drone-rises.json";
import { DRIFT } from "./lib/drift";
import type { ClockRate } from "./lib/model/clock";
import type { LightId } from "./lib/model/lights";
import type { ViewId } from "./lib/model/views";
import { createSunScene } from "./lib/scene/bridge";
import { useSun } from "./lib/store";

type SunBenchScene = BenchScene & {
  view: ViewId;
  light: LightId;
  quality?: RenderQuality;
  /** Model seconds lived before the first frame. */
  at?: number;
  /** The eruption scrubbed to this point (a sequence scrubs it from its progress). */
  eruption?: number;
  cut?: number;
  /** The drift plays, as the page would once its map has loaded and its loader lifted. */
  drift?: boolean;
  /** The clock the scene runs at; the view's own by default. */
  clock?: ClockRate;
  /** Bloom on; off by default, as in the lab. */
  bloom?: boolean;
};

/** The fixture map of the drift's track (`bench/fixtures/audio-maps`): the timing the bench replays. */
const DRIFT_MAP = parseAudioMap(lowDroneRisesMap);
/** One loop of the drift timed to its map. */
const DRIFT_LOOP = timedDrift(DRIFT, DRIFT_MAP).loop;

/** The engine's frames step a tenth of a second at most. */
const FRAME_S = 0.1;
/** The Sun every scene shows: one seed, lived a month before the first frame so spots and a prominence stand. */
const SEED = 7;
const START_S = 30 * 86_400;

const still = (
  view: ViewId,
  light: LightId,
  description: string,
  patch: Partial<SunBenchScene> = {},
): SunBenchScene => ({
  id: `${view}-${light}`,
  description,
  tags: ["view"],
  view,
  light,
  ...patch,
});

const SCENES: readonly SunBenchScene[] = [
  still("surface", "white", "The whole disc in white light: limb darkening, spot groups, faculae"),
  {
    ...still("surface", "white", "The whole disc in white light with bloom on", {
      bloom: true,
    }),
    id: "surface-bloom",
    tags: ["view", "effects"],
  },
  {
    ...still("sunspot", "white", "The spot group with bloom on: the bright granules glow", {
      bloom: true,
    }),
    id: "sunspot-bloom",
    tags: ["view", "effects"],
  },
  still("inside", "white", "The cut open: core, radiative zone, tachocline, convection zone", {
    cut: 1,
  }),
  still(
    "sunspot",
    "white",
    "A spot group from just above it: umbra, penumbral filaments, granules",
  ),
  still("chromosphere", "halpha", "The limb in Hα: the chromosphere's rim, spicules, a prominence"),
  still("corona", "eclipse", "The disc occulted: streamers, plumes, the F and E coronae"),
  still(
    "eruption",
    "fe171",
    "An active region in 171 Å mid-eruption: the rope, the X-point, loops",
    {
      eruption: 0.55,
    },
  ),
  still(
    "cycle",
    "magnetogram",
    "The magnetogram with the pole tipped: the regions' bipoles and the dipole",
  ),
  {
    ...still(
      "surface",
      "fe171",
      "The whole disc in 171 Å mid-eruption: the arcade's loops from afar",
    ),
    id: "surface-fe171",
    eruption: 0.55,
  },
  {
    ...still("corona", "eclipse", "The eclipse with the ejection's shell out at four radii"),
    id: "corona-cme",
    eruption: 0.8,
  },
  {
    ...still(
      "surface",
      "white",
      "A model day on the disc at the day-a-second clock: a spot keeps its place in the granulation",
    ),
    id: "surface-day",
    tags: ["sequence", "rotation"],
    clock: "day",
    script: { frames: 10, duration: 1, keyframes: Array.from({ length: 9 }, (_, i) => i / 8) },
  },
  {
    ...still("surface", "white", "The whole disc at economy quality"),
    id: "surface-economy",
    tags: ["quality"],
    quality: "economy",
  },
  {
    ...still("surface", "white", "The whole disc at max quality"),
    id: "surface-max",
    tags: ["quality"],
    quality: "max",
  },
  {
    ...still("eruption", "fe171", "The eruption from sheared loops to the ejection, in 171 Å"),
    id: "eruption-sequence",
    tags: ["sequence"],
    eruption: 0,
    script: { frames: 160, duration: 160, keyframes: Array.from({ length: 9 }, (_, i) => i / 8) },
  },
  {
    ...still("chromosphere", "halpha", "One loop of the drift, timed to its track's map"),
    id: "drift",
    tags: ["sequence", "camera", "drift"],
    drift: true,
    script: {
      frames: Math.ceil(DRIFT_LOOP / FRAME_S),
      duration: DRIFT_LOOP,
      keyframes: Array.from({ length: 24 }, (_, i) => i / 23),
    },
  },
];

/**
 * Headless benchmark target: the Sun's scene on its store, as the page mounts it, each bench
 * frame one of its frames (`mountSceneEngine`). The eruption's places and the eruption view
 * run the model's eruption at the store's moment; a sequence scrubs it by its progress.
 */
export const benchTarget: BenchTarget = {
  id: "sun",
  scenes: SCENES,
  async mount(sceneId, surface) {
    const scene = SCENES.find((s) => s.id === sceneId);
    if (!scene) throw new Error(`Unknown sun scene: ${sceneId}`);
    /* The prominence volume is baked before the first frame, so every still shows it. */
    await Promise.all([prominenceDensity(false), prominenceDensity(true)]);
    const store = useSun;
    /* The store outlives a mounted engine: leave an earlier scene's guide, card and drift. */
    store.getState().endGuide();
    store.getState().stopDrift();
    store.getState().select(null);
    store.getState().resetView();
    store.getState().setView(scene.view);
    store.setState({
      light: scene.light,
      ...(scene.clock ? { clock: scene.clock } : {}),
      quality: scene.quality ?? "standard",
      cut: scene.cut ?? (scene.view === "inside" ? 1 : 0),
      eruption: scene.eruption ?? 0,
      eruptionPlaying: false,
      bloom: scene.bloom ?? false,
      paused: false,
    });
    if (DRIFT.music?.track) provideAudioMap(DRIFT.music.track, scene.drift ? DRIFT_MAP : null);
    if (scene.drift) {
      store.getState().startDrift();
      store.getState().readyDrift();
    }
    const instance = mountSceneEngine(
      surface,
      (mount) => createSunScene(mount, { seed: SEED, start: START_S }),
      () => store.setState({}),
    );
    /* The engine steps at most a tenth of a second a frame: live up to the scene's moment. */
    const lived = Math.round((scene.at ?? 0) / FRAME_S);
    for (let index = 0; index < lived; index++)
      instance.render({ index, count: lived, progress: 0, time: index * FRAME_S, dt: FRAME_S });
    return {
      ...instance,
      render: (frame) => {
        const dt = frame.dt > 0 ? frame.dt : FRAME_S;
        if (scene.script && !scene.drift)
          store.setState({ eruption: frame.progress, eruptionPlaying: false });
        instance.render({ ...frame, dt });
      },
      describe: () => {
        const { view, light, quality, cut, eruption, elapsed, drift } = store.getState();
        return { view, light, quality, cut, eruption, elapsed, drift };
      },
    };
  },
};

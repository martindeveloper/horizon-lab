import type { Texture } from "three";

import { mountSceneEngine } from "@/space/bench";
import { MAP_BASE } from "@/space/solar-system/graphics/maps";
import type { BenchScene, BenchTarget } from "@horizon/toolkit/bench";
import { tierFile, type BodyId } from "@horizon/toolkit/bodies";
import { loadMap } from "@horizon/toolkit/scene";

import { DRIFT_PACE } from "./lib/drift";
import { dryEarthFile } from "./lib/graphics/dry-earth";
import { CHAPTER_IDS, type ChapterId } from "./lib/model/chapter-ids";
import { chapterById, chapterOf, chapterStart, sliderToAge } from "./lib/model/chapters";
import { LIFE_SECONDS } from "./lib/model/pacing";
import { DRIFT_FLIGHT_S, FLIGHT_S } from "./lib/model/parameters";
import { TOUR } from "./lib/model/tour";
import { AGB_END, HELIUM_START, MS_END, NEBULA_END, RGB_TIP, TODAY } from "./lib/model/track";
import { VANTAGE } from "./lib/model/vantage";
import { WORLDS, type WorldId } from "./lib/model/worlds";
import { createAfterglowEngine, type AfterglowTrace } from "./lib/scene/engine";
import { useAfterglow } from "./lib/store";

type AfterglowBenchScene = BenchScene & {
  /** The moment shown, years since the first solids, and the world stood on. */
  age: number;
  world: WorldId;
  /** The chapter the address opens at. */
  view: ChapterId;
  bloom: boolean;
  /** The clock runs: the whole life at the autoplay's pace. */
  playing?: boolean;
  /** Each frame reports what it showed (`AfterglowTrace`). */
  trace?: boolean;
  /** What the visitor does once the scene is up: a tap on a chapter's name. */
  tap?: ChapterId;
  /** The guide open at this step, standing at its age on its world: its framing glides in. */
  guide?: number;
  /** The drift plays (at its pace, with its camera), as when its music and map are ready. */
  drift?: boolean;
};

const GYR = 1e9;
const MYR = 1e6;

/**
 * One life at the pace of 1, its tempo included; the engine steps at most a tenth of a second
 * a frame, so the frames are the seconds times ten.
 */
const LIFE = {
  frames: Math.ceil(LIFE_SECONDS * 10),
  duration: LIFE_SECONDS,
  keyframes: [0.02, 0.17, 0.3, 0.45, 0.55, 0.65, 0.75, 0.85, 0.95],
};

/** The first flight, Earth to Mars as the red giant's chapter begins: from a moment before it to its end. */
const FLIGHT_FROM = sliderToAge(chapterStart(chapterById("tip")) - 0.002);
const FLIGHT_SCRIPT = {
  frames: (FLIGHT_S + 2) * 30,
  duration: FLIGHT_S + 2,
  keyframes: Array.from({ length: 12 }, (_, k) => k / 11),
};

/** The handover from the pulses to the nebula, played: from a little before the chapter's edge to well past it. */
const HANDOVER_FROM = sliderToAge(chapterStart(chapterById("nebula")) - 0.003);
const HANDOVER = {
  frames: 160,
  duration: 16,
  keyframes: Array.from({ length: 16 }, (_, k) => k / 15),
};

/**
 * The whole life traced: the autoplay from the young Sun to the dwarf at thirty frames a second
 * (the flights' hush adds a little to the life's seconds), each frame's trace in the report.
 */
const TRACE_FPS = 30;
/** The schedule's moves to another world, each a flight of its own seconds. */
const FLIGHTS = CHAPTER_IDS.filter(
  (id, i) => i > 0 && VANTAGE[id] !== VANTAGE[CHAPTER_IDS[i - 1]!],
).length;
const TRACE_S = Math.ceil(LIFE_SECONDS * 1.15 + FLIGHTS * FLIGHT_S);
const TRACE = {
  frames: TRACE_S * TRACE_FPS,
  duration: TRACE_S,
  keyframes: [0.1, 0.3, 0.5, 0.7, 0.9],
};

/** A guide step's framing gliding in from the resting view, and held. */
const GUIDE_SHOT = { frames: 150, duration: 5, keyframes: [0, 0.2, 0.4, 0.6, 1] };
/** The drift's first flight, Earth to Mars, at its pace and its slower flight. */
const DRIFT_FLIGHT = {
  frames: (DRIFT_FLIGHT_S + 4) * 30,
  duration: DRIFT_FLIGHT_S + 4,
  keyframes: Array.from({ length: 12 }, (_, k) => k / 11),
};

/** A tap on a chapter's name, traced until the move it starts has landed. */
const TAP = {
  frames: (FLIGHT_S + 3) * 30,
  duration: FLIGHT_S + 3,
  keyframes: [0, 0.25, 0.5, 0.75, 1],
};

const SCENES: readonly AfterglowBenchScene[] = [
  ...(["today", "oceans", "swallow", "nebula"] as const).map((id) => {
    const guide = TOUR.findIndex((step) => step.id === id);
    const step = TOUR[guide]!;
    return {
      id: `guide-${id}`,
      description: `The guide's step "${id}" framed: its shot gliding in from the resting view`,
      tags: ["sequence", "guide"],
      age: step.age,
      world: step.world,
      view: chapterOf(step.age).id,
      bloom: true,
      guide,
      script: GUIDE_SHOT,
    };
  }),
  ...(
    [
      ["tap-tip-from-swell", "subgiant", 0.5, false],
      ["tap-tip-from-today", "today", 0.5, false],
      ["tap-tip-from-swell-playing", "subgiant", 0.9, true],
    ] as const
  ).map(([id, from, at, playing]) => ({
    id,
    description: `A tap on the red giant's name from ${from}${playing ? " while the clock runs" : ""}, traced`,
    tags: ["sequence", "trace", "tap"],
    age: sliderToAge(
      chapterStart(chapterById(from)) +
        at *
          (chapterStart(chapterById("tip")) - chapterStart(chapterById(from))) *
          (from === "subgiant" ? 1 : 0.2),
    ),
    world: "earth" as const,
    view: from,
    bloom: true,
    playing,
    trace: true,
    tap: "tip" as const,
    script: TAP,
  })),
  {
    id: "young-earth",
    description: "The faint young Sun over Earth's limb from low orbit, standard quality",
    tags: ["preset"],
    age: 0.1 * GYR,
    world: "earth",
    view: "young",
    bloom: true,
  },
  {
    id: "today-earth",
    description: "Today's Sun over Earth's limb, bloom on",
    tags: ["preset"],
    age: TODAY,
    world: "earth",
    view: "today",
    bloom: true,
  },
  {
    id: "oceans-earth",
    description: "The brighter Sun as the habitable zone passes Earth",
    tags: ["preset"],
    age: TODAY + 1.2 * GYR,
    world: "earth",
    view: "oceans",
    bloom: true,
  },
  {
    id: "dry-earth",
    description: "Earth after its oceans, the modelled dry map, as the main sequence ends",
    tags: ["preset"],
    age: MS_END - 1 * GYR,
    world: "earth",
    view: "oceans",
    bloom: true,
  },
  {
    id: "drying-earth",
    description: "Earth halfway through losing its oceans",
    tags: ["preset"],
    age: TODAY + 2.5 * GYR,
    world: "earth",
    view: "oceans",
    bloom: true,
  },
  {
    id: "tip-mars",
    description: "The red giant at its tip over Mars's limb, its granulation a few huge cells",
    tags: ["preset"],
    age: RGB_TIP - 0.3 * MYR,
    world: "mars",
    view: "tip",
    bloom: true,
  },
  {
    id: "flash-europa",
    description: "The helium-burning Sun over Europa, Earth's sunlight at Jupiter",
    tags: ["preset"],
    age: HELIUM_START + 30 * MYR,
    world: "europa",
    view: "flash",
    bloom: true,
  },
  {
    id: "pulses-enceladus",
    description: "The pulsing Sun over Enceladus as the envelope goes",
    tags: ["preset"],
    age: AGB_END - 0.2 * MYR,
    world: "enceladus",
    view: "pulses",
    bloom: true,
  },
  {
    id: "nebula-pluto",
    description: "The bare core at the nebula's start, over Pluto",
    tags: ["preset"],
    age: AGB_END + 5_000,
    world: "pluto",
    view: "nebula",
    bloom: true,
  },
  {
    id: "dwarf-pluto",
    description: "The white dwarf two billion years into its fade, over Pluto's dark limb",
    tags: ["preset"],
    age: NEBULA_END + 2 * GYR,
    world: "pluto",
    view: "dwarf",
    bloom: true,
  },
  {
    id: "flight-mars",
    description: "The flight from Earth to Mars as the giant's chapter begins, played",
    tags: ["sequence"],
    age: FLIGHT_FROM,
    world: "earth",
    view: "subgiant",
    bloom: true,
    playing: true,
    script: FLIGHT_SCRIPT,
  },
  {
    id: "drift-flight-mars",
    description: "The drift's flight from Earth to Mars as the giant's chapter begins, played",
    tags: ["sequence", "drift"],
    age: FLIGHT_FROM,
    world: "earth",
    view: "subgiant",
    bloom: true,
    playing: true,
    drift: true,
    script: DRIFT_FLIGHT,
  },
  {
    id: "nebula-handover",
    description: "The last pulse over Enceladus giving way to the bare core over Pluto, played",
    tags: ["sequence"],
    age: HANDOVER_FROM,
    world: "enceladus",
    view: "pulses",
    bloom: true,
    playing: true,
    script: HANDOVER,
  },
  {
    id: "life-trace",
    description: "The whole life autoplayed at thirty frames a second, every frame traced",
    tags: ["sequence", "trace"],
    age: 0,
    world: "earth",
    view: "young",
    bloom: true,
    playing: true,
    trace: true,
    script: TRACE,
  },
  {
    id: "life",
    description: "The whole life played at the chapter pace, the vantage moving outward",
    tags: ["sequence"],
    age: 0,
    world: "earth",
    view: "young",
    bloom: true,
    playing: true,
    script: LIFE,
  },
];

/** The worlds a scene draws: its own, or every one on the autoplay's schedule as the life plays. */
const worldsOf = (scene: AfterglowBenchScene): readonly WorldId[] =>
  scene.playing ? [...new Set(Object.values(VANTAGE))] : [scene.world];

/** The measured maps the scene's globes need, decoded before the first frame, as Voyage fetches a probe's model. */
async function measuredMaps(worlds: readonly WorldId[]) {
  const measured = new Map<BodyId, Texture>();
  for (const world of worlds) {
    const id = WORLDS[world].body.id;
    const near = tierFile(MAP_BASE, id, "near");
    if (near) measured.set(id, await loadMap(near, new AbortController().signal));
  }
  return measured;
}

/**
 * Headless benchmark target: Afterglow's engine on its store, exactly as the page mounts it,
 * each bench frame one of its frames (`mountSceneEngine`).
 */
export const benchTarget: BenchTarget = {
  id: "afterglow",
  scenes: SCENES,
  async mount(sceneId, surface) {
    const scene = SCENES.find((s) => s.id === sceneId);
    if (!scene) throw new Error(`Unknown afterglow scene: ${sceneId}`);
    const store = useAfterglow;
    store.setState(store.getInitialState(), true);
    store.setState({
      view: scene.view,
      age: scene.age,
      aim: null,
      chosen: scene.world,
      world: scene.world,
      /* A visit follows the schedule until a world is chosen; a still holds its own world. */
      auto: scene.playing === true || scene.tap !== undefined,
      playing: scene.playing ?? false,
      ...(scene.drift ? { drift: "playing" as const, pace: DRIFT_PACE } : {}),
      quality: "standard",
      bloom: scene.bloom,
      lens: scene.bloom,
    });
    const measured = await measuredMaps(worldsOf(scene));
    const dryEarth = worldsOf(scene).includes("earth")
      ? await loadMap(dryEarthFile(MAP_BASE, "near"), new AbortController().signal)
      : undefined;
    const trace: AfterglowTrace | undefined = scene.trace ? {} : undefined;
    const instance = mountSceneEngine(
      surface,
      (mount) =>
        createAfterglowEngine(mount, {
          measured,
          ...(dryEarth ? { dryEarth } : {}),
          ...(trace ? { trace } : {}),
        }),
      () => store.setState({}),
    );
    if (scene.tap) store.getState().setView(scene.tap);
    if (scene.guide !== undefined) {
      store.getState().startGuide();
      store.getState().goGuide(scene.guide);
    }
    return {
      ...instance,
      describe: () => {
        const { view, age, world, quality, antialias, bloom, lens, tempo, playing } =
          store.getState();
        return {
          view,
          age,
          world,
          chapter: view,
          quality,
          antialias: antialias ?? "default",
          bloom,
          lens,
          ...(trace ? { tempo, playing, ...trace } : {}),
        };
      },
    };
  },
};

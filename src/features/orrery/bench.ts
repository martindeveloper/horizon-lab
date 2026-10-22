import { provideAudioMap } from "@/lib/audio-maps";
import { timedDrift } from "@/lib/drift";
import { mountSceneEngine } from "@/space/bench";
import {
  OBSERVATORY_IDS,
  observatoryById,
  type ObservatoryId,
} from "@/space/solar-system/model/observatories";
import { CLEAR_DONE, MODEL_START } from "@/space/solar-system/model/parameters";
import type { SolarSelection } from "@/space/solar-system/model/selection";
import type { SolarViewId } from "@/space/solar-system/model/views";
import { fetchSpacecraft } from "@/space/spacecraft/graphics/loader";
import { parseAudioMap } from "@horizon/toolkit/audio";
import type { BenchScene, BenchTarget } from "@horizon/toolkit/bench";
import { PLANET_IDS, type PlanetId } from "@horizon/toolkit/bodies";
import { includesId } from "@horizon/toolkit/records";

import interstellarDriftMap from "../../../bench/fixtures/audio-maps/interstellar-drift.json";
import { DRIFT } from "./lib/drift";
import { SUN_ACTIVITY_CYCLE_SECONDS } from "./lib/model/solar-activity";
import { DEFAULT_VIEW } from "./lib/model/views";
import { createOrreryEngine } from "./lib/scene/engine";
import { useOrrery, type Show } from "./lib/store";

type OrreryBenchScene = BenchScene & {
  /** The view the scene opens on; the home view by default. */
  view?: SolarViewId;
  /** The moment on the timeline; today by default. */
  yearsAgo?: number;
  /** Switches changed from the defaults. */
  show?: Partial<Show>;
  selection?: SolarSelection;
  bloom: boolean;
  lens: boolean;
  /** A close-up of this body or observatory, landed: the flight is run before the first frame. */
  closeUp?: PlanetId | "sun" | ObservatoryId;
  /** The Sun's close-up with its optional activity switched on and loaded. */
  solarActivity?: boolean;
  /** Faint ring systems in a long exposure. */
  faintRings?: boolean;
  drift?: boolean;
};

/** The fixture map of the drift's track (`bench/fixtures/audio-maps`): the timing the bench replays. */
const DRIFT_MAP = parseAudioMap(interstellarDriftMap);
/** The drift timed to its map: one loop is two plays of the track. */
const DRIFT_TIMED = timedDrift(DRIFT, DRIFT_MAP);
/** One loop of the drift; the engine steps at most a tenth of a second a frame. */
const DRIFT_LOOP = DRIFT_TIMED.loop;

/**
 * Seconds into the drift of its visit to Mars: from just before the dive to just past landing
 * on the shot it pulls away onto.
 */
const MARS_VISIT = (() => {
  const { shots, starts } = DRIFT_TIMED;
  const at = shots.findIndex(
    (shot) => "closeUp" in shot && shot.closeUp.kind === "planet" && shot.closeUp.id === "mars",
  );
  const onward = shots[at + 1];
  if (at < 0 || !onward || "closeUp" in onward) throw new Error("the drift pulls away from Mars");
  const lands = starts[at + 1]! + (onward.flight?.duration ?? DRIFT.camera.flight ?? 20);
  return { start: Math.floor(starts[at]! - 3), end: Math.ceil(lands + 4) };
})();
/** Seconds between the visit's keyframes. */
const MARS_EVERY = 2;

/** Frames the mount runs before a close-up scene's first one: the flight in, then its map painted. */
const CLOSE_UP_PREROLL = 600;

/** A close-up swung round from the landed three-quarter view to the night side, against the Sun. */
const NIGHT_SIDE: BenchScene["script"] = {
  frames: 300,
  duration: 30,
  input: [{ kind: "drag", from: [0.62, 0.5], to: [0.3, 0.5], start: 0.05, end: 0.6 }],
  keyframes: [0, 0.2, 0.35, 0.5, 0.6, 0.99],
};

/** The moment `u` of the way through the giant-planet clearing, in time (0 its start, 1 its end). */
const clearing = (u: number) => MODEL_START - u * (MODEL_START - CLEAR_DONE);

/** The activity's dynamics advance at most a tenth of a second per frame (`advance`). */
const ACTIVITY_FRAME_S = 0.1;

/**
 * The home view at standard quality, as a visitor first sees it, the same with bloom on and
 * with the lens on, a close-up of the Earth (its atmosphere shell over the globe), Neptune's
 * from the sunlit side and swung round against the Sun (its dusty rings), and the
 * Sun's close-up: as landed, with its activity on, and the activity's cycle as a sequence.
 * The other views show the orbit lines at each scale: the inner planets', Pluto's and Halley's
 * ellipses whole, Sedna's out to its aphelion.
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
  ...(["inner", "kuiper", "scattered", "oort"] as const).map((view): OrreryBenchScene => ({
    id: view,
    description: `The ${view} view, standard quality: the orbits at that scale`,
    tags: ["view"],
    bloom: false,
    lens: false,
    view,
  })),
  {
    id: "earth-close-up",
    description: "Close-up of the Earth, standard quality: the globe under its atmosphere shell",
    tags: ["close-up"],
    bloom: false,
    lens: false,
    closeUp: "earth",
  },
  {
    id: "hubble-close-up",
    description:
      "Close-up of Hubble, standard quality: true size, three-quarter lit, its arrays to the Sun, Earth below",
    tags: ["close-up"],
    bloom: false,
    lens: false,
    closeUp: "hubble",
  },
  {
    id: "webb-close-up",
    description:
      "Close-up of Webb, standard quality: true size, three-quarter lit, its sunshield to the Sun",
    tags: ["close-up"],
    bloom: false,
    lens: false,
    closeUp: "webb",
  },
  {
    id: "neptune-close-up",
    description:
      "Close-up of Neptune, standard quality: its faint dusty rings from the sunlit side",
    tags: ["close-up"],
    bloom: false,
    lens: false,
    closeUp: "neptune",
  },
  {
    id: "neptune-faint-rings",
    description:
      "Close-up of Neptune, standard quality, Faint rings on: the rings in a long exposure",
    tags: ["close-up", "effects"],
    bloom: false,
    lens: false,
    closeUp: "neptune",
    faintRings: true,
  },
  {
    id: "neptune-backlit",
    description: "Close-up of Neptune, swung round to its night side: the rings against the Sun",
    tags: ["sequence", "close-up"],
    bloom: false,
    lens: false,
    closeUp: "neptune",
    script: NIGHT_SIDE,
  },
  {
    id: "neptune-faint-rings-backlit",
    description:
      "Neptune swung round to its night side, Faint rings on: the dusty rings toward the Sun",
    tags: ["sequence", "close-up", "effects"],
    bloom: false,
    lens: false,
    closeUp: "neptune",
    faintRings: true,
    script: NIGHT_SIDE,
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
    id: "drift",
    description: "One loop of the drift, timed to its track's map (two plays), from the home view",
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
  {
    id: "drift-mars",
    description:
      "The drift into its visit to Mars: the dive, the hold and the pull away onto the giants",
    tags: ["sequence", "camera", "drift"],
    bloom: false,
    lens: false,
    drift: true,
    script: {
      frames: MARS_VISIT.end * 10,
      duration: MARS_VISIT.end,
      keyframes: Array.from(
        { length: Math.floor((MARS_VISIT.end - MARS_VISIT.start) / MARS_EVERY) + 1 },
        (_, i) => (MARS_VISIT.start + i * MARS_EVERY) / MARS_VISIT.end,
      ),
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
  /* The planetesimal sample through the clearing: its bins and switches held still (a still
     frame's image waits on however many frames its timing took), and its motion in sequences. */
  {
    id: "tracers-early",
    description:
      "The giants a quarter of the way through the clearing: the sample still in the disk",
    tags: ["tracers"],
    bloom: false,
    lens: false,
    yearsAgo: clearing(0.25),
    show: { drift: false },
  },
  {
    id: "tracers-clearing",
    description:
      "The Kuiper belt halfway through the clearing, Motion on: the sample along its orbits",
    tags: ["sequence", "tracers"],
    bloom: false,
    lens: false,
    view: "kuiper",
    yearsAgo: clearing(0.5),
    script: { frames: 300, duration: 30, keyframes: [0, 0.25, 0.5, 0.75, 1] },
  },
  {
    id: "tracers-filtered",
    description:
      "The Kuiper belt late in the clearing with the Kuiper and ejected bins switched off",
    tags: ["tracers"],
    bloom: false,
    lens: false,
    view: "kuiper",
    yearsAgo: clearing(0.65),
    show: { kuiper: false, ejected: false, drift: false },
  },
  {
    id: "tracers-scattered",
    description: "The scattered disk once the clearing ends, Motion on for a long run of drift",
    tags: ["sequence", "tracers"],
    bloom: false,
    lens: false,
    view: "scattered",
    yearsAgo: CLEAR_DONE,
    script: { frames: 600, duration: 60, keyframes: [0, 0.5, 1] },
  },
  {
    id: "tracers-far",
    description: "The Oort cloud today, Motion on: a million years and more of drift",
    tags: ["sequence", "tracers"],
    bloom: false,
    lens: false,
    view: "oort",
    script: { frames: 600, duration: 60, keyframes: [0, 0.5, 1] },
  },
  {
    id: "tracers-selected",
    description:
      "The Kuiper belt today, Motion on, one scattered planetesimal selected: the reticle on it",
    tags: ["sequence", "tracers"],
    bloom: false,
    lens: false,
    view: "kuiper",
    selection: { kind: "tracer", index: 8 },
    script: { frames: 100, duration: 10, keyframes: [0, 1] },
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
    /* A bench sequence draws its frames in one go: an observatory's model is fetched first. */
    const target = scene.closeUp;
    const craft = target && includesId(OBSERVATORY_IDS, target) ? target : null;
    if (craft) await fetchSpacecraft(observatoryById(craft).model);
    const store = useOrrery;
    /* The store outlives a mounted engine: leave an earlier scene's close-up and selection. */
    store.getState().leaveCloseUp(true);
    store.getState().select(null);
    store.getState().resetView();
    store.setState({
      view: scene.view ?? DEFAULT_VIEW,
      yearsAgo: scene.yearsAgo ?? 0,
      show: { ...store.getState().show, ...scene.show },
      selection: scene.selection ?? null,
      quality: "standard",
      bloom: scene.bloom,
      lens: scene.lens,
      playing: false,
    });
    store.getState().patchShow({ faintRings: scene.faintRings ?? false });
    /* A drift scene plays the drift as the page would once its map has loaded and its loader lifted. */
    if (DRIFT.music?.track) provideAudioMap(DRIFT.music.track, scene.drift ? DRIFT_MAP : null);
    store.getState().stopDrift();
    if (scene.drift) {
      store.getState().startDrift();
      store.getState().readyDrift();
    }
    const instance = mountSceneEngine(surface, createOrreryEngine, () => store.setState({}));
    const preroll = (count: number) => {
      for (let index = 0; index < count; index += 1)
        instance.render({ index, count, progress: 0, time: index / 60, dt: 1 / 60 });
    };
    if (target) {
      /* Select the body and fly in, frame by frame, so the timed frames show the landed close-up. */
      store
        .getState()
        .select(
          target === "sun"
            ? { kind: "sun" }
            : includesId(PLANET_IDS, target)
              ? { kind: "planet", id: target }
              : { kind: "observatory", id: target },
        );
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

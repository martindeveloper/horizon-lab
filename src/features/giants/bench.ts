import { provideAudioMap } from "@/lib/audio-maps";
import { timedDrift } from "@/lib/drift";
import { mountSceneEngine } from "@/space/bench";
import { parseAudioMap } from "@horizon/toolkit/audio";
import type { BenchScene, BenchTarget } from "@horizon/toolkit/bench";

import vastEmptySpaceMap from "../../../bench/fixtures/audio-maps/vast-empty-space.json";
import { DRIFT } from "./lib/drift";
import { createGiantsEngine } from "./lib/engine";
import { rungIndex, type RungId } from "./lib/model/rungs";
import { IDLE_FPS } from "./lib/parameters";
import { useGiants } from "./lib/store";

type GiantsBenchScene = BenchScene & {
  rung: RungId;
  bloom?: boolean;
  /** The planets' orbits round the body, as the guide shows them. */
  orbits?: boolean;
  /** The canvas in Display P3: the display step moves the radiance into its primaries. */
  wideColour?: boolean;
  /** Seconds the star has lived before the first frame: its weather is a function of time. */
  at?: number;
  /** The drift plays, as the page would once its map has loaded and its loader lifted. */
  drift?: boolean;
  /** Every body at once, on the overview's log scale. */
  overview?: boolean;
  /** The body the rung stands beside, side by side at true scale. */
  beside?: RungId;
  /**
   * What the visitor asks for once the first frame is drawn, so the sequence watches the
   * change: the overview, the rung side by side with a body, or back to the ladder.
   */
  asks?: { overview: true } | { beside: RungId } | { ladder: true };
};

/** Asks the store for what a sequence watches the stage change into. */
function ask(asks: NonNullable<GiantsBenchScene["asks"]>) {
  const state = useGiants.getState();
  if ("overview" in asks) return state.setOverview(true);
  if ("ladder" in asks)
    return state.overview ? state.setOverview(false) : state.setSideBySide(false);
  state.setOtherBody(asks.beside);
  state.setSideBySide(true);
}

/** The fixture map of the drift's track (`bench/fixtures/audio-maps`): the timing the bench replays. */
const DRIFT_MAP = parseAudioMap(vastEmptySpaceMap);
/** One loop of the drift timed to its map. */
const DRIFT_LOOP = timedDrift(DRIFT, DRIFT_MAP).loop;

/** Seconds a sequence watches a star live: long enough for its flares, eruptions and pulses. */
const WATCH_SECONDS = 90;
/**
 * The engine steps at most a tenth of a second a frame, as a display would at 10 fps. Camera
 * sequences step at its idle pace instead: faster, and a landed camera would skip frames.
 */
const WATCH_FRAME_S = 0.1;

const still = (rung: RungId, description: string): GiantsBenchScene => ({
  id: rung,
  description,
  tags: ["rung"],
  rung,
});

const watch = (rung: RungId, description: string): GiantsBenchScene => ({
  id: `${rung}-live`,
  description,
  tags: ["sequence", "activity"],
  rung,
  script: {
    frames: Math.round(WATCH_SECONDS / WATCH_FRAME_S),
    duration: WATCH_SECONDS,
    keyframes: Array.from({ length: 18 }, (_, i) => i / 17),
  },
});

/**
 * The ladder's kinds of surface, each landed on its own rung at standard quality, and the
 * active stars watched live: the Sun's activity, a flare star's, a red supergiant's and a hot
 * supergiant's pulsing.
 */
const SCENES: readonly GiantsBenchScene[] = [
  still("sun", "The Sun: spots, faculae, prominences and corona"),
  { ...still("sun", "The Sun with bloom on"), id: "sun-bloom", tags: ["effects"], bloom: true },
  {
    ...still("rigel", "Rigel with bloom on: a hot face"),
    id: "rigel-bloom",
    tags: ["effects"],
    bloom: true,
  },
  {
    ...still("sirius-b", "Sirius B with bloom on: a small, intense light"),
    id: "sirius-b-bloom",
    tags: ["effects"],
    bloom: true,
  },
  {
    ...still("ton-618", "TON 618 with bloom on: the quasar's blinding ring"),
    id: "ton-618-bloom",
    tags: ["effects"],
    bloom: true,
  },
  {
    ...still(
      "betelgeuse",
      "Betelgeuse with its orbits and bloom on: the lines stay crisp over the glow",
    ),
    id: "betelgeuse-orbits-bloom",
    tags: ["effects"],
    orbits: true,
    bloom: true,
  },
  {
    ...still("betelgeuse", "Betelgeuse with the planets' orbits, as the guide shows it"),
    id: "betelgeuse-orbits",
    orbits: true,
  },
  {
    ...still("betelgeuse", "Betelgeuse with wide colour on: its deep reds past sRGB"),
    id: "betelgeuse-wide",
    tags: ["effects"],
    wideColour: true,
  },
  still("proxima", "Proxima Centauri: a spotted flare star"),
  still("sirius", "Sirius: a smooth hot star"),
  still("achernar", "Achernar: a flattened fast rotator, hot poles"),
  still("arcturus", "Arcturus: a red giant"),
  still("rigel", "Rigel: a blue supergiant"),
  still("betelgeuse", "Betelgeuse: a red supergiant's few giant cells"),
  still("sirius-b", "Sirius B: a white dwarf"),
  still("neutron-star", "A pulsar"),
  still("brown-dwarf", "A brown dwarf's cloud bands"),
  still("cygnus-x1", "Cygnus X-1: a stellar black hole's horizon and photon ring"),
  still("sgr-a", "Sagittarius A*: a faint, flickering ring"),
  still("m87", "M87*: its ring, brightest in the south"),
  still("ton-618", "TON 618: a quasar's blinding ring"),
  {
    ...still("sun", "The overview: every body as a flat dot on one log scale of radius"),
    id: "overview",
    tags: ["overview"],
    overview: true,
  },
  {
    ...still(
      "betelgeuse",
      "Betelgeuse beside Earth at true scale: Earth a ringed point at its limb",
    ),
    id: "betelgeuse-beside-earth",
    tags: ["side-by-side"],
    beside: "earth",
  },
  {
    ...still(
      "sun",
      "The Sun beside Betelgeuse at true scale: the pair's own zoom, the larger framed",
    ),
    id: "sun-beside-betelgeuse",
    tags: ["side-by-side"],
    beside: "betelgeuse",
  },
  {
    id: "into-overview",
    description:
      "From the Sun into the overview: the surfaces hand over to dots, which glide to their rows",
    tags: ["sequence", "camera", "overview"],
    rung: "sun",
    asks: { overview: true },
    script: {
      frames: Math.round(2 * IDLE_FPS),
      duration: 2,
      keyframes: Array.from({ length: 12 }, (_, i) => i / 11),
    },
  },
  {
    id: "vega-into-overview",
    description:
      "From Vega into the overview: Sagittarius A*'s ring fades where it is, and the holes far off the stage stay off it",
    tags: ["sequence", "camera", "overview"],
    rung: "vega",
    asks: { overview: true },
    script: {
      frames: Math.round(2 * IDLE_FPS),
      duration: 2,
      keyframes: Array.from({ length: 12 }, (_, i) => i / 11),
    },
  },
  {
    id: "vega-back-from-overview",
    description:
      "From the overview back down to Vega: the surfaces return before Sagittarius A*'s ring, in place",
    tags: ["sequence", "camera", "overview"],
    rung: "vega",
    overview: true,
    asks: { ladder: true },
    script: {
      frames: Math.round(2 * IDLE_FPS),
      duration: 2,
      keyframes: Array.from({ length: 12 }, (_, i) => i / 11),
    },
  },
  {
    id: "stephenson-beside-earth",
    description:
      "From Stephenson 2-18 into side by side with Earth: M87*'s ring and the neighbours slide off past their light, Earth slides on",
    tags: ["sequence", "camera", "side-by-side"],
    rung: "stephenson-2-18",
    asks: { beside: "earth" },
    script: {
      frames: Math.round(3 * IDLE_FPS),
      duration: 3,
      keyframes: Array.from({ length: 31 }, (_, i) => i / 30),
    },
  },
  {
    id: "stephenson-back-from-earth",
    description:
      "From Stephenson 2-18 beside Earth back to the ladder: the neighbours and M87*'s lensing come back",
    tags: ["sequence", "camera", "side-by-side"],
    rung: "stephenson-2-18",
    beside: "earth",
    asks: { ladder: true },
    script: {
      frames: Math.round(3 * IDLE_FPS),
      duration: 3,
      keyframes: Array.from({ length: 31 }, (_, i) => i / 30),
    },
  },
  watch("sun", "The Sun live: flares, prominences and an eruption"),
  watch("proxima", "Proxima Centauri live: its flares"),
  watch("betelgeuse", "Betelgeuse live: its boiling cells and plumes"),
  watch("rigel", "Rigel live: its pulsing"),
  {
    id: "descend",
    description:
      "A wheel step down the ladder, from Betelgeuse to Antares: the glide's ease in and out",
    tags: ["sequence", "camera"],
    rung: "betelgeuse",
    script: {
      frames: Math.round(2.4 * IDLE_FPS),
      duration: 2.4,
      input: [{ kind: "wheel", at: 0.02, deltaY: -320 }],
      keyframes: Array.from({ length: 12 }, (_, i) => i / 11),
    },
  },
  {
    id: "rise-to-achernar",
    description: "A wheel step up from Vega to Achernar: Sagittarius A*'s ring and lensing ease in",
    tags: ["sequence", "camera"],
    rung: "vega",
    script: {
      frames: Math.round(2.4 * IDLE_FPS),
      duration: 2.4,
      input: [{ kind: "wheel", at: 0.02, deltaY: 320 }],
      keyframes: Array.from({ length: 12 }, (_, i) => i / 11),
    },
  },
  {
    id: "land-on-proxima",
    description:
      "A wheel step down from the Sun to Proxima: the Sun's weather fades, Proxima's wakes",
    tags: ["sequence", "camera", "activity"],
    rung: "sun",
    at: 20,
    script: {
      frames: Math.round(4 * IDLE_FPS),
      duration: 4,
      input: [{ kind: "wheel", at: 0.02, deltaY: -320 }],
      keyframes: Array.from({ length: 12 }, (_, i) => i / 11),
    },
  },
  {
    id: "sun-eruption",
    description: "The Sun's first big flare at the limb, its loops and its ejection",
    tags: ["sequence", "activity"],
    rung: "sun",
    at: 53,
    script: { frames: 160, duration: 16, keyframes: Array.from({ length: 9 }, (_, i) => i / 8) },
  },
  {
    id: "drift",
    description:
      "One loop of the drift, timed to its track's map: the climb from a pulsar to TON 618",
    tags: ["sequence", "camera", "drift"],
    rung: "sun",
    drift: true,
    script: {
      frames: Math.ceil(DRIFT_LOOP / WATCH_FRAME_S),
      duration: DRIFT_LOOP,
      keyframes: Array.from({ length: 24 }, (_, i) => i / 23),
    },
  },
];

/**
 * Headless benchmark target: Giants' engine on its store, landed on a rung as the page mounts it,
 * each bench frame one of its frames (`mountSceneEngine`).
 */
export const benchTarget: BenchTarget = {
  id: "giants",
  scenes: SCENES,
  mount(sceneId, surface) {
    const scene = SCENES.find((s) => s.id === sceneId);
    if (!scene) throw new Error(`Unknown giants scene: ${sceneId}`);
    const store = useGiants;
    /* The store outlives a mounted engine: leave an earlier scene's guide and card. */
    store.getState().endGuide();
    store.getState().setCard(false);
    store.getState().resetView();
    store.setState({
      goal: rungIndex(scene.rung),
      quality: "standard",
      bloom: scene.bloom ?? false,
      wideColour: scene.wideColour ?? false,
      orbits: scene.orbits ?? false,
      overview: scene.overview ?? false,
      sideBySide: scene.beside !== undefined,
      ...(scene.beside ? { reference: "other" as const, otherBody: scene.beside } : {}),
    });
    if (DRIFT.music?.track) provideAudioMap(DRIFT.music.track, scene.drift ? DRIFT_MAP : null);
    store.getState().stopDrift();
    if (scene.drift) {
      store.getState().startDrift();
      store.getState().readyDrift();
    }
    const instance = mountSceneEngine(
      surface,
      ({ canvas, host, labelRoot, onError }) =>
        createGiantsEngine(canvas, host, labelRoot, onError),
      () => store.setState({}),
    );
    /* The engine steps at most a tenth of a second a frame: live up to the scene's moment. */
    const lived = Math.round((scene.at ?? 0) / WATCH_FRAME_S);
    for (let index = 0; index < lived; index++)
      instance.render({
        index,
        count: lived,
        progress: 0,
        time: index * WATCH_FRAME_S,
        dt: WATCH_FRAME_S,
      });
    return {
      ...instance,
      /* A landed camera draws at the idle pace: each still frame is one of those, so none is skipped. */
      render: (frame) => {
        if (scene.asks && frame.index === 1) ask(scene.asks);
        instance.render(frame.dt > 0 ? frame : { ...frame, dt: 1 / IDLE_FPS });
      },
      describe: () => {
        const { goal, place, quality, bloom, wideColour, drift, overview } = store.getState();
        return { rung: scene.rung, goal, place, quality, bloom, wideColour, drift, overview };
      },
    };
  },
};

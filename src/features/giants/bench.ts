import { mountSceneEngine } from "@/space/bench";
import type { BenchScene, BenchTarget } from "@horizon/toolkit/bench";

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
};

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
    });
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
      render: (frame) => instance.render(frame.dt > 0 ? frame : { ...frame, dt: 1 / IDLE_FPS }),
      describe: () => {
        const { goal, place, quality, bloom, wideColour } = store.getState();
        return { rung: scene.rung, goal, place, quality, bloom, wideColour };
      },
    };
  },
};

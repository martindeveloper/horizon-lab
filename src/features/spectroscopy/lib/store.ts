import { create } from "zustand";

import {
  guideSlice,
  LAB_RENDER,
  renderSlice,
  type GuideSlice,
  type RenderFields,
  type RenderSlice,
} from "@/lib/scene-store";
import { prefersReducedMotion } from "@horizon/toolkit/environment";
import { clamp } from "@horizon/toolkit/math";

import { viewFromPath } from "../routing";
import { ELEMENT_IDS, lineById, type ElementId } from "./model/atoms";
import { poseOf, type GuidePose } from "./model/guide-motion";
import {
  BENCH_DEFAULT,
  BENCH_RANGE,
  DEFAULT_RESOLUTION,
  FULL_RANGE,
  RESOLUTION_RANGE,
  SEQUENCE_DEFAULT,
  defaultVelocity,
  drawDeck,
  grade,
  mysteryAnswer,
  mysteryVelocity,
  type Bench,
  type Mystery,
  type MysteryResult,
  type Settings,
  type StarChoice,
} from "./model/scenes";
import { TOUR } from "./model/tour";
import { DEFAULT_VIEW, type ViewId } from "./model/view-ids";
import type { CanvasAntialias } from "./quality";

type Panel = "none" | "elements" | "view";

/** What the guide puts back when it ends: the visitor's own settings. */
type Saved = Pick<Settings, "view" | "star" | "velocity" | "air" | "bench" | "mystery"> & {
  result: MysteryResult | null;
  compare: readonly ElementId[];
  letters: boolean;
  range: readonly [number, number];
};

/** A case's answer so far: the elements marked and the shift given the markers. */
type Draft = { marked: readonly ElementId[]; velocity: number };

/**
 * The render settings a visit starts with, and their setters (`renderSlice`): how sharply the
 * canvases are drawn (`canvasScale`), anti-aliasing, and spectral colours in Display P3 where
 * the screen shows it (`drawingGamut`).
 */
const RENDER_DEFAULTS: Pick<
  RenderFields<CanvasAntialias>,
  "quality" | "antialias" | "wideColour"
> = {
  quality: LAB_RENDER.quality,
  antialias: "off",
  wideColour: LAB_RENDER.wideColour,
};

/** The narrowest window the spectrum zooms to, nm. */
export const MIN_SPAN = 0.4;

type SpectroscopyStore = Settings &
  GuideSlice<Saved> &
  RenderSlice<typeof RENDER_DEFAULTS> & {
    /** The first spectrum is drawn. */
    ready: boolean;
    panel: Panel;
    /** The selected line's id. */
    selection: string | null;
    /** The wavelength window, nm. */
    range: readonly [number, number];
    /** Flux divided by the continuum, as astronomers plot it. */
    normalized: boolean;
    /** Fraunhofer's letters over the lines he named. */
    letters: boolean;
    /** Elements whose laboratory wavelengths are marked under the spectrum. */
    compare: readonly ElementId[];
    /** The mystery cases, in the order they are offered. */
    deck: readonly Mystery[];
    /** Which case is open. */
    caseIndex: number;
    /** Each case's answer so far, kept while the visitor tries another. */
    drafts: readonly (Draft | undefined)[];
    /** Each checked case's result. */
    results: readonly (MysteryResult | undefined)[];
    /** The open mystery's result, once checked: its answer is shown. */
    result: MysteryResult | null;
    /** The scene's schematic photons fly (never under reduced motion). */
    photons: boolean;
    /** A soft blurred layer under the scene's lights and a halo on the ribbon's strong emission lines; off by default. */
    glow: boolean;
    setReady: () => void;
    setView: (view: ViewId) => void;
    setStar: (star: StarChoice) => void;
    setSequenceTemperature: (kelvin: number) => void;
    setVelocity: (kmPerS: number) => void;
    setAir: (air: boolean) => void;
    setResolution: (resolution: number) => void;
    patchBench: (patch: Partial<Bench>) => void;
    toggleGas: (element: ElementId) => void;
    /** Opens a case of the deck. */
    setCase: (index: number) => void;
    /** Scores the open mystery as the visitor sees it (their resolving power and air). */
    check: () => void;
    /** Moves the markers onto the answer: the right elements at the right velocity. */
    showAnswer: () => void;
    /** Deals a new deck. */
    shuffleCases: () => void;
    toggleCompare: (element: ElementId) => void;
    /** The marked element whose strongest line a mystery's velocity is measured on. */
    measure: ElementId | null;
    setMeasure: (element: ElementId) => void;
    /** An element whose lab lines are shown while the pointer or focus rests on its tile. */
    preview: ElementId | null;
    setPreview: (element: ElementId | null) => void;
    setRange: (range: readonly [number, number]) => void;
    /** Zooms by `factor` (below 1 zooms in) about a wavelength. */
    zoom: (factor: number, about?: number) => void;
    /** Slides the window by a fraction of its width. */
    pan: (fraction: number) => void;
    select: (id: string | null) => void;
    setPanel: (panel: Panel) => void;
    setNormalized: (normalized: boolean) => void;
    setLetters: (letters: boolean) => void;
    setPhotons: (photons: boolean) => void;
    setGlow: (glow: boolean) => void;
    /** The View panel's settings as a visit starts: spectrograph, switches, window, render quality. */
    resetView: () => void;
    /** The guide moves on by itself once a step has been read; off under reduced motion. */
    guidePlaying: boolean;
    /** The step's motion has arrived (the window, temperatures and velocity are in place). */
    guideLanded: boolean;
    /** Where the step's motion is heading. */
    guideTarget: GuidePose | null;
    /** Ends the step's motion: the target pose in place, the step's line open. */
    landGuide: () => void;
    toggleGuidePlaying: () => void;
  };

/** A pose written into the store's own fields. */
const placePose = (s: SpectroscopyStore, pose: GuidePose) => ({
  range: pose.range,
  velocity: pose.velocity,
  sequenceTemperature: pose.sequenceTemperature,
  bench: { ...s.bench, lamp: pose.lamp, gas: pose.gas, column: pose.column },
});

/** A window inside the visible range, at least `MIN_SPAN` wide. */
function clampRange([from, to]: readonly [number, number]): readonly [number, number] {
  const [lo, hi] = FULL_RANGE;
  const span = Math.min(hi - lo, Math.max(MIN_SPAN, to - from));
  const start = Math.min(hi - span, Math.max(lo, from));
  return [start, start + span];
}

const initialView: ViewId = typeof window === "undefined" ? DEFAULT_VIEW : viewFromPath();
/* Dealt as the store is made: the mystery view may be the first page (`viewFromPath`), and
   `mystery` is part of every `Settings`, so there is no later moment and no placeholder case
   that would not show. The draw costs microseconds; nothing else reads `Math.random` at load. */
const initialDeck = drawDeck();

/** The View panel's settings as a visit starts; `resetView` puts them back. */
const VIEW_DEFAULTS = {
  resolution: DEFAULT_RESOLUTION,
  normalized: false,
  photons: true,
  range: FULL_RANGE,
  glow: false,
  ...RENDER_DEFAULTS,
} as const satisfies Partial<SpectroscopyStore>;

const replaced = <T>(items: readonly T[], index: number, item: T) => {
  const out = [...items];
  out[index] = item;
  return out;
};

/** A case opened: its draft and result come back, or it starts clean. */
const openCase = (s: SpectroscopyStore, index: number) => {
  const draft = s.drafts[index];
  return {
    caseIndex: index,
    mystery: s.deck[index] ?? s.deck[0]!,
    result: s.results[index] ?? null,
    compare: draft?.marked ?? [],
    velocity: draft?.velocity ?? 0,
    measure: null,
    selection: null,
  };
};

/** The open case's draft, kept before another opens (unless the guide put its own case up). */
const keepDraft = (s: SpectroscopyStore) =>
  s.view === "mystery" && s.deck[s.caseIndex] === s.mystery
    ? replaced(s.drafts, s.caseIndex, { marked: s.compare, velocity: s.velocity })
    : s.drafts;

export const useSpectroscopy = create<SpectroscopyStore>((set, get) => ({
  view: initialView,
  star: "vega",
  sequenceTemperature: SEQUENCE_DEFAULT,
  velocity: defaultVelocity(initialView, "vega"),
  air: true,
  bench: BENCH_DEFAULT,
  mystery: initialDeck[0]!,
  deck: initialDeck,
  caseIndex: 0,
  drafts: [],
  results: [],
  result: null,
  ready: false,
  panel: "none",
  selection: null,
  ...VIEW_DEFAULTS,
  ...renderSlice(set, RENDER_DEFAULTS),
  letters: true,
  compare: [],
  setReady: () => set({ ready: true }),
  setView: (view) =>
    set((s) => {
      const drafts = keepDraft(s);
      return view === "mystery"
        ? { view, drafts, ...openCase({ ...s, drafts }, s.caseIndex) }
        : { view, drafts, velocity: defaultVelocity(view, s.star), selection: null };
    }),
  setStar: (star) => set({ star, velocity: defaultVelocity("stars", star), selection: null }),
  setSequenceTemperature: (kelvin) => set({ sequenceTemperature: kelvin }),
  setVelocity: (velocity) => set({ velocity }),
  setAir: (air) => set({ air }),
  setResolution: (resolution) => set({ resolution: clamp(resolution, ...RESOLUTION_RANGE) }),
  patchBench: (patch) =>
    set((s) => {
      const bench = { ...s.bench, ...patch };
      return {
        bench: {
          ...bench,
          lamp: bench.lamp > 0 ? clamp(bench.lamp, ...BENCH_RANGE.lamp) : 0,
          gas: clamp(bench.gas, ...BENCH_RANGE.gas),
          column: clamp(bench.column, ...BENCH_RANGE.column),
        },
      };
    }),
  toggleGas: (element) =>
    set((s) => {
      const has = s.bench.elements.includes(element);
      const elements = has
        ? s.bench.elements.filter((e) => e !== element)
        : [...s.bench.elements, element];
      const selected = s.selection ? lineById(s.selection) : undefined;
      return {
        bench: { ...s.bench, elements },
        selection: has && selected?.element === element ? null : s.selection,
      };
    }),
  setCase: (index) =>
    set((s) => {
      const drafts = keepDraft(s);
      return { drafts, ...openCase({ ...s, drafts }, index) };
    }),
  check: () =>
    set((s) => {
      if (s.view !== "mystery") return {};
      const answer = mysteryAnswer(s.mystery, s.resolution, s.air ? 1 : 0);
      const result = grade(s.mystery, answer, s.compare, s.velocity);
      /* The guide's own case is scored but not kept with the deck's. */
      return s.deck[s.caseIndex] === s.mystery
        ? { result, results: replaced(s.results, s.caseIndex, result) }
        : { result };
    }),
  showAnswer: () =>
    set((s) => {
      if (!s.result) return {};
      const { clear, faint } = s.result.answer;
      const compare = ELEMENT_IDS.filter((e) => clear.has(e) || faint.has(e));
      return {
        velocity: mysteryVelocity(s.mystery),
        compare,
        measure: s.measure && compare.includes(s.measure) ? s.measure : (compare[0] ?? null),
      };
    }),
  shuffleCases: () =>
    set((s) => {
      const deck = drawDeck();
      const fresh = {
        deck,
        caseIndex: 0,
        drafts: [],
        results: [],
        mystery: deck[0]!,
        result: null,
      };
      return s.view === "mystery" ? { ...fresh, compare: [], velocity: 0, selection: null } : fresh;
    }),
  toggleCompare: (element) =>
    set((s) =>
      s.compare.includes(element)
        ? { compare: s.compare.filter((e) => e !== element) }
        : /* An element just marked is the one to look at closely. */
          { compare: [...s.compare, element], measure: element },
    ),
  measure: null,
  setMeasure: (measure) => set({ measure }),
  preview: null,
  setPreview: (preview) => set({ preview }),
  setRange: (range) => set({ range: clampRange(range) }),
  zoom: (factor, about) => {
    const [from, to] = get().range;
    const centre = about ?? (from + to) / 2;
    get().setRange([centre - (centre - from) * factor, centre + (to - centre) * factor]);
  },
  pan: (fraction) => {
    const [from, to] = get().range;
    const shift = (to - from) * fraction;
    get().setRange([from + shift, to + shift]);
  },
  select: (selection) => set({ selection }),
  setPanel: (panel) => set({ panel }),
  setNormalized: (normalized) => set({ normalized }),
  setLetters: (letters) => set({ letters }),
  setPhotons: (photons) => set({ photons }),
  setGlow: (glow) => set({ glow }),
  resetView: () => set(VIEW_DEFAULTS),
  ...guideSlice(set, get, {
    tour: TOUR,
    save: (s) => ({
      view: s.view,
      star: s.star,
      velocity: s.velocity,
      air: s.air,
      bench: s.bench,
      mystery: s.mystery,
      result: s.result,
      compare: s.compare,
      letters: s.letters,
      range: s.range,
    }),
    restore: (saved) => saved,
    open: () => ({ guidePlaying: !prefersReducedMotion() }),
    /* A step's discrete settings switch now; its motion heads for `guideTarget`. */
    apply: (step, s) => {
      const star = step.star ?? s.star;
      const bench = step.bench ?? s.bench;
      return {
        guideLanded: false,
        guideTarget: poseOf({
          range: step.range ?? FULL_RANGE,
          velocity: step.velocity ?? defaultVelocity(step.view, star),
          bench,
          sequenceTemperature: s.sequenceTemperature,
        }),
        view: step.view,
        star,
        /* The elements switch now; their amount, the lamp and the gas glide (guide-motion.ts). */
        bench: { ...s.bench, elements: bench.elements },
        mystery: step.mystery ?? s.mystery,
        air: step.air ?? s.air,
        letters: step.letters ?? s.letters,
        compare: step.compare ?? [],
        selection: null,
        result: null,
      };
    },
    close: () => ({ guideLanded: false, guideTarget: null }),
  }),
  guidePlaying: false,
  guideLanded: false,
  guideTarget: null,
  landGuide: () => {
    const s = get();
    if (!s.guideOpen || !s.guideTarget) return;
    set({
      ...placePose(s, s.guideTarget),
      guideLanded: true,
      selection: TOUR[s.guideStep]?.select ?? null,
    });
  },
  toggleGuidePlaying: () => set((s) => ({ guidePlaying: !s.guidePlaying })),
}));

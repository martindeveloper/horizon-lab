import { create } from "zustand";

import { prefersReducedMotion } from "@horizon/toolkit/environment";

import { viewFromPath } from "../routing";
import { ELEMENT_IDS, lineById, type ElementId } from "./model/atoms";
import { poseOf, type GuidePose } from "./model/guide-motion";
import {
  BENCH_DEFAULT,
  BENCH_RANGE,
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
import { FULL_RANGE, TOUR } from "./model/tour";
import { DEFAULT_VIEW, type ViewId } from "./model/view-ids";

export type Panel = "none" | "elements" | "view";

/** What the guide puts back when it ends: the visitor's own settings. */
type Saved = Pick<
  SpectroscopyStore,
  | "view"
  | "star"
  | "velocity"
  | "air"
  | "bench"
  | "mystery"
  | "result"
  | "compare"
  | "letters"
  | "range"
>;

/** A case's answer so far: the elements marked and the shift given the markers. */
type Draft = { marked: readonly ElementId[]; velocity: number };

/** The narrowest window the spectrum zooms to, nm. */
export const MIN_SPAN = 0.4;
/** Resolving powers the spectrograph offers. */
export const RESOLUTION_RANGE = [300, 100_000] as const;

export type SpectroscopyStore = Settings & {
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
  guideOpen: boolean;
  guideStep: number;
  /** The guide moves on by itself once a step has been read; off under reduced motion. */
  guidePlaying: boolean;
  /** The step's motion has arrived (the window, temperatures and velocity are in place). */
  guideLanded: boolean;
  /** Where the step's motion is heading. */
  guideTarget: GuidePose | null;
  savedBeforeGuide: Saved | null;
  startGuide: () => void;
  /** Starts a step: its discrete settings switch now, its motion heads for `guideTarget`. */
  goGuide: (step: number) => void;
  /** Ends the step's motion: the target pose in place, the step's line open. */
  landGuide: () => void;
  toggleGuidePlaying: () => void;
  endGuide: () => void;
};

/** A pose written into the store's own fields. */
const placePose = (s: SpectroscopyStore, pose: GuidePose) => ({
  range: pose.range,
  velocity: pose.velocity,
  sequenceTemperature: pose.sequenceTemperature,
  bench: { ...s.bench, lamp: pose.lamp, gas: pose.gas, column: pose.column },
});

/** A window inside the visible range, at least `MIN_SPAN` wide. */
export function clampRange([from, to]: readonly [number, number]): readonly [number, number] {
  const [lo, hi] = FULL_RANGE;
  const span = Math.min(hi - lo, Math.max(MIN_SPAN, to - from));
  const start = Math.min(hi - span, Math.max(lo, from));
  return [start, start + span];
}

const clamp = (v: number, [lo, hi]: readonly [number, number]) => Math.min(hi, Math.max(lo, v));

const initialView: ViewId = typeof window === "undefined" ? DEFAULT_VIEW : viewFromPath();
const initialDeck = drawDeck();

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
  resolution: 20_000,
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
  range: FULL_RANGE,
  normalized: false,
  letters: true,
  compare: [],
  photons: true,
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
  setResolution: (resolution) => set({ resolution: clamp(resolution, RESOLUTION_RANGE) }),
  patchBench: (patch) =>
    set((s) => {
      const bench = { ...s.bench, ...patch };
      return {
        bench: {
          ...bench,
          lamp: bench.lamp > 0 ? clamp(bench.lamp, BENCH_RANGE.lamp) : 0,
          gas: clamp(bench.gas, BENCH_RANGE.gas),
          column: clamp(bench.column, BENCH_RANGE.column),
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
  guideOpen: false,
  guideStep: 0,
  guidePlaying: false,
  guideLanded: false,
  guideTarget: null,
  savedBeforeGuide: null,
  startGuide: () => {
    const s = get();
    set({
      guideOpen: true,
      guidePlaying: !prefersReducedMotion(),
      panel: "none",
      savedBeforeGuide: s.savedBeforeGuide ?? {
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
      },
    });
    get().goGuide(0);
  },
  goGuide: (index) => {
    const step = TOUR[index];
    if (!get().guideOpen || index < 0) return;
    if (!step) return get().endGuide();
    const s = get();
    const star = step.star ?? s.star;
    const bench = step.bench ?? s.bench;
    set({
      guideStep: index,
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
    });
  },
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
  endGuide: () =>
    set((s) => ({
      guideOpen: false,
      guideStep: 0,
      guideLanded: false,
      guideTarget: null,
      selection: null,
      ...s.savedBeforeGuide,
      savedBeforeGuide: null,
    })),
}));

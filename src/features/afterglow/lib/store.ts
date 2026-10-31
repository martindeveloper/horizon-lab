import { create } from "zustand";

import { driftSlice, type DriftSlice } from "@/lib/drift";
import { helpSlice, type HelpSlice } from "@/lib/help";
import {
  EXPERIENCE_SCENE_SETTINGS,
  guideSlice,
  sceneSlice,
  type GuideSlice,
  type SceneSlice,
} from "@/lib/scene-store";
import { prefersReducedMotion } from "@horizon/toolkit/environment";

import { viewFromPath } from "../routing";
import { DRIFT_PACE } from "./drift";
import { HELP } from "./help";
import type { ChapterId } from "./model/chapter-ids";
import { DEFAULT_PACE, PACES, chapterById, chapterOf, type PaceId } from "./model/chapters";
import { TOUR } from "./model/tour";
import { END_AGE } from "./model/track";
import { VANTAGE } from "./model/vantage";
import { WORLDS, lostBy, standingWorld, type WorldId } from "./model/worlds";

type Panel = "none" | "settings";

/** What the Settings panel switches on the scene. */
export type Show = {
  /** The eye's glare about the Sun. */
  glare: boolean;
};

const DEFAULT_SHOW: Show = { glare: true };

/** What the guide gives back when it ends: where and when the visitor stood. */
type Saved = {
  age: number;
  aim: number | null;
  view: ChapterId;
  chosen: WorldId;
  auto: boolean;
  playing: boolean;
  show: Show;
  atlas: boolean;
};

/** What the `?` tour gives back besides the guide's: the pace. */
type HelpSaved = Saved & { pace: PaceId };

/** What the autoplay sets, as the visitor had it before it began. */
type BeforeDrift = { pace: PaceId; auto: boolean; chosen: WorldId };

export type AfterglowStore = SceneSlice &
  GuideSlice<Saved> &
  HelpSlice<HelpSaved> &
  DriftSlice & {
    /** The chapter under the playhead. */
    view: ChapterId;
    /** The moment shown, years since the first solids. */
    age: number;
    /** An age the clock eases to (a chapter, a guide step); null once there. The scene writes `age` meanwhile. */
    aim: number | null;
    playing: boolean;
    pace: PaceId;
    /** The world the visitor would stand on: the schedule's while `auto`, else their own pick. */
    chosen: WorldId;
    /** The world the visitor stands on: the chosen one, or the nearest outward survivor once it is swallowed (`standingWorld`). */
    world: WorldId;
    /** The vantage follows the chapters (the autoplay's schedule) until a world is chosen. */
    auto: boolean;
    /** The world whose card is open. */
    selection: WorldId | null;
    panel: Panel;
    atlas: boolean;
    show: Show;
    /** The frame's magnification of the disc over the open view, which the Sun's radius alone sets (the scene writes it). */
    magnification: number;
    /** The playhead's speed against the chapters' pace while the clock runs: under 1 through a rush or a world change (the scene writes it). */
    tempo: number;
    /** The world the scene draws: the one stood on, or through a move the one left until the globes change (the scene writes it). */
    drawn: WorldId;
    /** A chapter: the clock eases to its first moment and the vantage follows the schedule. */
    setView: (view: ChapterId) => void;
    /** The clock set outright (the timeline's scrub): the hand on the timeline pauses the clock, as the guide's does. */
    setAge: (age: number) => void;
    setPlaying: (playing: boolean) => void;
    togglePlaying: () => void;
    setPace: (pace: PaceId) => void;
    stepPace: (by: 1 | -1) => void;
    /** Stands on a world at the current age and opens its card; the vantage stops following the chapters. */
    standOn: (world: WorldId) => void;
    select: (world: WorldId | null) => void;
    setPanel: (panel: Panel) => void;
    setAtlas: (atlas: boolean) => void;
    patchShow: (patch: Partial<Show>) => void;
    /** The Settings panel as a visit starts. */
    resetView: () => void;
    /** The scene's clock: the age it has reached, the chapter it is in, and whether the aim is reached. */
    tick: (age: number, arrived: boolean) => void;
    setMagnification: (magnification: number) => void;
    setTempo: (tempo: number) => void;
    setDrawn: (drawn: WorldId) => void;
    /* The guided journey (model/tour.ts). */
    guidePlaying: boolean;
    guideLanded: boolean;
    toggleGuidePlaying: () => void;
    landGuide: () => void;
    beforeDrift: BeforeDrift | null;
  };

const INITIAL_VIEW: ChapterId = typeof window === "undefined" ? "today" : viewFromPath();

const paceIndex = (pace: PaceId) => PACES.findIndex((p) => p.id === pace);

/** The world chosen and the one stood on at an age: every change of either goes through here. */
const placed = (chosen: WorldId, age: number) => ({ chosen, world: standingWorld(chosen, age) });
/** The world a chapter puts the visitor on: the schedule's while it is followed, else their own. */
const intended = (s: Pick<AfterglowStore, "auto" | "chosen">, view: ChapterId) =>
  s.auto ? VANTAGE[view] : s.chosen;

export const useAfterglow = create<AfterglowStore>((set, get) => ({
  /* No scale bar: the slice's reading stays empty. */
  ...sceneSlice(set, { scalePx: 0, scaleValue: 0, scaleUnit: "au" }, EXPERIENCE_SCENE_SETTINGS),
  view: INITIAL_VIEW,
  age: chapterById(INITIAL_VIEW).from,
  aim: null,
  /* An experience: a visit opens playing from its chapter. */
  playing: true,
  pace: DEFAULT_PACE,
  ...placed(VANTAGE[INITIAL_VIEW], chapterById(INITIAL_VIEW).from),
  drawn: standingWorld(VANTAGE[INITIAL_VIEW], chapterById(INITIAL_VIEW).from),
  auto: true,
  selection: null,
  panel: "none",
  atlas: false,
  show: DEFAULT_SHOW,
  magnification: 1,
  tempo: 1,
  setView: (view) =>
    set((s) => ({
      view,
      aim: chapterById(view).from,
      flight: s.flight + 1,
      ...placed(intended(s, view), chapterById(view).from),
    })),
  setAge: (age) =>
    set((s) => {
      const view = chapterOf(age).id;
      return { age, aim: null, playing: false, view, ...placed(intended(s, view), age) };
    }),
  setPlaying: (playing) => set({ playing }),
  /* Play at the end of the life starts it over from the young Sun. */
  togglePlaying: () =>
    set((s) => {
      if (s.playing || s.age < END_AGE) return { playing: !s.playing };
      return {
        age: 0,
        aim: null,
        playing: true,
        view: "young",
        ...placed(intended(s, "young"), 0),
      };
    }),
  setPace: (pace) => set({ pace }),
  stepPace: (by) =>
    set((s) => {
      const next = PACES[Math.min(PACES.length - 1, Math.max(0, paceIndex(s.pace) + by))]!;
      return { pace: next.id };
    }),
  /* A swallowed world cannot be stood on: its card opens, telling its fate. */
  standOn: (world) =>
    set((s) =>
      lostBy(WORLDS[world].orbit, s.age)
        ? { selection: world, panel: "none" }
        : { ...placed(world, s.age), auto: false, selection: world, panel: "none" },
    ),
  select: (selection) => set({ selection }),
  /* The Settings panel and the Atlas share the rail: opening one closes the other. */
  setPanel: (panel) => set(panel === "none" ? { panel } : { panel, atlas: false }),
  setAtlas: (atlas) => set(atlas ? { atlas, panel: "none" } : { atlas }),
  patchShow: (patch) => set((s) => ({ show: { ...s.show, ...patch } })),
  resetView: () => set({ show: DEFAULT_SHOW, ...EXPERIENCE_SCENE_SETTINGS }),
  setMagnification: (magnification) => set({ magnification }),
  setTempo: (tempo) => set({ tempo }),
  setDrawn: (drawn) => set({ drawn }),
  tick: (age, arrived) =>
    set((s) => {
      /* Easing to an aim, the clock passes through other chapters: the aim's chapter and world hold until it lands. */
      if (s.aim !== null && !arrived) return { age };
      const view = chapterOf(age).id;
      const next = placed(intended(s, view), age);
      const moved = next.chosen !== s.chosen || next.world !== s.world;
      return {
        age,
        ...(arrived ? { aim: null } : {}),
        ...(view === s.view ? {} : { view }),
        ...(moved ? next : {}),
      };
    }),
  ...guideSlice(set, get, {
    tour: TOUR,
    save: (s) => ({
      age: s.age,
      aim: s.aim,
      view: s.view,
      chosen: s.chosen,
      auto: s.auto,
      playing: s.playing,
      show: s.show,
      atlas: s.atlas,
    }),
    restore: (saved) => ({
      ...saved,
      ...placed(saved.chosen, saved.age),
      flight: get().flight + 1,
    }),
    open: () => ({ guidePlaying: !prefersReducedMotion(), playing: false, atlas: false }),
    apply: (step, s) => ({
      guideLanded: false,
      aim: step.age,
      view: chapterOf(step.age).id,
      ...placed(step.world, step.age),
      auto: false,
      flight: s.flight + 1,
      selection: null,
    }),
    close: () => ({ guideLanded: false }),
  }),
  ...helpSlice(set, get, {
    steps: HELP,
    save: (s) => ({
      age: s.age,
      aim: s.aim,
      view: s.view,
      chosen: s.chosen,
      auto: s.auto,
      playing: s.playing,
      show: s.show,
      pace: s.pace,
      atlas: s.atlas,
    }),
    restore: (saved) => ({
      ...saved,
      ...placed(saved.chosen, saved.age),
      flight: get().flight + 1,
    }),
  }),
  guidePlaying: false,
  guideLanded: false,
  toggleGuidePlaying: () => set((s) => ({ guidePlaying: !s.guidePlaying })),
  landGuide: () => {
    if (get().guideOpen && !get().guideLanded) set({ guideLanded: true });
  },
  beforeDrift: null,
  /* The autoplay: the guide ends, everything closes, the life starts over from the young Sun
     at the track's pace with the vantage on its schedule; ending it gives the pace back. */
  ...driftSlice(set, get, {
    open: (opening) => {
      if (opening.guideOpen) opening.endGuide();
      /* What the visitor had once the guide has given its own back. */
      const s = get();
      return {
        panel: "none" as const,
        selection: null,
        atlas: false,
        beforeDrift: { pace: s.pace, auto: s.auto, chosen: s.chosen },
        pace: DRIFT_PACE,
        auto: true,
        playing: true,
        age: 0,
        aim: null,
        view: "young" as const,
        ...placed(VANTAGE.young, 0),
        flight: s.flight + 1,
      };
    },
    /* The visitor's pace and choice back, standing where the autoplay stopped. */
    close: (s) => ({
      ...(s.beforeDrift
        ? {
            pace: s.beforeDrift.pace,
            auto: s.beforeDrift.auto,
            ...placed(intended(s.beforeDrift, s.view), s.age),
          }
        : {}),
      playing: false,
      beforeDrift: null,
    }),
  }),
}));

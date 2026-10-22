/**
 * Help: the `?` tour of a simulation's controls. Each step rings a control and moves the
 * scene the way that control does (the camera turns, a view opens, the clock speeds up), so
 * the visitor sees what it is for. Each simulation writes its steps in
 * `src/features/<slug>/lib/help.ts`; this is the machine every store carries. No React.
 */
import type { SceneCamera } from "./scene-store";

/** A step's move on the scene, `at` seconds after the step begins: one of the store's own actions. */
export type HelpCue<S> = { at?: number; run: (state: S) => void };

/** One step: its copy (`<namespace>.help.<id>.title` and `.body`), what it points at and what it does. */
export type HelpStep<S> = {
  id: string;
  /** `data-coach` ids, the first on screen ringed: a phone folds some tools into More. */
  targets?: readonly string[];
  /** Presses the target as the step begins (opens a picker), and closes it as the step ends. */
  press?: boolean;
  /**
   * What the step does to the scene. Cues set states outright (a view, a light, a panel), so
   * stepping back replays a step as it was; the camera moves by its own steps.
   */
  cues?: readonly HelpCue<S>[];
};

/** What the tour gives back: the simulation's own fields, its panel and selection, the camera's place. */
type HelpSaved<Saved> = {
  scene: Saved;
  aside: { panel?: unknown; selection?: unknown };
  camera: (() => void) | null;
};

export type HelpSlice<Saved> = {
  helpOpen: boolean;
  /** The step shown, from 0. */
  helpStep: number;
  /** What the visitor had before the tour, given back however it ends. */
  savedBeforeHelp: HelpSaved<Saved> | null;
  startHelp: () => void;
  /** Shows a step; past the last one the tour ends. */
  goHelp: (step: number) => void;
  endHelp: () => void;
};

/** What the machine reads of any store that has them. */
type HelpHost = {
  panel?: unknown;
  selection?: unknown;
  camera?: SceneCamera | null;
  guideOpen?: boolean;
  endGuide?: () => void;
};

/**
 * The tour's machine, the same in every simulation. Starting it ends a guided journey first,
 * then keeps what the steps may change: the simulation's fields (`save`), its panel and
 * selection where it has them, and where the camera stands. Ending it, from any step, by the
 * close button, Escape, a press outside or Finish, gives all of it back (`restore`) and flies
 * the camera home last, so it lands where the visitor left it.
 */
export function helpSlice<S extends HelpSlice<Saved> & HelpHost, Saved>(
  set: NoInfer<(patch: (state: S) => Partial<S>) => void>,
  get: () => S,
  help: {
    steps: readonly HelpStep<S>[];
    save: (state: S) => Saved;
    restore: (saved: Saved, state: S) => Partial<S>;
  },
): HelpSlice<Saved> {
  /* `panel` and `selection` are written back only in stores that have them. */
  const patch = (fields: object) => fields as Partial<S>;
  return {
    helpOpen: false,
    helpStep: 0,
    savedBeforeHelp: null,
    startHelp: () => {
      if (get().helpOpen || help.steps.length === 0) return;
      if (get().guideOpen) get().endGuide?.();
      set((s) =>
        patch({
          helpOpen: true,
          helpStep: 0,
          savedBeforeHelp: {
            scene: help.save(s),
            aside: {
              ...("panel" in s ? { panel: s.panel } : {}),
              ...("selection" in s ? { selection: s.selection } : {}),
            },
            camera: s.camera?.mark() ?? null,
          },
        }),
      );
    },
    goHelp: (step) => {
      if (!get().helpOpen || step < 0) return;
      if (step >= help.steps.length) return get().endHelp();
      set(() => patch({ helpStep: step }));
    },
    endHelp: () => {
      const { helpOpen, savedBeforeHelp: saved } = get();
      if (!helpOpen) return;
      set((s) =>
        patch({
          helpOpen: false,
          helpStep: 0,
          savedBeforeHelp: null,
          ...(saved ? { ...saved.aside, ...help.restore(saved.scene, s) } : {}),
        }),
      );
      saved?.camera?.();
    },
  };
}

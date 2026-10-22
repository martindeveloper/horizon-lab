"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import type { StoreApi } from "zustand";

import type { HelpSlice, HelpStep } from "@/lib/help";
import { COACH_AVOID, CoachMark, playCues, useImmersive } from "@horizon/toolkit/ui";

/** What the toolbar's `?` needs of a simulation's tour: its state, its steps and their cues. */
export type HelpAccess = {
  /** The feature's message namespace: each step's words are `help.<id>.title` and `.body` in it. */
  namespace: string;
  open: boolean;
  step: number;
  steps: readonly Pick<HelpStep<never>, "id" | "targets" | "press">[];
  start: () => void;
  go: (step: number) => void;
  end: () => void;
  /** Plays a step's cues on the store; returns their stop. */
  play: (step: number) => () => void;
};

/** What `useHelp` reads of a store: pass `{ getState, subscribe }` of it, made once at module scope. */
export type HelpStore<S> = Pick<StoreApi<S>, "getState" | "subscribe">;

/** A simulation's tour for its toolbar, from its store (`helpSlice`) and its steps. */
export function useHelp<S extends HelpSlice<unknown>>(
  store: HelpStore<S>,
  steps: readonly HelpStep<S>[],
  namespace: string,
): HelpAccess {
  const open = useSyncExternalStore(
    store.subscribe,
    () => store.getState().helpOpen,
    () => false,
  );
  const step = useSyncExternalStore(
    store.subscribe,
    () => store.getState().helpStep,
    () => 0,
  );
  const play = useCallback(
    (index: number) =>
      playCues(
        (steps[index]?.cues ?? []).map(({ at, run }) => ({
          ...(at === undefined ? {} : { at }),
          run: () => run(store.getState()),
        })),
      ),
    [store, steps],
  );
  return useMemo(
    () => ({
      namespace,
      open,
      step,
      steps,
      play,
      start: () => store.getState().startHelp(),
      go: (index: number) => store.getState().goHelp(index),
      end: () => store.getState().endHelp(),
    }),
    [namespace, open, step, steps, play, store],
  );
}

/** The callout keeps clear of the HUD's glass and of the shell's bars over the stage. */
const AVOID = `${COACH_AVOID}, .app-header, .app-footer`;

/**
 * The tour on the stage: the toolkit's coach mark worded by the shared `help` copy and the
 * feature's steps, each step's cues played as it shows and stopped as it goes. Immersive view
 * ends it. Mounted only while the tour is open, so a closed tour costs nothing.
 */
export function HelpTour({
  help,
  returnFocus,
}: {
  help: HelpAccess;
  returnFocus: () => HTMLElement | null;
}) {
  const t = useTranslations(help.namespace);
  const tHelp = useTranslations("help");
  const { step, steps, play, go, end } = help;
  useEffect(() => play(step), [play, step]);
  /* Immersive view hides the controls the tour is about: it ends the tour. */
  const immersive = useImmersive();
  useEffect(() => {
    if (immersive) end();
  }, [immersive, end]);
  const current = steps[step];
  if (!current) return null;
  return (
    <CoachMark
      label={tHelp("label")}
      kicker={tHelp("progress", { step: step + 1, total: steps.length })}
      title={t(`help.${current.id}.title`)}
      body={t(`help.${current.id}.body`)}
      step={step}
      total={steps.length}
      targets={current.targets}
      press={current.press}
      scope="[data-simulation]"
      avoid={AVOID}
      labels={{
        previous: tHelp("previous"),
        next: tHelp("next"),
        finish: tHelp("finish"),
        close: tHelp("close"),
      }}
      onPrevious={() => go(step - 1)}
      onNext={() => go(step + 1)}
      onClose={end}
      returnFocus={returnFocus}
    />
  );
}

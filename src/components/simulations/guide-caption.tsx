"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, type ReactNode } from "react";

import type { Translate } from "@/lib/facts";
import { cn } from "@horizon/toolkit/ui";

import { GuideBody, GuideCard, GuideTitle, type GuideControls } from "./guide-card";
import { useDockClearance, type DockInTheWay } from "./use-dock-clearance";

/** What a guide's card reads and does in its simulation's store. */
export type GuideState = {
  guideOpen: boolean;
  guideStep: number;
  /** Applies a step; past the last one the guide ends. */
  goGuide: (step: number) => void;
  endGuide: () => void;
};

/** A guided journey: it moves on by itself once a landed step has been read. */
export type JourneyState = GuideState & {
  guidePlaying: boolean;
  /** The step's motion has arrived; the hold counts from here. */
  guideLanded: boolean;
  toggleGuidePlaying: () => void;
};

/** A journey's step: its message id and, where it differs from the journey's, its hold in seconds. */
export type JourneyStep = { id: string; dwell?: number | undefined };

/**
 * The guide's back, on and out buttons, worded by the namespace's `tour.*` copy; a guide adds
 * play and whatever else it has beside them.
 */
export function tourControls(
  t: Translate,
  index: number,
  total: number,
  getState: () => Pick<GuideState, "goGuide" | "endGuide">,
): Pick<GuideControls, "previous" | "next" | "exit"> {
  const last = index >= total - 1;
  return {
    previous: {
      label: t("tour.previous"),
      disabled: index === 0,
      onClick: () => getState().goGuide(index - 1),
    },
    next: {
      label: last ? t("tour.finish") : t("tour.next"),
      last,
      onClick: () => getState().goGuide(index + 1),
    },
    exit: { label: t("tour.exit"), onClick: () => getState().endGuide() },
  };
}

/**
 * Moves a journey on once a landed step has held for `dwell` seconds of play. A pause keeps
 * what is left; a new step starts afresh.
 */
function useGuideDwell(
  getState: () => Pick<GuideState, "guideOpen" | "guideStep" | "goGuide">,
  counting: boolean,
  dwell: number,
  index: number,
) {
  const left = useRef(dwell * 1000);
  /* Declared first, so a new step's full hold is in place before the timer below starts. */
  useEffect(() => {
    left.current = dwell * 1000;
  }, [index, dwell]);
  useEffect(() => {
    if (!counting) return;
    const started = performance.now();
    const timer = window.setTimeout(() => {
      const api = getState();
      if (api.guideOpen && api.guideStep === index) api.goGuide(index + 1);
    }, left.current);
    return () => {
      window.clearTimeout(timer);
      left.current = Math.max(0, left.current - (performance.now() - started));
    };
  }, [counting, index, getState]);
}

/**
 * A guided journey's caption, on the shared guide card: where we are (`tour.steps.<id>`), what
 * to notice, `extra` under them (a formula), and a gold hairline (`hold`, the feature's class
 * for it) that fills while a landed step holds before the journey moves on. It can always be
 * paused (WCAG 2.2.2), stepped or left. The caption publishes its height on the stage
 * (`clearance`), so the scene's names end above it.
 */
export function GuideCaption<Step extends JourneyStep>({
  namespace,
  getState,
  tour,
  dwell,
  index,
  playing,
  landed,
  hold,
  className,
  clearance,
  extra,
}: {
  namespace: string;
  getState: () => JourneyState;
  tour: readonly Step[];
  /** The hold of a step that names none, seconds. */
  dwell: number;
  index: number;
  playing: boolean;
  landed: boolean;
  /** The feature's class animating the hairline's fill. */
  hold: string;
  className?: string | undefined;
  clearance?: { inTheWay?: DockInTheWay; property?: string } | undefined;
  extra?: ((step: Step) => ReactNode) | undefined;
}) {
  const t = useTranslations(namespace);
  const card = useRef<HTMLElement>(null);
  useDockClearance(card, clearance?.inTheWay, clearance?.property);
  const step = tour[index] ?? tour[0]!;
  const last = index >= tour.length - 1;
  const stepDwell = step.dwell ?? dwell;
  const counting = playing && landed && !last;
  useGuideDwell(getState, counting, stepDwell, index);

  return (
    <GuideCard
      label={t("tour.label")}
      kicker={t("tour.progress", { step: index + 1, total: tour.length })}
      stepKey={step.id}
      focusNext
      className={className}
      cardRef={card}
      hold={
        /* The step's hold: fills while the journey waits, freezes while it is paused. */
        <div
          aria-hidden
          className={cn(
            "mt-3 h-px w-32 shrink-0 overflow-hidden bg-fg/15 short:mt-1.5",
            last && "hidden",
          )}
        >
          <span
            key={index}
            className={cn(hold, "block h-full bg-solar")}
            data-state={counting ? "running" : landed ? "paused" : "waiting"}
            style={{ animationDuration: `${stepDwell}s` }}
          />
        </div>
      }
      controls={{
        ...tourControls(t, index, tour.length, getState),
        play: last
          ? undefined
          : {
              label: playing ? t("tour.pause") : t("tour.play"),
              playing,
              onClick: () => getState().toggleGuidePlaying(),
            },
      }}
    >
      <GuideTitle>{t(`tour.steps.${step.id}.title`)}</GuideTitle>
      <GuideBody>{t(`tour.steps.${step.id}.body`)}</GuideBody>
      {extra?.(step)}
    </GuideCard>
  );
}

"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";

import {
  GuideBody,
  GuideCard,
  GuideEquation,
  GuideTitle,
} from "@/components/simulations/guide-card";
import { useDockClearance } from "@/components/simulations/use-dock-clearance";
import { cn } from "@horizon/toolkit/ui";

import { SPECTROSCOPY_EQUATIONS } from "../lib/model/equations";
import { GUIDE_DWELL, TOUR } from "../lib/model/tour";
import { useSpectroscopy } from "../lib/store";

/**
 * The guided journey's caption, low over the spectrum: where we are, what to notice, the
 * formula behind it, and a gold hairline that fills while a landed step holds before the guide
 * moves on. It can always be paused (WCAG 2.2.2), stepped or left.
 */
export function GuideCaption() {
  const t = useTranslations("spectroscopy");
  const index = useSpectroscopy((s) => s.guideStep);
  const playing = useSpectroscopy((s) => s.guidePlaying);
  const landed = useSpectroscopy((s) => s.guideLanded);
  const next = useRef<HTMLButtonElement>(null);
  /* The spectrum ends above the caption, as it does above the dock. */
  const card = useRef<HTMLElement>(null);
  useDockClearance(card);
  const step = TOUR[index] ?? TOUR[0]!;
  const last = index >= TOUR.length - 1;
  const dwell = step.dwell ?? GUIDE_DWELL;
  const counting = playing && landed && !last;
  useDwell(counting, dwell, index);
  const equation = step.equation ? SPECTROSCOPY_EQUATIONS[step.equation] : undefined;
  const api = useSpectroscopy.getState;

  useEffect(() => {
    next.current?.focus({ preventScroll: true });
  }, []);

  return (
    <GuideCard
      label={t("tour.label")}
      kicker={t("tour.progress", { step: index + 1, total: TOUR.length })}
      stepKey={step.id}
      nextRef={next}
      cardRef={card}
      hold={
        /* The step's hold: fills while the guide waits, freezes while it is paused. */
        <div
          aria-hidden
          className={cn(
            "mt-3 h-px w-32 shrink-0 overflow-hidden bg-fg/15 short:mt-1.5",
            last && "hidden",
          )}
        >
          <span
            key={index}
            className="spectroscopy-dwell block h-full bg-solar"
            data-state={counting ? "running" : landed ? "paused" : "waiting"}
            style={{ animationDuration: `${dwell}s` }}
          />
        </div>
      }
      controls={{
        previous: {
          label: t("tour.previous"),
          disabled: index === 0,
          onClick: () => api().goGuide(index - 1),
        },
        play: last
          ? undefined
          : {
              label: playing ? t("tour.pause") : t("tour.play"),
              playing,
              onClick: () => api().toggleGuidePlaying(),
            },
        next: {
          label: last ? t("tour.finish") : t("tour.next"),
          last,
          onClick: () => api().goGuide(index + 1),
        },
        exit: { label: t("tour.exit"), onClick: () => api().endGuide() },
      }}
    >
      <GuideTitle>{t(`tour.steps.${step.id}.title`)}</GuideTitle>
      <GuideBody>{t(`tour.steps.${step.id}.body`)}</GuideBody>
      {equation ? <GuideEquation>{equation.toString()}</GuideEquation> : null}
    </GuideCard>
  );
}

/**
 * Moves the guide on once a landed step has held for `dwell` seconds of play. A pause keeps
 * what is left; a new step starts afresh.
 */
function useDwell(counting: boolean, dwell: number, index: number) {
  const left = useRef(dwell * 1000);
  /* Declared first, so a new step's full hold is in place before the timer below starts. */
  useEffect(() => {
    left.current = dwell * 1000;
  }, [index, dwell]);
  useEffect(() => {
    if (!counting) return;
    const started = performance.now();
    const timer = window.setTimeout(() => {
      const api = useSpectroscopy.getState();
      if (api.guideOpen && api.guideStep === index) api.goGuide(index + 1);
    }, left.current);
    return () => {
      window.clearTimeout(timer);
      left.current = Math.max(0, left.current - (performance.now() - started));
    };
  }, [counting, index]);
}

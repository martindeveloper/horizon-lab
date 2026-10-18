"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";

import { useDockClearance, type DockInTheWay } from "@/components/simulations/dock-clearance";
import { GuideBody, GuideCard, GuideTitle } from "@/components/simulations/guide-card";
import { cn } from "@horizon/toolkit/ui";

import { TOUR, TOUR_DWELL } from "../lib/model/tour";
import { useDeepField } from "../lib/store";

/** A caption beside the scene (a phone held sideways) leaves the names below it alone. */
const acrossTheMiddle: DockInTheWay = (caption, stage) => {
  const middle = stage.left + stage.width / 2;
  return caption.left < middle && caption.right > middle;
};

/**
 * The journey's caption, on the shared guide card above the sightline: where we are, one or
 * two lines on what to notice, and a gold hairline that fills while the shot holds before the
 * journey moves on. It can always be paused (WCAG 2.2.2), stepped or left.
 */
export function GuideCaption() {
  const t = useTranslations("deepField");
  const index = useDeepField((s) => s.guideStep);
  const playing = useDeepField((s) => s.guidePlaying);
  const landed = useDeepField((s) => s.guideLanded);
  const next = useRef<HTMLButtonElement>(null);
  /* The scene's names keep above the caption, as they do above the sightline. */
  const card = useRef<HTMLElement>(null);
  useDockClearance(card, acrossTheMiddle, "--caption-clear");
  const step = TOUR[index] ?? TOUR[0]!;
  const last = index >= TOUR.length - 1;
  const dwell = step.dwell ?? TOUR_DWELL;
  const counting = playing && landed && !last;
  useDwell(counting, dwell, index);
  const api = useDeepField.getState;

  useEffect(() => {
    next.current?.focus({ preventScroll: true });
  }, []);

  return (
    <GuideCard
      label={t("tour.label")}
      kicker={t("tour.progress", { step: index + 1, total: TOUR.length })}
      stepKey={step.id}
      nextRef={next}
      className="bottom-(--hud-clear,6rem) pb-2"
      cardRef={card}
      hold={
        /* The shot's hold: fills while the journey waits, freezes while it is paused. */
        <div
          aria-hidden
          className={cn(
            "mt-3 h-px w-32 shrink-0 overflow-hidden bg-fg/15 short:mt-1.5",
            last && "hidden",
          )}
        >
          <span
            key={index}
            className="deep-field-dwell block h-full bg-solar"
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
    </GuideCard>
  );
}

/**
 * Moves the journey on once a landed shot has held for `dwell` seconds of play. A pause keeps
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
      const api = useDeepField.getState();
      if (api.guideOpen && api.guideStep === index) api.goGuide(index + 1);
    }, left.current);
    return () => {
      window.clearTimeout(timer);
      left.current = Math.max(0, left.current - (performance.now() - started));
    };
  }, [counting, index]);
}

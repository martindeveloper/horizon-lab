"use client";

import { ChevronLeft, ChevronRight, Pause, Play, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";

import { useDockClearance, type DockInTheWay } from "@/components/simulations/dock-clearance";
import { Action, IconButton, Tooltip, cn } from "@horizon/toolkit/ui";

import { TOUR, TOUR_DWELL } from "../lib/model/tour";
import { useDeepField } from "../lib/store";

/** A caption beside the scene (a phone held sideways) leaves the names below it alone. */
const acrossTheMiddle: DockInTheWay = (caption, stage) => {
  const middle = stage.left + stage.width / 2;
  return caption.left < middle && caption.right > middle;
};

/**
 * The journey's captions, read straight off the sky above the sightline like a film's: where
 * we are, one or two lines on what to notice, and a gold hairline that fills while the shot
 * holds before the journey moves on. It can always be paused (WCAG 2.2.2), stepped or left.
 */
export function GuideCaption() {
  const t = useTranslations("deepField");
  const index = useDeepField((s) => s.guideStep);
  const playing = useDeepField((s) => s.guidePlaying);
  const landed = useDeepField((s) => s.guideLanded);
  const next = useRef<HTMLButtonElement>(null);
  /* The scene's names keep above the caption's words, as they do above the sightline. */
  const words = useRef<HTMLDivElement>(null);
  useDockClearance(words, acrossTheMiddle, "--caption-clear");
  const step = TOUR[index] ?? TOUR[0]!;
  const last = index >= TOUR.length - 1;
  const dwell = step.dwell ?? TOUR_DWELL;
  const counting = playing && landed && !last;
  useDwell(counting, dwell, index);
  const api = useDeepField.getState;

  useEffect(() => {
    next.current?.focus({ preventScroll: true });
  }, []);

  const playLabel = playing ? t("tour.pause") : t("tour.play");
  return (
    <section
      aria-label={t("tour.label")}
      className="hud-bottom pointer-events-none absolute inset-x-0 bottom-(--hud-clear,6rem) z-[60] px-(--hud-gutter) pt-16 pb-2 short:pt-6"
    >
      <div
        ref={words}
        className="deep-field-sightline mx-auto flex max-w-xl flex-col items-center text-center short:mx-0 short:max-w-xs short:items-start short:text-left"
      >
        <p className="font-mono text-[10px] tracking-[0.14em] text-space-muted uppercase tabular-nums short:hidden">
          {t("tour.progress", { step: index + 1, total: TOUR.length })}
        </p>
        {/* One live region for the whole journey, so each caption is announced once. */}
        <div aria-live="polite" aria-atomic="true">
          <div key={step.id} className="anim-fade">
            <h2 className="mt-1.5 font-display text-xl font-medium tracking-tight text-balance text-space-fg md:text-2xl short:mt-0 short:text-base">
              {t(`tour.steps.${step.id}.title`)}
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-pretty text-space-fg/80 short:mt-0.5 short:line-clamp-2 short:text-xs">
              {t(`tour.steps.${step.id}.body`)}
            </p>
          </div>
        </div>
        {/* The shot's hold: fills while the journey waits, freezes while it is paused. */}
        <div
          aria-hidden
          className={cn(
            "mt-3 h-px w-32 overflow-hidden bg-space-fg/15 short:mt-1.5",
            last && "invisible",
          )}
        >
          <span
            key={index}
            className="deep-field-dwell block h-full bg-solar"
            data-state={counting ? "running" : landed ? "paused" : "waiting"}
            style={{ animationDuration: `${dwell}s` }}
          />
        </div>
        <div className="pointer-events-auto mt-3 flex items-center gap-2 short:mt-1.5">
          {/* aria-disabled, not disabled: stepping back to the start must not drop focus. */}
          <IconButton
            aria-label={t("tour.previous")}
            aria-disabled={index === 0}
            onClick={() => {
              if (index > 0) api().goGuide(index - 1);
            }}
            className="rounded-full aria-disabled:opacity-40"
          >
            <ChevronLeft className="size-4" />
          </IconButton>
          {last ? null : (
            <Tooltip label={playLabel}>
              <IconButton
                aria-label={playLabel}
                active={playing}
                onClick={() => api().toggleGuidePlaying()}
              >
                {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
              </IconButton>
            </Tooltip>
          )}
          <Action ref={next} className="px-4" onClick={() => api().goGuide(index + 1)}>
            {last ? t("tour.finish") : t("tour.next")}
            {last ? null : <ChevronRight className="-mr-1 size-4" />}
          </Action>
          <Tooltip label={t("tour.exit")}>
            <IconButton
              aria-label={t("tour.exit")}
              onClick={() => api().endGuide()}
              className="rounded-full"
            >
              <X className="size-4" />
            </IconButton>
          </Tooltip>
        </div>
      </div>
    </section>
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

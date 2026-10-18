import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useEffect, useRef } from "react";

import { HandoffLink } from "@/components/simulations/handoff-link";
import { proseArgs } from "@/lib/facts";
import { Action, IconButton, PanelHeader, Tooltip, actionClass, cn } from "@horizon/toolkit/ui";

import { PROSE_FIGURES } from "../lib/model/catalogue";
import { TOUR } from "../lib/model/tour";
import { useOrrery } from "../lib/store";
import { formatYearsAgo } from "./format";

/** The tour card: one concept per step, with step navigation. The scene flies the camera. */
export function GuideCard() {
  const t = useTranslations("orrery");
  const f = useFormatter();
  const figures = proseArgs(PROSE_FIGURES, useLocale());
  const index = useOrrery((s) => s.guideStep);
  const yearsAgo = useOrrery((s) => s.yearsAgo);
  const playing = useOrrery((s) => s.playing);
  const view = useOrrery((s) => s.view);
  const next = useRef<HTMLButtonElement>(null);
  const step = TOUR[index] ?? TOUR[0]!;
  const last = index >= TOUR.length - 1;
  const api = useOrrery.getState;

  useEffect(() => {
    next.current?.focus({ preventScroll: true });
  }, []);

  return (
    <div className="pad-hud-bottom pointer-events-none absolute inset-x-0 bottom-0 z-[60]">
      <section
        className="glass-panel anim-rise pointer-events-auto mx-auto flex max-w-md flex-col gap-2.5 rounded-lg p-3.5 md:gap-3 md:p-4 short:mx-0 short:max-w-xs short:gap-2 short:p-3"
        aria-label={t("tour.label")}
      >
        <PanelHeader
          kicker={t("tour.progress", {
            step: index + 1,
            total: TOUR.length,
            time: formatYearsAgo(t, f, yearsAgo),
          })}
          title={t(`tour.steps.${step.id}.title`, figures)}
          onClose={() => api().endGuide()}
          closeLabel={t("tour.exit")}
        />
        {/* One live region for the whole tour, so every step is announced once. */}
        <div
          className="orrery-tour-body overflow-y-auto overscroll-contain"
          aria-live="polite"
          aria-atomic="true"
        >
          <div key={step.id} className="anim-fade">
            <p className="sr-only">{t(`tour.steps.${step.id}.title`, figures)}</p>
            <p className="text-sm leading-relaxed text-muted">
              {t(`tour.steps.${step.id}.body`, figures)}
            </p>
            {step.eq ? (
              <p className="mt-2 font-mono text-xs tracking-wide text-fg tabular-nums">
                {t(`tour.steps.${step.id}.eq`, { equation: step.equation?.toString() ?? "" })}
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-2">
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
          {/* The tour may run the clock; it can always be stopped (WCAG 2.2.2). */}
          {playing || step.playing ? (
            <Tooltip label={playing ? t("hud.pause") : t("hud.play")}>
              <IconButton
                aria-label={playing ? t("hud.pause") : t("hud.play")}
                active={playing}
                onClick={() => api().togglePlay()}
              >
                {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
              </IconButton>
            </Tooltip>
          ) : null}
          <ol className="flex flex-1 items-center justify-center gap-1.5" aria-hidden>
            {TOUR.map((s, i) => (
              <li
                key={s.id}
                className={cn(
                  "size-1.5 rounded-full transition-colors duration-300",
                  i === index ? "bg-accent" : i < index ? "bg-fg/40" : "bg-border-strong",
                )}
              />
            ))}
          </ol>
          {last ? (
            <HandoffLink
              to="deep-field"
              view={view}
              onClick={() => api().endGuide()}
              className={actionClass("ghost", "px-3")}
            >
              {t("tour.further")}
            </HandoffLink>
          ) : null}
          <Action ref={next} className="px-4" onClick={() => api().goGuide(index + 1)}>
            {last ? t("tour.finish") : t("tour.next")}
            {last ? null : <ChevronRight className="-mr-1 size-4" />}
          </Action>
        </div>
      </section>
    </div>
  );
}

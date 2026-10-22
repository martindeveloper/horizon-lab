"use client";

import * as SliderPrimitive from "@radix-ui/react-slider";
import { History } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, type KeyboardEvent } from "react";

import { HandoffLink } from "@/components/simulations/handoff-link";
import { formatAu } from "@/lib/facts";
import { isSolarView } from "@/space/solar-system/model/views";
import { WIDE_QUERY } from "@horizon/toolkit/environment";
import { LIGHT_YEAR_AU } from "@horizon/toolkit/science";
import { Tooltip, cn, sliderStopAt, useMediaQuery } from "@horizon/toolkit/ui";

import { RUNGS, depthOf, lyAtDepth } from "../lib/model/depth";
import { METHOD_OF } from "../lib/model/views";
import { useDeepField } from "../lib/store";

/* Down the left wherever a column fits beside the scene, a phone held sideways included. */
const useWide = () => useMediaQuery(WIDE_QUERY, true);

/** Ladder positions run 0..STEPS so a drag reads smoothly at any height. */
const STEPS = 1000;
const PREVIOUS = new Set(["ArrowUp", "ArrowLeft", "PageUp"]);
const NEXT = new Set(["ArrowDown", "ArrowRight", "PageDown"]);

/**
 * The depth ladder: the camera's distance on one log scale, from inside Mercury's orbit to
 * past the microwave background. Its thumb follows the zoom; dragging it zooms, a rung flies
 * to its view, arrow keys step from rung to rung. Above its near end, the same solar system
 * back in time, in the Orrery. Vertical down the left wherever there is width for a column
 * (a phone held sideways too), along the bottom on narrow phones.
 */
export function DepthLadder() {
  const t = useTranslations("deepField");
  const locale = useLocale();
  const wide = useWide();
  const view = useDeepField((s) => s.view);
  const viewLy = useDeepField((s) => s.viewLy);
  const unit = useDeepField((s) => s.distanceUnit);
  /* While a finger holds the thumb it shows where it was dragged, not the gliding zoom. */
  const [held, setHeld] = useState<number | null>(null);
  const depth = held ?? depthOf(viewLy);
  const current = RUNGS.findIndex((rung) => rung.id === view);

  /* Taking the ladder during the journey ends it: the camera is the visitor's again. */
  const takeOver = () => {
    const api = useDeepField.getState();
    if (api.guideOpen) api.endGuide();
    return api;
  };
  const go = (index: number) => {
    const rung = RUNGS[Math.max(0, Math.min(RUNGS.length - 1, index))];
    if (rung) takeOver().setView(rung.id);
  };
  const onKeyDown = (event: KeyboardEvent) => {
    const step = PREVIOUS.has(event.key) ? -1 : NEXT.has(event.key) ? 1 : 0;
    if (step === 0 && event.key !== "Home" && event.key !== "End") return;
    event.preventDefault();
    if (event.key === "Home") return go(0);
    if (event.key === "End") return go(RUNGS.length - 1);
    /* From between rungs, the next rung in that direction. */
    const ahead = RUNGS.findIndex((rung) => rung.depth > depth + 1e-3);
    const behind = RUNGS.filter((rung) => rung.depth < depth - 1e-3).length - 1;
    go(step > 0 ? (ahead < 0 ? RUNGS.length - 1 : ahead) : Math.max(0, behind));
  };
  const at = sliderStopAt;
  const valueText = `${t("hud.atDepth", {
    view: t(`views.${view}`),
    distance: formatAu(t, { unit, locale }, lyAtDepth(depth) * LIGHT_YEAR_AU),
  })}. ${t(`methods.${METHOD_OF[view]}`)}`;

  return (
    /* On wide screens it starts below the header row: the 2.5rem toolbar, taller than the caption's
       two clamped hint lines, and a 1.5rem gap. */
    <nav
      data-coach="depth"
      aria-label={t("hud.depth")}
      className={cn(
        "pointer-events-auto absolute z-30 flex items-center gap-2",
        wide
          ? "top-[calc(max(0.75rem,env(safe-area-inset-top))_+_4rem)] bottom-(--hud-clear,7rem) left-(--hud-gutter) w-36 flex-col items-start"
          : "inset-x-(--hud-gutter) bottom-[calc(var(--hud-clear,5.5rem)+0.5rem)] h-12",
      )}
    >
      <Tooltip label={t("hud.backInTime")} align="start">
        <HandoffLink
          to="orrery"
          view={isSolarView(view) ? view : "oort"}
          aria-label={t("hud.backInTime")}
          className="glass-hud flex size-9 shrink-0 items-center justify-center rounded-full text-accent transition-colors duration-feedback ease-standard hover:text-fg-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden"
        >
          <History className="size-4" aria-hidden />
        </HandoffLink>
      </Tooltip>
      <div className={cn("relative min-h-0 min-w-0 flex-1", wide ? "w-9" : "h-full")}>
        <SliderPrimitive.Root
          orientation={wide ? "vertical" : "horizontal"}
          inverted={wide}
          min={0}
          max={STEPS}
          step={1}
          value={[Math.round(depth * STEPS)]}
          onValueChange={([value = 0]) => {
            setHeld(value / STEPS);
            takeOver().seekTo(lyAtDepth(value / STEPS));
          }}
          onValueCommit={() => setHeld(null)}
          onKeyDown={onKeyDown}
          className={cn(
            "relative flex touch-none select-none",
            held === null && "deep-field-glide",
            wide ? "h-full w-9 flex-col items-center" : "h-full w-full items-center",
          )}
        >
          <SliderPrimitive.Track
            className={cn("relative grow rounded-full bg-space-fg/20", wide ? "w-px" : "h-px")}
          >
            <SliderPrimitive.Range
              className={cn("absolute bg-accent/50", wide ? "w-full" : "h-full")}
            />
          </SliderPrimitive.Track>
          <SliderPrimitive.Thumb
            aria-label={t("hud.depth")}
            aria-valuetext={valueText}
            className="slider-thumb size-3.5 bg-accent shadow-[0_0_14px_rgb(var(--solar)/0.5)]"
          />
        </SliderPrimitive.Root>
        {/* Rungs beside the track: a tick each, named when current or pointed at. Phones name the
            view in the sightline just below, so their ticks sit close over the track unnamed. */}
        {RUNGS.map((rung, i) => (
          <button
            key={rung.id}
            type="button"
            tabIndex={-1}
            aria-hidden
            onClick={() => go(i)}
            style={wide ? { top: at(rung.depth) } : { left: at(rung.depth) }}
            className={cn(
              "group absolute flex items-center gap-2",
              wide
                ? "left-6 -translate-y-1/2"
                : "bottom-[calc(50%+0.5rem)] -translate-x-1/2 after:absolute after:-inset-x-1 after:-inset-y-2",
            )}
          >
            <span
              className={cn(
                "block bg-space-fg/40 transition-colors duration-feedback ease-standard group-hover:bg-space-fg",
                wide ? "h-px w-2" : "h-2 w-px",
                i === current && "bg-accent",
              )}
            />
            <span
              className={cn(
                "deep-field-rung relative font-mono text-micro tracking-instrument whitespace-nowrap uppercase transition-opacity duration-feedback ease-standard",
                i === current
                  ? "text-space-fg opacity-100"
                  : "text-space-muted opacity-0 group-hover:opacity-100",
                !wide && "hidden",
              )}
            >
              {t(`views.${rung.id}`)}
              {/* How that distance is known; phones read it in the sightline. */}
              {wide && i === current ? (
                <span className="absolute top-full left-0 mt-1 w-32 text-left font-sans text-caption leading-snug tracking-normal text-pretty whitespace-normal text-space-muted normal-case">
                  {t(`methods.${METHOD_OF[rung.id]}`)}
                </span>
              ) : null}
            </span>
          </button>
        ))}
      </div>
    </nav>
  );
}

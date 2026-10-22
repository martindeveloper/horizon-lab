"use client";

import * as SliderPrimitive from "@radix-ui/react-slider";
import { useState, type PointerEvent } from "react";

import { convert, cssColor, encodeSrgb, hellandBlackbodyLinear } from "@horizon/toolkit/science";
import { SLIDER_THUMB_PX, Tooltip, cn, sliderStopAt } from "@horizon/toolkit/ui";

import { radiusMetres } from "../lib/model/catalogue";
import { LOOKS, type Look } from "../lib/model/looks";
import { rungNameKey } from "../lib/model/names";
import { RUNGS, RUNG_IDS } from "../lib/model/rungs";
import { BROWN_DWARF_ALKALI } from "../lib/parameters";
import { useGiants } from "../lib/store";
import { keyFigures, useDistance, useGiantsT } from "./format";

const LAST = RUNG_IDS.length - 1;
/** Dots sit where the thumb's centre stops for them. */
const at = sliderStopAt;
/** A dot's diameter, px, from the smallest body's to the largest's, by the log of the radius. */
const DOT_PX = [3, 11] as const;

const LOG_RADII = RUNG_IDS.map((id) => Math.log10(radiusMetres(id).radius));
const LOG_LOW = Math.min(...LOG_RADII);
const LOG_HIGH = Math.max(...LOG_RADII);

/**
 * The colour of a body's own light as the stage paints it: a blackbody (`hellandBlackbody`, the
 * shader's `blackbody`) at the temperature its face is drawn at, the display one where none is
 * catalogued (a pulsar's, a brown dwarf's, through its alkali lines); none for a planet or a
 * horizon, which shine by no light of their own.
 */
function lightOf(look: Look) {
  if (look.style === "earth" || look.style === "jupiter" || look.style === "horizon") return;
  const [r, g, b] = hellandBlackbodyLinear((look.equatorK + look.poleK) / 2);
  const [tr, tg, tb] = look.style === "brownDwarf" ? BROWN_DWARF_ALKALI : [1, 1, 1];
  return cssColor([encodeSrgb(r * tr), encodeSrgb(g * tg), encodeSrgb(b * tb)]);
}

/** Each body as a dot: as large as its size on a log scale, in the colour of its light. */
const DOTS = RUNGS.map((rung, index) => {
  const share = (LOG_RADII[index]! - LOG_LOW) / (LOG_HIGH - LOG_LOW);
  return {
    id: rung.id,
    kind: rung.kind,
    px: DOT_PX[0] + share * (DOT_PX[1] - DOT_PX[0]),
    colour: lightOf(LOOKS[index]!),
  };
});

/**
 * Where Earth's orbit (1 au) falls on the ladder, as a fractional rung: bodies past it, set in
 * the Sun's place, would swallow Earth.
 */
const EARTH_ORBIT = (() => {
  const log = Math.log10(convert(1, "au", "m"));
  const above = LOG_RADII.findIndex((value) => value > log);
  const below = above - 1;
  return below + (log - LOG_RADII[below]!) / (LOG_RADII[above]! - LOG_RADII[below]!);
})();

/** The body nearest a pointer over the strip, as the thumb's travel maps it. */
function bodyUnder(event: PointerEvent<HTMLElement>) {
  const box = event.currentTarget.getBoundingClientRect();
  const share = (event.clientX - box.left - SLIDER_THUMB_PX / 2) / (box.width - SLIDER_THUMB_PX);
  return Math.min(LAST, Math.max(0, Math.round(share * LAST)));
}

/**
 * The name and size of the body a mouse points at, gliding from dot to dot. Anchored by its
 * left edge at the ladder's start, its right at the end and its middle between, so it never
 * leaves the dock. It keeps its place as it fades out, so it fades rather than jumps.
 */
function HoverLabel({ index, shown }: { index: number; shown: boolean }) {
  const { t } = useGiantsT();
  const distance = useDistance();
  const id = RUNG_IDS[index]!;
  const share = index / LAST;
  return (
    <span
      aria-hidden
      style={{ left: at(share), transform: `translateX(${-share * 100}%)` }}
      className={cn(
        "glass-popover pointer-events-none absolute bottom-[calc(100%-0.5rem)] z-20 flex items-baseline gap-2 rounded-md px-2 py-1 whitespace-nowrap transition-[left,transform,opacity] duration-control ease-enter",
        shown ? "opacity-100" : "opacity-0",
      )}
    >
      <span className="text-xs text-fg">{t(rungNameKey(id))}</span>
      <span className="font-mono text-[11px] text-muted tabular-nums">
        {keyFigures(t, distance, id)[0]?.value}
      </span>
    </span>
  );
}

/**
 * The ladder in the dock: every body as a dot, sized and coloured as it is, the camera's place
 * as the thumb and the mark past which a star in the Sun's place would swallow Earth. Dragging,
 * a tap by a dot or the arrow keys climb, a body at a time; a mouse over it names the body
 * it points at.
 */
export function LadderStrip() {
  const { t } = useGiantsT();
  const place = useGiants((s) => s.place);
  const focus = useGiants((s) => s.focus);
  const [hover, setHover] = useState({ index: focus, shown: false });
  const point = (event: PointerEvent<HTMLElement>) => {
    if (event.pointerType !== "mouse") return;
    const index = bodyUnder(event);
    if (!hover.shown || index !== hover.index) setHover({ index, shown: true });
  };

  return (
    <div
      data-coach="ladder"
      className="relative h-11 w-full"
      onPointerMove={point}
      onPointerLeave={() => setHover((h) => ({ ...h, shown: false }))}
    >
      {/* The dots stand over the slider's track, the thumb over them. */}
      {DOTS.map((dot, index) => (
        <span
          key={dot.id}
          aria-hidden
          style={{ left: at(index / LAST), width: dot.px, height: dot.px, background: dot.colour }}
          className={cn(
            "pointer-events-none absolute top-4 z-[1] block -translate-1/2 rounded-full ring-1 ring-fg/25 transition-transform duration-control ease-enter",
            dot.kind === "planet" && "bg-muted",
            dot.kind === "horizon" && "bg-black ring-solar/80",
            hover.shown && hover.index === index && "scale-150",
          )}
        />
      ))}
      <HoverLabel index={hover.index} shown={hover.shown} />
      {/* Over the mark, its explanation takes the bodies' label's place. */}
      <span
        style={{ left: at(EARTH_ORBIT / LAST) }}
        className="absolute top-6 flex -translate-x-1/2 flex-col items-center gap-0.5"
        onPointerEnter={() => setHover((h) => ({ ...h, shown: false }))}
        onPointerMove={(event) => event.stopPropagation()}
      >
        <span aria-hidden className="block h-1.5 w-px bg-solar/80" />
        <Tooltip label={t("hud.swallowsEarthHint")} side="top" prose>
          <span className="cursor-help font-mono text-[9px] tracking-[0.12em] whitespace-nowrap text-muted uppercase">
            {t("hud.swallowsEarth")}
          </span>
          <span className="sr-only">{t("hud.swallowsEarthHint")}</span>
        </Tooltip>
      </span>
      <SliderPrimitive.Root
        min={0}
        max={LAST}
        step={1}
        value={[place]}
        onValueChange={([value = 0]) => useGiants.getState().go(value)}
        className="relative flex h-8 w-full touch-none items-center select-none"
      >
        <SliderPrimitive.Track className="relative h-px grow rounded-full bg-fg/20">
          <SliderPrimitive.Range className="absolute h-full bg-accent/50" />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb
          aria-label={t("hud.ladder")}
          aria-valuetext={t(rungNameKey(RUNG_IDS[focus]!))}
          className="relative z-[2] block size-3.5 rounded-full border-2 border-accent shadow-[0_0_12px_rgb(var(--solar)/0.45)] outline-hidden transition-transform duration-feedback ease-standard focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg active:scale-95"
        />
      </SliderPrimitive.Root>
    </div>
  );
}

"use client";

import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState, type CSSProperties } from "react";

import { SLIDER_THUMB_PX, Slider, cn } from "@horizon/toolkit/ui";

import {
  CHAPTERS,
  TRACK_CELLS,
  ageToSlider,
  chapterStart,
  sliderToAge,
} from "../lib/model/chapters";
import { TEMPO_STOPS, hushOf } from "../lib/model/pacing";
import { useAfterglow } from "../lib/store";
import { formatFromToday, formatYears } from "./format";

/** The slider's steps along the track. */
const STEPS = 1000;
/** The track's chapters and their names line up with the thumb's travel, inset by its radius. */
const TRAVEL = { marginInline: SLIDER_THUMB_PX / 2 };
/** The same travel as a box's edges, for a layer laid over the slider. */
const TRAVEL_BOX = { left: SLIDER_THUMB_PX / 2, right: SLIDER_THUMB_PX / 2 };
const CELLS = { ...TRAVEL, gridTemplateColumns: `repeat(${TRACK_CELLS}, minmax(0, 1fr))` };
/** Each chapter's stretch of the track: where it starts and ends, 0–1. */
const SEGMENTS = CHAPTERS.map((chapter) => {
  const start = chapterStart(chapter);
  return { id: chapter.id, cells: chapter.cells, start, end: start + chapter.cells / TRACK_CELLS };
});
/** A label's room: about this many CSS pixels per character of the caption type, and the cell's padding. */
const CHAR_PX = 6.4;
const LABEL_PAD_PX = 8;
/** The joins between chapters, cut from the line as hairline gaps (CSS px either side). */
const JOIN_PX = 1;
const JOINS: CSSProperties = {
  maskImage: `linear-gradient(to right, ${SEGMENTS.slice(1)
    .map(
      ({ start }) =>
        `#000 calc(${start * 100}% - ${JOIN_PX}px), transparent calc(${start * 100}% - ${JOIN_PX}px) calc(${start * 100}% + ${JOIN_PX}px), #000 calc(${start * 100}% + ${JOIN_PX}px)`,
    )
    .join(", ")})`,
};
/** The dawn's strength where time slows most: light over the line, never a bar. */
const DAWN_PEAK = 0.55;
/**
 * Where time slows, dawn light over the horizon line: the glow's strength along the track is
 * how much the tempo slows there, so the stretches ahead read before the playhead reaches them.
 */
const DAWN: CSSProperties = {
  ...TRAVEL,
  backgroundImage: `linear-gradient(to right, ${TEMPO_STOPS.map(
    ({ at, hush }) =>
      `rgb(var(--solar) / ${(hush * DAWN_PEAK).toFixed(3)}) ${(at * 100).toFixed(2)}%`,
  ).join(", ")})`,
};

/** The width of an element in CSS pixels, kept current as it resizes (0 until measured). */
function useWidth(element: React.RefObject<HTMLElement | null>) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const node = element.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(entry.contentRect.width);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [element]);
  return width;
}

/** The longest of a chapter's names that fits its cell whole; none when even the short one does not. */
function labelFor(names: readonly string[], cellPx: number) {
  return names.find((name) => name.length * CHAR_PX + LABEL_PAD_PX <= cellPx) ?? null;
}

/**
 * The timeline, the dock's horizon: the chapters as stretches of one line in proportion to
 * their seconds, gold up to the playhead; the playhead the house's sun under the horizon, a
 * gold half-disc on the line. Where the tempo slows the clock, dawn glows over the line, and
 * while the playhead is in such a stretch its sun wears a corona that widens and breathes more
 * slowly the more time slows. A drag scrubs and pauses the clock; a chapter's name goes there.
 * Phones name only the chapter the clock is in.
 */
export function Timeline() {
  const t = useTranslations("afterglow");
  const f = useFormatter();
  const locale = useLocale();
  const age = useAfterglow((s) => s.age);
  const view = useAfterglow((s) => s.view);
  const playing = useAfterglow((s) => s.playing);
  const tempo = useAfterglow((s) => s.tempo);
  const names = useRef<HTMLDivElement>(null);
  const width = useWidth(names);
  const at = ageToSlider(age);
  const hush = playing ? hushOf(tempo) : 0;
  const current = SEGMENTS.find((segment) => segment.id === view) ?? SEGMENTS[0]!;
  const late = current.start > 0.5;
  const api = useAfterglow.getState;
  return (
    <div data-coach="timeline">
      <div className="relative">
        {/* The dawn over the stretches where time slows, rising from the line. */}
        <div
          aria-hidden
          className="afterglow-dawn pointer-events-none absolute inset-x-0 bottom-1/2 h-3"
          style={DAWN}
        />
        {/* The drag and the keys; its own thumb is an invisible handle, the sun below is drawn from the same value as the line. */}
        <Slider
          aria-label={t("hud.timeline")}
          min={0}
          max={STEPS}
          step={1}
          value={[Math.round(at * STEPS)]}
          valueText={(v) => {
            const moment = sliderToAge(v / STEPS);
            return `${formatYears(t, f, moment, locale)} · ${formatFromToday(t, f, moment, locale)}`;
          }}
          onValueChange={([v]) => api().setAge(sliderToAge((v ?? 0) / STEPS))}
          trackClassName="bg-transparent"
          rangeClassName="hidden"
          thumbClassName="bg-transparent"
        />
        {/*
         * The line and its sun in one box spanning the thumb's travel, both placed from the
         * same share of it, so the sun always stands where the gold ends; the box holds the
         * line's thickness, which the sun fills as its base.
         */}
        <div
          aria-hidden
          className="afterglow-track pointer-events-none absolute inset-y-0 flex items-center"
          style={TRAVEL_BOX}
        >
          <div className="afterglow-horizon relative w-full rounded-full">
            <div className="absolute inset-0 rounded-full bg-fg-primary/20" style={JOINS}>
              <div
                className="absolute inset-y-0 left-0 bg-accent"
                style={{ width: `${at * 100}%` }}
              />
            </div>
          </div>
          <span
            className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${at * 100}%` }}
          >
            <span
              className="afterglow-sun slider-halo block size-3.5 rounded-full"
              style={{ "--halo": hush }}
            />
          </span>
        </div>
      </div>
      <div
        ref={names}
        role="group"
        aria-label={t("hud.chapters")}
        className="-mt-1.5 hidden md:grid"
        style={CELLS}
      >
        {SEGMENTS.map((segment) => {
          const here = segment.id === view;
          const cellPx = (width * segment.cells) / TRACK_CELLS;
          return (
            <button
              key={segment.id}
              type="button"
              aria-pressed={here}
              aria-label={t(`views.${segment.id}`)}
              style={{ gridColumn: `span ${segment.cells}` }}
              onClick={() => api().setView(segment.id)}
              className={cn(
                "h-4 overflow-hidden rounded-compact text-caption leading-4 tracking-wide whitespace-nowrap ui-focus transition-colors duration-feedback ease-standard",
                here ? "font-medium text-accent" : "text-fg-tertiary ui-quiet",
              )}
            >
              {labelFor([t(`views.${segment.id}`), t(`viewsShort.${segment.id}`)], cellPx)}
            </button>
          );
        })}
      </div>
      {/* Phones name only the chapter the clock is in, from its stretch's start, or to its end in the track's later half. */}
      <p
        className={cn(
          "-mt-1.5 h-4 text-caption leading-4 font-medium tracking-wide whitespace-nowrap text-accent md:hidden",
          late && "text-right",
        )}
        style={
          late
            ? { ...TRAVEL, paddingRight: `${(1 - current.end) * 100}%` }
            : { ...TRAVEL, paddingLeft: `${current.start * 100}%` }
        }
      >
        {t(`views.${view}`)}
      </p>
    </div>
  );
}

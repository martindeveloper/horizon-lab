"use client";

import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState, type RefObject } from "react";

import { RateStepper } from "@/components/simulations/rate-stepper";
import { useDockClearance, type DockInTheWay } from "@/components/simulations/use-dock-clearance";
import { asideOpen } from "@/lib/scene-store";
import { MAPS } from "@horizon/toolkit/bodies";
import { Dock, Orb, SLIDER_THUMB_PX, cn } from "@horizon/toolkit/ui";

import { PACES, paceValue, playRate } from "../lib/model/chapters";
import { clockPaused } from "../lib/model/modes";
import { MARKER_SLIDE_S } from "../lib/model/parameters";
import { WORLDS, WORLD_IDS, lostBy, type WorldId } from "../lib/model/worlds";
import { useAfterglow } from "../lib/store";
import { formatFromToday, formatPace, formatSince, formatYears } from "./format";
import { Timeline } from "./timeline";

/** The dock never moves for a side panel; where it reaches the panel column, cards end above it. */
const reachesPanels: DockInTheWay = (dock, stage, rem) => dock.right + 22 * rem > stage.right;

/** A world's mark: its measured map's mean colour. */
export const WORLD_COLOUR: Readonly<Record<WorldId, string>> = {
  earth: MAPS.earth?.mean ?? "#5b7fb5",
  mars: MAPS.mars?.mean ?? "#b4694a",
  europa: MAPS.europa?.mean ?? "#c9b9a6",
  enceladus: MAPS.enceladus?.mean ?? "#ededed",
  pluto: MAPS.pluto?.mean ?? "#b8a690",
};

/** Years a real second covers now: the chapter's rate at the pace, slowed by the tempo. */
const useYearsPerSecond = () => {
  const age = useAfterglow((s) => s.age);
  const pace = useAfterglow((s) => s.pace);
  const tempo = useAfterglow((s) => s.tempo);
  return playRate(age) * paceValue(pace) * tempo;
};

/** The clock's pace as words: what a real second covers now. */
function ClockCaption() {
  const t = useTranslations("afterglow");
  const f = useFormatter();
  const locale = useLocale();
  const paused = useAfterglow(clockPaused);
  const yearsPerSecond = useYearsPerSecond();
  if (paused) return t("hud.paused");
  return formatPace(t, f, yearsPerSecond, locale, true);
}

/** The autoplay's caption: the world the view is over, then the clock's pace, since nothing else there says where the view has moved. */
export function DriftCaption() {
  const t = useTranslations("afterglow");
  const world = useAfterglow((s) => s.drawn);
  return (
    <>
      {t(`names.${world}`)} · <ClockCaption />
    </>
  );
}

/** Play, slower, the pace, faster. */
function Clock() {
  const t = useTranslations("afterglow");
  const f = useFormatter();
  const locale = useLocale();
  const playing = useAfterglow((s) => s.playing);
  const pace = useAfterglow((s) => s.pace);
  const yearsPerSecond = useYearsPerSecond();
  const index = PACES.findIndex((p) => p.id === pace);
  const api = useAfterglow.getState;
  return (
    <RateStepper
      label={t("hud.clock")}
      coach="clock"
      running={playing}
      toggleLabel={playing ? t("hud.pause") : t("hud.play")}
      onToggle={() => api().togglePlaying()}
      slowerLabel={t("hud.slower")}
      fasterLabel={t("hud.faster")}
      onSlower={() => api().stepPace(-1)}
      onFaster={() => api().stepPace(1)}
      slowerDisabled={index <= 0}
      fasterDisabled={index >= PACES.length - 1}
      readout={t(`ratesShort.${pace}`)}
      spoken={formatPace(t, f, yearsPerSecond, locale)}
    />
  );
}

/**
 * Where the playhead stands, on its own line just over the timeline: the age, then how far that
 * is from today; between them, where the clock runs finer than those show, the time since the
 * chapter began. A line of its own, so the words' changing length never moves the controls.
 */
function Age() {
  const t = useTranslations("afterglow");
  const f = useFormatter();
  const locale = useLocale();
  const age = useAfterglow((s) => s.age);
  const since = formatSince(t, f, age, locale);
  return (
    <p
      className="mt-1 truncate font-mono text-sm text-fg-primary tabular-nums"
      style={{ paddingInline: SLIDER_THUMB_PX / 2 }}
    >
      {formatYears(t, f, age, locale, true)}
      {since !== null && <> · {since}</>}
      <span className="text-fg-secondary"> · {formatFromToday(t, f, age, locale, true)}</span>
    </p>
  );
}

/** Where a world's button sits in the row, kept current as the row lays out (null until measured). */
function usePlaceInRow(row: RefObject<HTMLDivElement | null>, world: WorldId) {
  const [place, setPlace] = useState<{ left: number; width: number } | null>(null);
  useEffect(() => {
    const within = row.current;
    const button = within?.querySelector<HTMLElement>(`[data-world="${world}"]`);
    if (!within || !button) return;
    const observer = new ResizeObserver(() =>
      setPlace({ left: button.offsetLeft, width: button.offsetWidth }),
    );
    observer.observe(within);
    observer.observe(button);
    return () => observer.disconnect();
  }, [row, world]);
  return place;
}

/**
 * The worlds to stand on, in a row outward from the Sun: the one stood on lit, a swallowed one
 * struck through. A gold line under the one stood on slides to the next as the view moves
 * there (`MARKER_SLIDE_S`), so the row shows the move as a route.
 */
function Worlds() {
  const t = useTranslations("afterglow");
  const world = useAfterglow((s) => s.world);
  const row = useRef<HTMLDivElement>(null);
  const here = usePlaceInRow(row, world);
  /* Only which worlds are gone, not the age: the row redraws when one is lost, not every tick. */
  const lostKey = useAfterglow((s) =>
    WORLD_IDS.filter((id) => lostBy(WORLDS[id].orbit, s.age)).join(),
  );
  const lostOnes = lostKey.split(",");
  return (
    <div
      role="group"
      aria-label={t("hud.worlds")}
      data-coach="worlds"
      ref={row}
      className="relative flex min-w-0 items-center gap-1 overflow-x-auto"
    >
      {WORLD_IDS.map((id) => {
        const lost = lostOnes.includes(id);
        const standing = id === world;
        return (
          <button
            key={id}
            type="button"
            data-world={id}
            aria-pressed={standing}
            aria-label={lost ? t("hud.worldLost", { name: t(`names.${id}`) }) : t(`names.${id}`)}
            onClick={() => {
              const api = useAfterglow.getState();
              if (standing) api.select(api.selection === id ? null : id);
              else api.standOn(id);
            }}
            className={cn(
              "flex min-h-9 items-center gap-1.5 rounded-control ui-row px-2 text-ui tracking-wide whitespace-nowrap ui-focus transition-colors duration-feedback ease-standard",
              standing ? "text-fg-primary" : "text-fg-secondary",
              lost && "line-through opacity-60",
            )}
          >
            <Orb color={WORLD_COLOUR[id]} size={standing ? 10 : 8} />
            <span className="not-md:sr-only">{t(`names.${id}`)}</span>
          </button>
        );
      })}
      {here === null ? null : (
        <span
          aria-hidden
          className="pointer-events-none absolute bottom-0.5 h-0.5 rounded-full bg-accent transition-[left,width] ease-standard motion-reduce:transition-none"
          style={{ left: here.left, width: here.width, transitionDuration: `${MARKER_SLIDE_S}s` }}
        />
      )}
    </div>
  );
}

/** The dock: the clock and the worlds (one row on wide screens, two on phones), then the playhead's age over the timeline. */
export function AfterglowDock() {
  const surface = useRef<HTMLDivElement>(null);
  const aside = useAfterglow(asideOpen);
  useDockClearance(surface, reachesPanels);
  /* The guide's caption stands on the dock at every width, so its clearance is published always. */
  useDockClearance(surface, undefined, "--dock-clear");
  return (
    <Dock ref={surface} className={cn("flex flex-col gap-1", aside && "not-md:hidden")}>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <Clock />
        <Worlds />
      </div>
      <Age />
      <Timeline />
    </Dock>
  );
}

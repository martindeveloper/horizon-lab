"use client";

import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useRef } from "react";

import { RateStepper } from "@/components/simulations/rate-stepper";
import { useDockClearance, type DockInTheWay } from "@/components/simulations/use-dock-clearance";
import { asideOpen } from "@/lib/scene-store";
import { MAPS } from "@horizon/toolkit/bodies";
import { Dock, Orb, SLIDER_THUMB_PX, cn } from "@horizon/toolkit/ui";

import { PACES, paceValue, playRate } from "../lib/model/chapters";
import { WORLDS, WORLD_IDS, lostBy, type WorldId } from "../lib/model/worlds";
import { useAfterglow } from "../lib/store";
import { formatFromToday, formatPace, formatYears } from "./format";
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
export function ClockCaption() {
  const t = useTranslations("afterglow");
  const f = useFormatter();
  const locale = useLocale();
  const playing = useAfterglow((s) => s.playing);
  const yearsPerSecond = useYearsPerSecond();
  if (!playing) return t("hud.paused");
  return formatPace(t, f, yearsPerSecond, locale, true);
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
 * is from today. A line of its own, so the words' changing length never moves the controls.
 */
function Age() {
  const t = useTranslations("afterglow");
  const f = useFormatter();
  const locale = useLocale();
  const age = useAfterglow((s) => s.age);
  return (
    <p
      className="mt-1 truncate font-mono text-sm text-fg-primary tabular-nums"
      style={{ paddingInline: SLIDER_THUMB_PX / 2 }}
    >
      {formatYears(t, f, age, locale, true)}
      <span className="text-fg-secondary"> · {formatFromToday(t, f, age, locale, true)}</span>
    </p>
  );
}

/** The worlds to stand on, in a row: the one stood on lit, a swallowed one struck through. */
function Worlds() {
  const t = useTranslations("afterglow");
  const world = useAfterglow((s) => s.world);
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
      className="flex min-w-0 items-center gap-1 overflow-x-auto"
    >
      {WORLD_IDS.map((id) => {
        const lost = lostOnes.includes(id);
        const here = id === world;
        return (
          <button
            key={id}
            type="button"
            aria-pressed={here}
            aria-label={lost ? t("hud.worldLost", { name: t(`names.${id}`) }) : t(`names.${id}`)}
            onClick={() => {
              const api = useAfterglow.getState();
              if (here) api.select(api.selection === id ? null : id);
              else api.standOn(id);
            }}
            className={cn(
              "flex min-h-9 items-center gap-1.5 rounded-control ui-row px-2 text-ui tracking-wide whitespace-nowrap ui-focus transition-colors duration-feedback ease-standard",
              here ? "text-fg-primary" : "text-fg-secondary",
              lost && "line-through opacity-60",
            )}
          >
            <Orb color={WORLD_COLOUR[id]} size={here ? 10 : 8} />
            <span className="not-md:sr-only">{t(`names.${id}`)}</span>
          </button>
        );
      })}
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

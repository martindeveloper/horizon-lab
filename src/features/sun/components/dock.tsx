"use client";

import { Pause, Play } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { useDockClearance, type DockInTheWay } from "@/components/simulations/use-dock-clearance";
import { asideOpen } from "@/lib/scene-store";
import {
  Chip,
  Dock,
  IconButton,
  ListItem,
  Picker,
  Slider,
  Tooltip,
  cn,
  kickerClass,
} from "@horizon/toolkit/ui";

import { CLOCK_RATES } from "../lib/model/clock";
import { LIGHT_MODES, LIGHT_SCALE } from "../lib/model/lights";
import { cycleStageAt, eruptionStageAt } from "../lib/model/stages";
import { VIEW_ACTION, type ViewAction } from "../lib/model/views";
import { CUT_HALF_ANGLE } from "../lib/parameters";
import { useSun } from "../lib/store";
import { elapsedLabel, lightLegend, useDistance } from "./format";
import { PlaceStrip } from "./place-strip";

/**
 * The dock never moves for a side panel. Only where its centred width reaches the panel
 * column (w-80 on the HUD gutter) do the card and rail end above it.
 */
const reachesPanels: DockInTheWay = (dock, stage, rem) => dock.right + 22 * rem > stage.right;

/** The whole wedge the cut opens, degrees. */
const CUT_DEGREES = (2 * CUT_HALF_ANGLE * 180) / Math.PI;

/** The ruler's last stop, and where a stop's centre falls along it (the thumb's travel, `size-3.5`). */
const LAST_STOP = LIGHT_SCALE.length - 1;
const THUMB_PX = 14;
const stopAt = (share: number) => `calc(${THUMB_PX / 2}px + ${share} * (100% - ${THUMB_PX}px))`;

/**
 * The light as a temperature ruler: one scale from the photosphere's white light up through
 * Hα and the EUV lines to flare plasma, the track painted in each light's colour, a stop and a
 * short name at each line, the thumb on the one shown. The two ways of looking that are not
 * temperatures, the eclipse and the magnetogram, stand at its end as switches; while one is on
 * the ruler rests, dimmed, where it last stood.
 */
function LightRuler() {
  const t = useTranslations("sun");
  const light = useSun((s) => s.light);
  const api = useSun.getState;
  const onScale = (LIGHT_SCALE as readonly string[]).indexOf(light);
  const [rested, setRested] = useState(Math.max(0, onScale));
  const shown = onScale >= 0 ? onScale : rested;
  return (
    <div data-coach="light" className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <div className={cn("relative min-w-0 flex-1 basis-56 pb-3", onScale < 0 && "opacity-40")}>
        {/* A stop and its name at each line, under the thumb; the names only where there is room. */}
        {LIGHT_SCALE.map((id, index) => (
          <span
            key={id}
            aria-hidden
            style={{ left: stopAt(index / LAST_STOP) }}
            className="pointer-events-none absolute top-4 flex -translate-x-1/2 flex-col items-center"
          >
            <span className="block h-2 w-px -translate-y-1 bg-fg/35" />
            <span
              className={cn(
                "mt-1 font-mono text-[10px] leading-none tabular-nums not-md:hidden",
                index === shown && onScale >= 0 ? "text-fg" : "text-subtle",
              )}
            >
              {t(`lightShort.${id}`)}
            </span>
          </span>
        ))}
        <Slider
          aria-label={t("hud.light")}
          trackClassName="sun-light-scale h-0.5"
          rangeClassName="bg-transparent"
          min={0}
          max={LAST_STOP}
          step={1}
          value={[shown]}
          valueText={(index) => t(`lights.${LIGHT_SCALE[index] ?? light}`)}
          onValueChange={([index]) => api().setLight(LIGHT_SCALE[index ?? 0] ?? "white")}
        />
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {LIGHT_MODES.map((id) => (
          <Chip
            key={id}
            selected={light === id}
            aria-pressed={light === id}
            className="not-md:h-9"
            onClick={() => {
              if (light === id) {
                api().setLight(LIGHT_SCALE[rested] ?? "white");
                return;
              }
              if (onScale >= 0) setRested(onScale);
              api().setLight(id);
            }}
          >
            {t(`lights.${id}`)}
          </Chip>
        ))}
      </div>
    </div>
  );
}

/** The light shown, named, with what it shows and the figures it answers to. */
function LightLegend() {
  const t = useTranslations("sun");
  const distance = useDistance();
  const light = useSun((s) => s.light);
  return (
    <p className="min-w-0 flex-1 basis-48 text-sm leading-snug tracking-tight">
      <span className="text-fg">{t(`lights.${light}`)}</span>
      <span className={cn(kickerClass, "ml-2 tracking-normal normal-case")}>
        {t(`lightNotes.${light}`)} · {lightLegend(t, distance, light)}
      </span>
    </p>
  );
}

/** Room for the widest everyday reading ("399.9 d"), so a new digit or unit doesn't nudge the pill. */
const ELAPSED_CLASS = "inline-block min-w-[9ch] text-right";

/** The clock: a pause, and a pill with the rate as the Orrery words it (1 s = 1 day), the time passed beside it. */
function Clock() {
  const t = useTranslations("sun");
  const f = useFormatter();
  const clock = useSun((s) => s.clock);
  const paused = useSun((s) => s.paused);
  const elapsed = useSun((s) => s.elapsed);
  const [open, setOpen] = useState(false);
  const api = useSun.getState;
  const label = paused ? t("hud.play") : t("hud.pause");
  return (
    <div data-coach="clock" className="flex items-center gap-2">
      <Tooltip label={label} side="top">
        <IconButton aria-label={label} active={paused} onClick={() => api().togglePaused()}>
          {paused ? <Play className="size-4" /> : <Pause className="size-4" />}
        </IconButton>
      </Tooltip>
      <Picker
        aria-label={t("hud.clock")}
        label={paused ? t("hud.paused") : t(`clocks.${clock}`)}
        detail={<span className={ELAPSED_CLASS}>{elapsedLabel(t, f, elapsed)}</span>}
        open={open}
        onOpenChange={setOpen}
        panelClassName="top-auto bottom-[calc(100%+0.5rem)] scroll-thin"
      >
        {CLOCK_RATES.map((rate) => (
          <ListItem
            key={rate}
            selected={rate === clock && !paused}
            onClick={() => {
              api().setClock(rate);
              setOpen(false);
            }}
          >
            {t(`clocks.${rate}`)}
          </ListItem>
        ))}
      </Picker>
    </div>
  );
}

/** What the action's button says and does, and what its slider holds. */
function useAction(kind: ViewAction) {
  const t = useTranslations("sun");
  const f = useFormatter();
  const cut = useSun((s) => s.cut);
  const eruption = useSun((s) => s.eruption);
  const playing = useSun((s) => s.eruptionPlaying);
  const flareClass = useSun((s) => s.flareClass);
  const phase = useSun((s) => s.cyclePhase);
  const year = useSun((s) => s.cycleYear);
  const clock = useSun((s) => s.clock);
  const paused = useSun((s) => s.paused);
  const api = useSun.getState;
  switch (kind) {
    case "cut": {
      const open = cut > 0;
      return {
        on: open,
        button: t(open ? "hud.cutClose" : "hud.cutOpen"),
        act: () => api().setCut(open ? 0 : 1),
        value: cut,
        set: (next: number) => api().setCut(next),
        text: f.number(cut * CUT_DEGREES, {
          style: "unit",
          unit: "degree",
          unitDisplay: "narrow",
          maximumFractionDigits: 0,
        }),
      };
    }
    case "eruption": {
      const stage = t(`stages.eruption.${eruptionStageAt(eruption)}`);
      return {
        on: playing,
        button: t(playing ? "hud.eruptionPause" : "hud.eruptionPlay"),
        act: () => api().toggleEruptionPlaying(),
        value: eruption,
        set: (next: number) => api().setEruption(next),
        text: flareClass ? `${stage} · ${t("hud.flareClass", { value: flareClass })}` : stage,
      };
    }
    default: {
      const running = clock === "year" && !paused;
      return {
        on: running,
        button: t(running ? "hud.cycleHold" : "hud.cycleRun"),
        act: () => (running ? api().togglePaused() : api().setClock("year")),
        value: phase,
        set: (next: number) => api().setCyclePhase(next),
        text: `${t("hud.modelYear", { value: f.number(Math.floor(year), { useGrouping: false }) })} · ${t(`stages.cycle.${cycleStageAt(phase)}`)}`,
      };
    }
  }
}

/**
 * The view's own action, worded as what it does: open the cut, let the flare go, run the
 * years; a slider scrubs it and a readout names where it stands.
 */
function ViewActionRow({ kind }: { kind: ViewAction }) {
  const t = useTranslations("sun");
  const { on, button, act, value, set, text } = useAction(kind);
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 md:flex-nowrap">
      <Chip selected={on} aria-pressed={on} onClick={act} className="shrink-0 not-md:h-9">
        {button}
      </Chip>
      <Slider
        aria-label={t(`hud.${kind}`)}
        className="w-24 md:w-32"
        min={0}
        max={1}
        step={0.005}
        value={[value]}
        valueText={() => text}
        onValueChange={([next]) => set(next ?? 0)}
      />
      <span className="font-mono text-xs text-fg tabular-nums not-md:basis-full md:truncate">
        {text}
      </span>
    </div>
  );
}

export function SunDock() {
  const view = useSun((s) => s.view);
  /* Phones give an open sheet or card the bottom of the screen. */
  const aside = useSun(asideOpen);
  const surface = useRef<HTMLDivElement>(null);
  useDockClearance(surface, reachesPanels);
  const action = VIEW_ACTION[view];
  return (
    <Dock
      ref={surface}
      footerClassName={cn(aside && "not-md:hidden")}
      className="anim-rise flex flex-col gap-2"
    >
      <PlaceStrip />
      <LightRuler />
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <LightLegend />
        <Clock />
        {action ? <ViewActionRow kind={action} /> : null}
      </div>
    </Dock>
  );
}

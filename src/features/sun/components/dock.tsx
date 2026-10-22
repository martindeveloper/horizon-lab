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
import { LIGHT_IDS } from "../lib/model/lights";
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

/**
 * The lights as a strip of dots in the dial's order, from the photosphere out to the hottest
 * plasma, then the eclipse and the magnetogram; the chosen one is lit and named beside it.
 */
function LightStrip() {
  const t = useTranslations("sun");
  const f = useFormatter();
  const distance = useDistance();
  const light = useSun((s) => s.light);
  return (
    <div className="flex min-w-0 items-center gap-2">
      <div
        role="radiogroup"
        aria-label={t("hud.light")}
        className="relative flex items-center before:absolute before:inset-x-3 before:top-1/2 before:h-px before:bg-fg/15 before:content-['']"
      >
        {LIGHT_IDS.map((id) => (
          <Tooltip key={id} label={t(`lights.${id}`)} side="top">
            <button
              type="button"
              role="radio"
              aria-checked={id === light}
              aria-label={t(`lights.${id}`)}
              className="relative flex size-7 items-center justify-center rounded-full focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden md:size-6"
              onClick={() => useSun.getState().setLight(id)}
            >
              <span
                className="sun-light-dot"
                data-light={id}
                data-on={id === light ? "" : undefined}
                aria-hidden
              />
            </button>
          </Tooltip>
        ))}
      </div>
      <span className="flex min-w-0 flex-col leading-tight">
        <span className="truncate text-sm tracking-tight text-fg">{t(`lights.${light}`)}</span>
        <span className={cn(kickerClass, "hidden truncate tracking-normal normal-case lg:inline")}>
          {t(`lightNotes.${light}`)} · {lightLegend(t, f, distance, light)}
        </span>
      </span>
    </div>
  );
}

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
    <div className="flex items-center gap-2">
      <Tooltip label={label} side="top">
        <IconButton aria-label={label} active={paused} onClick={() => api().togglePaused()}>
          {paused ? <Play className="size-4" /> : <Pause className="size-4" />}
        </IconButton>
      </Tooltip>
      <Picker
        aria-label={t("hud.clock")}
        label={paused ? t("hud.paused") : t(`clocks.${clock}`)}
        detail={elapsedLabel(t, f, elapsed)}
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
        text: `${f.number(Math.floor(year), { useGrouping: false })} · ${t(`stages.cycle.${cycleStageAt(phase)}`)}`,
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
    <div className="flex min-w-0 items-center gap-3">
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
      <span className="truncate font-mono text-xs text-fg tabular-nums">{text}</span>
    </div>
  );
}

/** The dock: the view's places as a strip, then one row of the light strip, the clock and the view's action. */
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
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <LightStrip />
        <Clock />
        {action ? <ViewActionRow kind={action} /> : null}
      </div>
    </Dock>
  );
}

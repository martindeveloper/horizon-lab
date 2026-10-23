"use client";

import { Pause, Play } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useRef, useState, type ReactNode } from "react";

import { RateStepper } from "@/components/simulations/rate-stepper";
import { useDockClearance, type DockInTheWay } from "@/components/simulations/use-dock-clearance";
import { asideOpen } from "@/lib/scene-store";
import { rampColor } from "@/space/sun/model/passbands";
import { cssColor, encodeSrgb } from "@horizon/toolkit/science";
import {
  Dock,
  IconButton,
  LabelledRow,
  Slider,
  SwitchChip,
  Tooltip,
  cn,
  sliderStopAt,
} from "@horizon/toolkit/ui";

import { CLOCK_RATES } from "../lib/model/clock";
import { LIGHT_LOOKS, LIGHT_SCALE } from "../lib/model/lights";
import { cycleStageAt, eruptionStageAt } from "../lib/model/stages";
import { VIEW_ACTION, type ViewAction } from "../lib/model/views";
import { CUT_HALF_ANGLE } from "../lib/parameters";
import { useSun } from "../lib/store";
import { ROW_CLASS, ROWS_CLASS, RowLabel } from "./dock-rows";
import { elapsedLabel, lightLegend, useDistance } from "./format";
import { ParkerReadout, ParkerRide } from "./parker-readout";
import { PlaceStrip } from "./place-strip";

/**
 * The dock never moves for a side panel. Only where its centred width reaches the panel
 * column (w-80 on the HUD gutter) do the card and rail end above it.
 */
const reachesPanels: DockInTheWay = (dock, stage, rem) => dock.right + 22 * rem > stage.right;

/** The whole wedge the cut opens, degrees. */
const CUT_DEGREES = (2 * CUT_HALF_ANGLE * 180) / Math.PI;

/** The ruler's last stop. */
const LAST_STOP = LIGHT_SCALE.length - 1;
/** How bright along its ramp a light's colour is taken for the ruler's track. */
const RULER_BRIGHTNESS = 0.75;
/** The ruler's track: each light's own colour, from its ramp, under its stop. */
const RULER_TRACK = {
  background: `linear-gradient(90deg, ${LIGHT_SCALE.map((id, index) => {
    const [r, g, b] = rampColor(id, RULER_BRIGHTNESS);
    return `${cssColor([encodeSrgb(r), encodeSrgb(g), encodeSrgb(b)])} ${sliderStopAt(index / LAST_STOP)}`;
  }).join(", ")})`,
  opacity: 0.85,
};

/**
 * The light as a ruler of spectral modes, from the photosphere's white light up through Hα and
 * the EUV lines to flare plasma (not a temperature scale: several bands answer to more than one
 * temperature), the track painted in each light's colour, a stop and a short name at each line,
 * the thumb on the one shown. The two ways of looking that are not bands, the eclipse and the
 * magnetogram, stand at its end as switches; while one is on the ruler rests, dimmed, where it
 * last stood.
 */
function LightRuler({ className }: { className?: string }) {
  const t = useTranslations("sun");
  const light = useSun((s) => s.light);
  const api = useSun.getState;
  const onScale = (LIGHT_SCALE as readonly string[]).indexOf(light);
  const [rested, setRested] = useState(Math.max(0, onScale));
  const shown = onScale >= 0 ? onScale : rested;
  return (
    <LabelledRow
      data-coach="light"
      label={t("hud.light")}
      shown={<RowLabel>{t("hud.light")}</RowLabel>}
      className={className}
    >
      {/* Phones lay the ruler beside the label and the switches on a row of their own from the
          dock's edge; wider screens wrap both beside the label. */}
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-2 not-md:contents">
        <div className={cn("relative min-w-0 flex-1 basis-56 pb-3", onScale < 0 && "opacity-40")}>
          {/* A stop and its name at each line, under the thumb; the names only where there is room. */}
          {LIGHT_SCALE.map((id, index) => (
            <span
              key={id}
              aria-hidden
              style={{ left: sliderStopAt(index / LAST_STOP) }}
              className="pointer-events-none absolute top-4 flex -translate-x-1/2 flex-col items-center"
            >
              <span className="block h-2 w-px -translate-y-1 bg-fg-primary/35" />
              <span
                className={cn(
                  "mt-1 font-mono text-micro leading-none tabular-nums not-md:hidden",
                  index === shown && onScale >= 0 ? "text-fg-primary" : "text-fg-tertiary",
                )}
              >
                {t(`lightShort.${id}`)}
              </span>
            </span>
          ))}
          <Slider
            aria-label={t("hud.light")}
            trackClassName="h-0.5"
            trackStyle={RULER_TRACK}
            rangeClassName="bg-transparent"
            min={0}
            max={LAST_STOP}
            step={1}
            value={[shown]}
            valueText={(index) => t(`lights.${LIGHT_SCALE[index] ?? light}`)}
            onValueChange={([index]) => api().setLight(LIGHT_SCALE[index ?? 0] ?? "white")}
          />
        </div>
        <div className="flex max-w-full shrink-0 flex-wrap items-center gap-1 not-md:col-span-2">
          {LIGHT_LOOKS.map((id) => (
            <SwitchChip
              key={id}
              on={light === id}
              className="not-md:h-9"
              onToggle={() => {
                if (light === id) {
                  api().setLight(LIGHT_SCALE[rested] ?? "white");
                  return;
                }
                if (onScale >= 0) setRested(onScale);
                api().setLight(id);
              }}
            >
              {t(`lights.${id}`)}
            </SwitchChip>
          ))}
        </div>
      </div>
    </LabelledRow>
  );
}

/** The light shown, named, with what it shows and the figures it answers to. */
function LightLegend() {
  const t = useTranslations("sun");
  const distance = useDistance();
  const light = useSun((s) => s.light);
  return (
    <p className="min-w-0 flex-1 basis-48 text-body leading-snug tracking-tight not-md:basis-full short:hidden">
      <span className="text-fg-primary">{t(`lights.${light}`)}</span>
      <span className="ml-2 text-ui text-fg-secondary">
        {/* Phones keep to the light and its figure; the note waits for room. */}
        <span className="not-md:hidden">{t(`lightNotes.${light}`)} · </span>
        {lightLegend(t, distance, light)}
      </span>
    </p>
  );
}

/** Room for the widest everyday reading ("399.9 d"), so a new digit or unit doesn't nudge the row. */
const ELAPSED_CLASS =
  "inline-block min-w-[9ch] text-right font-mono text-ui text-fg-secondary tabular-nums";

/**
 * The clock: play or pause, its rate a step slower or faster, and the Sun's time passed beside
 * it, unless `elapsed` is off where a date names the time already.
 */
function Clock({ elapsed: showElapsed = true }: { elapsed?: boolean }) {
  const t = useTranslations("sun");
  const f = useFormatter();
  const clock = useSun((s) => s.clock);
  const paused = useSun((s) => s.paused);
  const elapsed = useSun((s) => s.elapsed);
  const api = useSun.getState;
  const index = CLOCK_RATES.indexOf(clock);
  return (
    <div data-coach="clock" className="flex items-center gap-2">
      <RateStepper
        label={t("hud.clock")}
        running={!paused}
        toggleLabel={paused ? t("hud.play") : t("hud.pause")}
        onToggle={() => api().togglePaused()}
        slowerLabel={t("hud.slower")}
        fasterLabel={t("hud.faster")}
        slowerDisabled={index === 0}
        fasterDisabled={index === CLOCK_RATES.length - 1}
        onSlower={() => api().setClock(CLOCK_RATES[index - 1] ?? clock)}
        onFaster={() => api().setClock(CLOCK_RATES[index + 1] ?? clock)}
        readout={t(`clocks.${clock}`)}
        readoutClassName={cn("min-w-20", paused ? "text-fg-tertiary" : "text-fg-primary")}
      />
      {showElapsed ? <span className={ELAPSED_CLASS}>{elapsedLabel(t, f, elapsed)}</span> : null}
    </div>
  );
}

/**
 * A view's own action: what starts or switches it, a slider that scrubs it and a readout that
 * names where it stands.
 */
function ActionRow({
  kind,
  control,
  value,
  onValue,
  text,
}: {
  kind: ViewAction;
  control?: ReactNode;
  value: number;
  onValue: (next: number) => void;
  text: string;
}) {
  const t = useTranslations("sun");
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 md:flex-nowrap">
      {control}
      <Slider
        aria-label={t(`hud.${kind}`)}
        className="w-24 md:w-32"
        min={0}
        max={1}
        step={0.005}
        value={[value]}
        valueText={() => text}
        onValueChange={([next]) => onValue(next ?? 0)}
      />
      <span className="font-mono text-ui text-fg-primary tabular-nums not-md:basis-full md:truncate">
        {text}
      </span>
    </div>
  );
}

/** The cut: a switch to open it whole or close it, its wedge scrubbed, its width in degrees. */
function CutAction() {
  const t = useTranslations("sun");
  const f = useFormatter();
  const cut = useSun((s) => s.cut);
  const api = useSun.getState;
  return (
    <ActionRow
      kind="cut"
      control={
        <SwitchChip
          on={cut > 0}
          onToggle={() => api().setCut(cut > 0 ? 0 : 1)}
          className="shrink-0 not-md:h-9"
        >
          {t("hud.cut")}
        </SwitchChip>
      }
      value={cut}
      onValue={(next) => api().setCut(next)}
      text={f.number(cut * CUT_DEGREES, {
        style: "unit",
        unit: "degree",
        unitDisplay: "narrow",
        maximumFractionDigits: 0,
      })}
    />
  );
}

/** The eruption: play or hold it, its moment scrubbed, its stage and the flare's class. */
function EruptionAction() {
  const t = useTranslations("sun");
  const eruption = useSun((s) => s.eruption);
  const playing = useSun((s) => s.eruptionPlaying);
  const flareClass = useSun((s) => s.flareClass);
  const api = useSun.getState;
  const label = playing ? t("hud.eruptionPause") : t("hud.eruptionPlay");
  const stage = t(`stages.eruption.${eruptionStageAt(eruption)}`);
  return (
    <ActionRow
      kind="eruption"
      control={
        <Tooltip label={label} side="top">
          <IconButton
            aria-label={label}
            active={playing}
            onClick={() => api().toggleEruptionPlaying()}
          >
            {playing ? <Pause className="icon" /> : <Play className="icon" />}
          </IconButton>
        </Tooltip>
      }
      value={eruption}
      onValue={(next) => api().setEruption(next)}
      text={flareClass ? `${stage} · ${t("hud.flareClass", { value: flareClass })}` : stage}
    />
  );
}

/** The cycle: its phase scrubbed (the clock runs the years), the year and the cycle's stage. */
function CycleAction() {
  const t = useTranslations("sun");
  const f = useFormatter();
  const phase = useSun((s) => s.cyclePhase);
  const year = useSun((s) => s.cycleYear);
  return (
    <ActionRow
      kind="cycle"
      value={phase}
      onValue={(next) => useSun.getState().setCyclePhase(next)}
      text={`${t("hud.modelYear", { value: f.number(Math.floor(year), { useGrouping: false }) })} · ${t(`stages.cycle.${cycleStageAt(phase)}`)}`}
    />
  );
}

const ACTIONS: Readonly<Record<ViewAction, () => ReactNode>> = {
  cut: CutAction,
  eruption: EruptionAction,
  cycle: CycleAction,
};

export function SunDock() {
  const view = useSun((s) => s.view);
  /* Phones give an open sheet or card the bottom of the screen. */
  const aside = useSun(asideOpen);
  const surface = useRef<HTMLDivElement>(null);
  useDockClearance(surface, reachesPanels);
  const kind = VIEW_ACTION[view];
  const Action = kind ? ACTIONS[kind] : null;
  return (
    <Dock
      ref={surface}
      footerClassName={cn(aside && "not-md:hidden")}
      className="relative flex anim-rise flex-col gap-2"
    >
      <div className={ROWS_CLASS}>
        <PlaceStrip className={cn(ROW_CLASS, "short:hidden")} />
        <LightRuler className={ROW_CLASS} />
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 not-md:gap-x-3">
        <LightLegend />
        {/* Parker's orbit reads the date beside the probe; the ride is its action. */}
        <Clock elapsed={view !== "orbit"} />
        {Action ? <Action key={kind} /> : null}
        {view === "orbit" ? <ParkerRide /> : null}
        {view === "orbit" ? <ParkerReadout /> : null}
      </div>
    </Dock>
  );
}

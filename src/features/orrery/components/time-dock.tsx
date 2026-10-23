import { CalendarClock, Pause, Play, RotateCcw } from "lucide-react";
import { useFormatter, useLocale, useNow, useTranslations } from "next-intl";
import { useRef } from "react";

import { MapScale } from "@/components/simulations/map-readouts";
import { useDockClearance, type DockInTheWay } from "@/components/simulations/use-dock-clearance";
import { proseArgs } from "@/lib/facts";
import { asideOpen } from "@/lib/scene-store";
import { SUN_BIRTH } from "@/space/solar-system/model/parameters";
import { convert } from "@horizon/toolkit/science";
import { Dock, IconButton, Slider, Tooltip, cn, sliderStopAt } from "@horizon/toolkit/ui";

import { PROSE_FIGURES } from "../lib/model/catalogue";
import { clockDate } from "../lib/model/events";
import {
  EPOCHS,
  MOMENTS,
  epochOf,
  galacticLaps,
  isToday,
  noteOf,
  sliderToYearsAgo,
  yearsAgoToSlider,
} from "../lib/model/timeline";
import { useOrrery } from "../lib/store";
import { formatYearsAgo } from "./format";
import { momentTitle, useMoments } from "./moments-panel";
import { DISPLAY, Switches } from "./view-controls";

/* Epochs sit at their true places on the track, alternating above and below it so
   neighbouring labels never meet, each where the thumb's centre stops for it. */
const STATIONS = EPOCHS.map((epoch, i) => ({
  ...epoch,
  at: yearsAgoToSlider(epoch.yearsAgo),
  below: i % 2 === 1,
}));
const trackX = sliderStopAt;
/* The dated milestones since the clearing, as ticks under the track where they fall. */
const TICKS = MOMENTS.map((moment) => ({ ...moment, at: yearsAgoToSlider(moment.yearsAgo) }));

/**
 * The dock never moves for a side panel. Only where its centred width reaches the panel
 * column (w-80 on the HUD gutter) do the card and rail end above it; on wide screens they
 * keep their full height.
 */
const reachesPanels: DockInTheWay = (dock, stage, rem) => dock.right + 22 * rem > stage.right;

/** "1 s ≈ 15 days": how fast the clock runs today's orbits on, or that it is paused at 0. */
export function motionRateLabel(
  t: ReturnType<typeof useTranslations<"orrery">>,
  f: ReturnType<typeof useFormatter>,
  rate: number,
) {
  if (rate === 0) return t("hud.clockPaused");
  if (rate < 1.2) return t("hud.driftDays", { value: Math.round(rate * 365) });
  if (rate < 800) return t("hud.driftYears", { value: Math.round(rate) });
  return t("hud.driftThousand", { value: f.number(rate / 1000, { maximumFractionDigits: 1 }) });
}

/** The timeline dock: date and playback, era note, epoch track, then the scale and display switches. */
export function TimeDock() {
  const t = useTranslations("orrery");
  const f = useFormatter();
  const locale = useLocale();
  const yearsAgo = useOrrery((s) => s.yearsAgo);
  const playing = useOrrery((s) => s.playing);
  const driftRate = useOrrery((s) => s.driftRate);
  const driftYears = useOrrery((s) => s.driftYears);
  const panel = useOrrery((s) => s.panel);
  const scalePx = useOrrery((s) => s.scalePx);
  const scaleValue = useOrrery((s) => s.scaleValue);
  const scaleUnit = useOrrery((s) => s.scaleUnit);
  // Phones give an open sheet or card the bottom of the screen.
  const aside = useOrrery(asideOpen);
  const surface = useRef<HTMLDivElement>(null);
  useDockClearance(surface, reachesPanels);
  const now = useNow({ updateInterval: 60_000 });
  const next = useMoments(now).find((event) => event.years > 0);
  const api = useOrrery.getState;
  const driftLabel = motionRateLabel(t, f, driftRate);
  /* The clock off today, run on by playing or set to a moment, either way from today. */
  const away = Math.abs(driftYears);
  const onClock = isToday(yearsAgo) && away > 0.002;
  let offset: string;
  if (away < 1) {
    offset = t("time.offsetDays", {
      value: Math.max(1, Math.round(convert(away, "yr", "d"))),
    });
  } else if (Math.round(away) < 1000) {
    offset = t("time.offsetYears", { value: Math.round(away) });
  } else {
    offset = t("time.offsetThousand", {
      value: f.number(Math.max(1, Math.round(away / 1000)), {
        maximumFractionDigits: 0,
      }),
    });
  }
  let subline: string;
  if (yearsAgo > SUN_BIRTH) {
    subline = t("time.noSun");
  } else if (isToday(yearsAgo)) {
    const date = f.dateTime(now, { dateStyle: "long" });
    subline = onClock
      ? t(driftYears > 0 ? "time.clockDrift" : "time.clockBack", { offset, rate: driftLabel })
      : next
        ? t("time.clockNext", { date, event: momentTitle(t, next) })
        : t("time.clock", { date });
  } else {
    subline = t("time.laps", {
      laps: f.number(galacticLaps(yearsAgo), {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }),
    });
  }
  const playLabel = t(playing ? "hud.pause" : "hud.play");
  return (
    <Dock ref={surface} footerClassName={cn(aside && "not-md:hidden")} className="flex flex-col">
      <div className="flex items-center gap-3">
        <div className="flex shrink-0 items-center gap-2 md:gap-1">
          <Tooltip label={playLabel}>
            <IconButton aria-label={playLabel} active={playing} onClick={() => api().togglePlay()}>
              {playing ? <Pause className="icon" /> : <Play className="icon" />}
            </IconButton>
          </Tooltip>
          <Tooltip label={t("hud.replay")}>
            <IconButton aria-label={t("hud.replay")} onClick={() => api().replay()}>
              <RotateCcw className="icon" />
            </IconButton>
          </Tooltip>
          <Tooltip label={t("hud.moments")}>
            <IconButton
              data-coach="moments"
              aria-label={t("hud.moments")}
              aria-expanded={panel === "moments"}
              aria-controls="orrery-moments"
              active={panel === "moments"}
              onClick={() => api().setPanel(panel === "moments" ? "none" : "moments")}
            >
              <CalendarClock className="icon" />
            </IconButton>
          </Tooltip>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-body/5 font-medium tracking-tight text-fg-primary tabular-nums md:text-panel md:leading-normal">
            {onClock
              ? f.dateTime(clockDate(now, driftYears), { dateStyle: "long" })
              : formatYearsAgo(t, f, yearsAgo)}
          </p>
          {/* Phones wrap into reserved lines, so scrubbing never makes the dock jump. */}
          <p className="text-ui text-fg-secondary tabular-nums not-md:line-clamp-2 not-md:min-h-8 md:truncate short:min-h-0 short:truncate">
            {subline}
          </p>
        </div>
      </div>
      {/* A phone held sideways keeps the clock and the track; the scene needs the height. */}
      <p className="mt-2 text-ui text-pretty text-fg-secondary not-md:line-clamp-3 not-md:min-h-12 md:line-clamp-3 md:min-h-10 md:leading-5 short:hidden">
        {t(`notes.${noteOf(yearsAgo)}`, proseArgs(PROSE_FIGURES, locale))}
      </p>
      <Timeline yearsAgo={yearsAgo} />
      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-border pt-2.5 md:mt-1 md:pt-3 short:hidden">
        <MapScale namespace="orrery" value={scaleValue} unit={scaleUnit} px={scalePx} />
        <div className="hidden md:block">
          <Switches keys={DISPLAY} />
        </div>
      </div>
    </Dock>
  );
}

/** The scrubber with the epochs as stations on it; wide screens label and link them. */
function Timeline({ yearsAgo }: { yearsAgo: number }) {
  const t = useTranslations("orrery");
  const figures = proseArgs(PROSE_FIGURES, useLocale());
  const f = useFormatter();
  const epoch = epochOf(yearsAgo);
  const note = noteOf(yearsAgo);
  const api = useOrrery.getState;
  return (
    <div data-coach="time" className="relative mt-1.5 md:mt-0 md:py-4">
      {/* Painted before the slider, so the thumb passes over the station poles. */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        {STATIONS.map((s) => (
          <span
            key={s.id}
            style={{ left: trackX(s.at) }}
            className={cn(
              "absolute top-[calc(50%-0.25rem)] h-2 w-px transition-colors duration-feedback ease-standard md:h-[1.875rem]",
              s.below ? "md:top-1/2" : "md:top-0.5",
              s.id === epoch ? "bg-accent" : "bg-fg-primary/30",
            )}
          />
        ))}
      </div>
      <Slider
        aria-label={t("hud.timeSlider")}
        min={0}
        max={1000}
        step={1}
        value={[Math.round(yearsAgoToSlider(yearsAgo) * 1000)]}
        valueText={(v) => formatYearsAgo(t, f, sliderToYearsAgo(v / 1000))}
        onValueChange={([v]) => api().setYearsAgo(sliderToYearsAgo((v ?? 1000) / 1000))}
      />
      {/* Milestones since the clearing: a tap sets the clock; the one the note tells is lit. */}
      <div role="group" aria-label={t("hud.momentsDeep")} className="hidden md:block">
        {TICKS.map((m) => (
          <span
            key={m.id}
            style={{ left: trackX(m.at) }}
            className="absolute top-1/2 -translate-x-1/2"
          >
            <Tooltip
              side="top"
              label={`${t(`moments.${m.id}`)} · ${formatYearsAgo(t, f, m.yearsAgo)}`}
            >
              <button
                type="button"
                aria-label={`${t(`moments.${m.id}`)} · ${formatYearsAgo(t, f, m.yearsAgo)}`}
                aria-pressed={m.id === note}
                onClick={() => api().setYearsAgo(m.yearsAgo)}
                /* A short pole hanging from the track, the hit area a little wider than it. */
                className={cn(
                  "relative block h-4 w-3 rounded-compact ui-focus before:absolute before:top-0 before:left-1/2 before:h-3 before:w-px before:-translate-x-1/2 before:transition-colors before:duration-feedback before:ease-standard",
                  m.id === note
                    ? "before:bg-accent"
                    : "before:bg-fg-primary/40 hover:before:bg-fg-primary/70",
                )}
              />
            </Tooltip>
          </span>
        ))}
      </div>
      <div role="group" aria-label={t("hud.epochs")} className="hidden md:block">
        {STATIONS.map((s) => {
          const end = s.at >= 1;
          return (
            <button
              key={s.id}
              type="button"
              aria-pressed={s.id === epoch}
              /* Today is now: it also brings a clock run on (or set to a moment) back. */
              onClick={() => (s.id === "today" ? api().setClock(0) : api().setYearsAgo(s.yearsAgo))}
              style={{ left: trackX(s.at) }}
              className={cn(
                "absolute h-4 rounded-compact text-caption leading-4 tracking-wide whitespace-nowrap ui-focus transition-colors duration-feedback ease-standard",
                s.below ? "bottom-0" : "top-0",
                end ? "-translate-x-full pr-2" : "pl-2",
                s.id === epoch ? "font-medium text-accent" : "text-fg-tertiary ui-quiet",
              )}
            >
              {t(`epochs.${s.id}`, figures)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

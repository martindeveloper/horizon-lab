import { CalendarClock, Pause, Play, RotateCcw } from "lucide-react";
import { useFormatter, useLocale, useNow, useTranslations } from "next-intl";
import { useCallback, useRef, useState } from "react";

import { MapScale } from "@/components/simulations/map-readouts";
import { useDockClearance, type DockInTheWay } from "@/components/simulations/use-dock-clearance";
import { proseArgs } from "@/lib/facts";
import { asideOpen } from "@/lib/scene-store";
import { sunExists } from "@/space/solar-system/model/moment";
import { SUN_BIRTH } from "@/space/solar-system/model/parameters";
import { clamp } from "@horizon/toolkit/math";
import { convert } from "@horizon/toolkit/science";
import {
  Dock,
  IconButton,
  SLIDER_THUMB_PX,
  Slider,
  Tooltip,
  cn,
  sliderStopAt,
} from "@horizon/toolkit/ui";

import { PROSE_FIGURES } from "../lib/model/catalogue";
import { clockDate } from "../lib/model/events";
import {
  EPOCHS,
  EPOCH_BOUNDS,
  MOMENTS,
  TRACK_CELLS,
  chapterOf,
  epochOf,
  galacticLaps,
  isToday,
  noteOf,
  playDilation,
  playRate,
  sliderToYearsAgo,
  yearsAgoToSlider,
} from "../lib/model/timeline";
import { useOrrery } from "../lib/store";
import { formatYearsAgo } from "./format";
import { momentTitle, useMoments } from "./moments-panel";
import { DISPLAY, Switches } from "./view-controls";

/* The epochs in order, each where the thumb stops for it and the share of the track it ends at. */
const STATIONS = EPOCHS.map((epoch, i) => ({
  ...epoch,
  at: yearsAgoToSlider(epoch.yearsAgo),
  end: yearsAgoToSlider(EPOCH_BOUNDS[i] ?? 0),
}));
/* The dated milestones: beads on their chapters' bars, where they fall. */
const TICKS = MOMENTS.map((moment) => ({ ...moment, at: yearsAgoToSlider(moment.yearsAgo) }));
/** The track's chapters and their names line up with the thumb's travel, inset by its radius. */
const TRAVEL = { marginInline: SLIDER_THUMB_PX / 2 };
const CELLS = { ...TRAVEL, gridTemplateColumns: `repeat(${TRACK_CELLS}, minmax(0, 1fr))` };

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
  if (rate < 8e5)
    return t("hud.driftThousand", { value: f.number(rate / 1000, { maximumFractionDigits: 1 }) });
  return t("hud.driftMillion", { value: f.number(rate / 1e6, { maximumFractionDigits: 1 }) });
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
  /* Past the calendar's reach the offset is all there is to tell: it takes the date's line. */
  const clock = onClock ? clockDate(now, driftYears) : null;
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
  const fromToday = t(driftYears > 0 ? "time.clockDrift" : "time.clockBack", { offset });
  /* History playing: the pace reads in the subline, and the playhead's halo widens as it slows. */
  const inHistory = playing && !isToday(yearsAgo);
  const dilation = inHistory ? playDilation(yearsAgo) : 0;
  let subline: string;
  if (inHistory) {
    subline = motionRateLabel(t, f, playRate(yearsAgo));
  } else if (!sunExists(yearsAgo)) {
    subline = t("time.noSun");
  } else if (yearsAgo > SUN_BIRTH) {
    subline = t("time.protostar");
  } else if (onClock) {
    subline = clock ? `${fromToday} · ${driftLabel}` : driftLabel;
  } else if (isToday(yearsAgo)) {
    const date = f.dateTime(now, { dateStyle: "long" });
    subline = next
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
  let headline: string;
  if (!onClock) {
    headline = formatYearsAgo(t, f, yearsAgo, locale);
  } else if (clock) {
    headline = f.dateTime(clock, { dateStyle: "long" });
  } else {
    headline = fromToday;
  }
  const note = noteOf(yearsAgo);
  const playLabel = t(playing ? "hud.pause" : "hud.play");
  const replayLabel = t(`hud.replay.${chapterOf(yearsAgo)}`);
  return (
    <Dock ref={surface} footerClassName={cn(aside && "not-md:hidden")} className="flex flex-col">
      <div className="flex items-center gap-3">
        <div className="flex shrink-0 items-center gap-2 md:gap-1">
          <Tooltip label={playLabel}>
            <IconButton aria-label={playLabel} active={playing} onClick={() => api().togglePlay()}>
              {playing ? <Pause className="icon" /> : <Play className="icon" />}
            </IconButton>
          </Tooltip>
          <Tooltip label={replayLabel}>
            <IconButton aria-label={replayLabel} onClick={() => api().replay()}>
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
            {headline}
          </p>
          {/* Phones wrap into reserved lines, so scrubbing never makes the dock jump. */}
          <p className="text-ui text-fg-secondary tabular-nums not-md:line-clamp-2 not-md:min-h-8 md:truncate short:min-h-0 short:truncate">
            {subline}
          </p>
        </div>
      </div>
      <EraNote key={note}>{t(`notes.${note}`, proseArgs(PROSE_FIGURES, locale))}</EraNote>
      <Timeline yearsAgo={yearsAgo} dilation={dilation} />
      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-border pt-2.5 md:mt-1 md:pt-3 short:hidden">
        <MapScale namespace="orrery" value={scaleValue} unit={scaleUnit} px={scalePx} />
        <div className="hidden md:block">
          <Switches keys={DISPLAY} />
        </div>
      </div>
    </Dock>
  );
}

/**
 * The era's note, in reading type. It keeps a fixed number of lines while the clock scrubs,
 * so the track never moves under the thumb: three on a phone, four on a wide screen. A note
 * that runs past them is clipped and opens on a tap, and closes again with the next note
 * (the dock keys it by note). A phone held sideways keeps only the clock and the track.
 */
function EraNote({ children }: { children: string }) {
  const [clipped, setClipped] = useState(false);
  const [open, setOpen] = useState(false);
  /* The observer reports the box once as it mounts, then on every resize. */
  const measure = useCallback((el: HTMLSpanElement) => {
    const resize = new ResizeObserver(() => setClipped(el.scrollHeight > el.clientHeight + 1));
    resize.observe(el);
    return () => resize.disconnect();
  }, []);
  const words = (
    <span ref={measure} className={cn(!open && "line-clamp-3 md:line-clamp-4")}>
      {children}
    </span>
  );
  return (
    <p className="mt-2 min-h-15 text-body leading-5 text-pretty text-fg-secondary md:min-h-18 md:leading-6 short:hidden">
      {clipped || open ? (
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((was) => !was)}
          className="block w-full cursor-pointer rounded-compact text-left ui-focus select-text"
        >
          {words}
        </button>
      ) : (
        words
      )}
    </p>
  );
}

/**
 * The scrubber. The track is the history in chapters, one bar each, filled gold from the past
 * to the playhead; the epochs' names sit in cells beneath, each under its bar, the one the
 * clock is in lit. A name is a button to its epoch's station. The dated milestones are beads
 * on the bars: wide screens name them on hover and set the clock to one on a tap, and while
 * the clock stands at one its name takes its cell. Phones name only the
 * epoch the clock is in. `dilation` is how far playback is slowed, 0–1, shown as a halo about
 * the thumb.
 */
function Timeline({ yearsAgo, dilation }: { yearsAgo: number; dilation: number }) {
  const t = useTranslations("orrery");
  const locale = useLocale();
  const figures = proseArgs(PROSE_FIGURES, locale);
  const f = useFormatter();
  const epoch = epochOf(yearsAgo);
  const note = noteOf(yearsAgo);
  const standingAt = MOMENTS.find((m) => m.id === note);
  const at = yearsAgoToSlider(yearsAgo);
  const chapterStart = STATIONS[STATIONS.findIndex((s) => s.id === epoch) - 1]?.end ?? 0;
  const api = useOrrery.getState;
  const tickLabel = (m: (typeof TICKS)[number]) =>
    `${t(`moments.${m.id}`)} · ${formatYearsAgo(t, f, m.yearsAgo, locale)}`;
  return (
    <div data-coach="time" className="mt-1.5 md:mt-0">
      <div className="relative">
        {/* The bars, painted before the slider so the thumb rides over them. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 grid items-center"
          style={CELLS}
        >
          {STATIONS.map((s, i) => {
            const start = i > 0 ? (STATIONS[i - 1]?.end ?? 0) : 0;
            const filled = clamp((at - start) / (s.end - start), 0, 1);
            return (
              <span
                key={s.id}
                style={{ gridColumn: `span ${s.cells}` }}
                className="relative h-0.5 overflow-hidden rounded-full bg-fg-primary/20 not-first:ml-[3px] not-last:mr-[3px]"
              >
                <span
                  className="absolute inset-y-0 left-0 bg-accent"
                  style={{ width: `${filled * 100}%` }}
                />
              </span>
            );
          })}
        </div>
        <Slider
          aria-label={t("hud.timeSlider")}
          min={0}
          max={1000}
          step={1}
          value={[Math.round(at * 1000)]}
          valueText={(v) => formatYearsAgo(t, f, sliderToYearsAgo(v / 1000), locale)}
          onValueChange={([v]) => api().setYearsAgo(sliderToYearsAgo((v ?? 1000) / 1000))}
          trackClassName="bg-transparent"
          rangeClassName="hidden"
          thumbClassName="slider-halo"
          thumbStyle={{ "--halo": dilation }}
        />
        {/* The milestones are beads on the bar, ringed in the dock's surface: pale once passed, dim ahead, the one the clock stands at larger. */}
        <div role="group" aria-label={t("hud.momentsDeep")} className="not-md:pointer-events-none">
          {TICKS.map((m) => (
            <span
              key={m.id}
              style={{ left: sliderStopAt(m.at) }}
              className="absolute top-1/2 -translate-x-1/2"
            >
              <Tooltip side="top" label={tickLabel(m)}>
                <button
                  type="button"
                  aria-label={tickLabel(m)}
                  aria-pressed={m.id === note}
                  onClick={() => api().setYearsAgo(m.yearsAgo)}
                  className={cn(
                    "relative block size-4 -translate-y-1/2 rounded-compact ui-focus before:absolute before:top-1/2 before:left-1/2 before:-translate-1/2 before:rounded-full before:ring-1 before:ring-surface-primary before:transition-[background-color,width,height] before:duration-feedback before:ease-standard md:before:ring-2",
                    m.id === note
                      ? "before:size-1.5 before:bg-fg-primary md:before:size-[7px]"
                      : "before:size-1 md:before:size-[5px]",
                    m.yearsAgo >= yearsAgo
                      ? "before:bg-fg-primary/85"
                      : "before:bg-fg-primary/35 hover:before:bg-fg-primary/70",
                  )}
                />
              </Tooltip>
            </span>
          ))}
        </div>
      </div>
      <div
        role="group"
        aria-label={t("hud.epochs")}
        className="-mt-1.5 hidden md:grid"
        style={CELLS}
      >
        {STATIONS.map((s, i) => {
          const current = s.id === epoch;
          let align = "text-center";
          if (i === 0) align = "text-left";
          if (i === STATIONS.length - 1) align = "text-right";
          /* The cell the clock is in names the milestone it stands at, and is the way back to it. */
          const milestone = current ? standingAt : undefined;
          return (
            <button
              key={s.id}
              type="button"
              aria-pressed={current}
              style={{ gridColumn: `span ${s.cells}` }}
              /* Today is now: it also brings a clock run on (or set to a moment) back. */
              onClick={() => {
                if (milestone) api().setYearsAgo(milestone.yearsAgo);
                else if (s.id === "today") api().setClock(0);
                else api().setYearsAgo(s.yearsAgo);
              }}
              className={cn(
                "h-4 truncate rounded-compact text-caption leading-4 tracking-wide ui-focus transition-colors duration-feedback ease-standard",
                align,
                current ? "font-medium text-accent" : "text-fg-tertiary ui-quiet",
              )}
            >
              {milestone ? t(`moments.${milestone.id}`) : t(`epochs.${s.id}`, figures)}
            </button>
          );
        })}
      </div>
      {/* Phones name only the chapter the clock is in (or its milestone), as one line under its bar. */}
      <p
        className={cn(
          "-mt-1.5 h-4 text-caption leading-4 font-medium tracking-wide whitespace-nowrap text-accent md:hidden",
          epoch === "today" ? "text-right" : "text-left",
        )}
        style={epoch === "today" ? TRAVEL : { ...TRAVEL, paddingLeft: `${chapterStart * 100}%` }}
      >
        {standingAt ? t(`moments.${standingAt.id}`) : t(`epochs.${epoch}`, figures)}
      </p>
    </div>
  );
}

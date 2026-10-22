import { Pause, Play, RotateCcw } from "lucide-react";
import { useFormatter, useLocale, useNow, useTranslations } from "next-intl";
import { useRef } from "react";

import { MapScale } from "@/components/simulations/map-readouts";
import { useDockClearance, type DockInTheWay } from "@/components/simulations/use-dock-clearance";
import { proseArgs } from "@/lib/facts";
import { asideOpen } from "@/lib/scene-store";
import { SUN_BIRTH } from "@/space/solar-system/model/parameters";
import { convert } from "@horizon/toolkit/science";
import { Dock, IconButton, Slider, Tooltip, cn } from "@horizon/toolkit/ui";

import { PROSE_FIGURES } from "../lib/model/catalogue";
import {
  EPOCHS,
  epochOf,
  galacticLaps,
  isToday,
  noteOf,
  sliderToYearsAgo,
  yearsAgoToSlider,
} from "../lib/model/timeline";
import { useOrrery } from "../lib/store";
import { formatYearsAgo } from "./format";
import { DISPLAY, Switches } from "./view-controls";

/* Epochs sit at their true places on the track, alternating above and below it so
   neighbouring labels never meet. The 7px inset follows the thumb's in-bounds travel. */
const STATIONS = EPOCHS.map((epoch, i) => ({
  ...epoch,
  at: yearsAgoToSlider(epoch.yearsAgo),
  below: i % 2 === 1,
}));
const trackX = (at: number) => `calc(7px + ${at} * (100% - 14px))`;

/**
 * The dock never moves for a side panel. Only where its centred width reaches the panel
 * column (w-80 on the HUD gutter) do the card and rail end above it; on wide screens they
 * keep their full height.
 */
const reachesPanels: DockInTheWay = (dock, stage, rem) => dock.right + 22 * rem > stage.right;

/** "1 s ≈ 15 days": the Motion speed-up's rate in words, or that it is paused at 0. */
export function motionRateLabel(
  t: ReturnType<typeof useTranslations<"orrery">>,
  f: ReturnType<typeof useFormatter>,
  rate: number,
) {
  if (rate === 0) return t("hud.driftPaused");
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
  const drift = useOrrery((s) => s.show.drift);
  const scalePx = useOrrery((s) => s.scalePx);
  const scaleValue = useOrrery((s) => s.scaleValue);
  const scaleUnit = useOrrery((s) => s.scaleUnit);
  // Phones give an open sheet or card the bottom of the screen.
  const aside = useOrrery(asideOpen);
  const surface = useRef<HTMLDivElement>(null);
  useDockClearance(surface, reachesPanels);
  const now = useNow({ updateInterval: 60_000 });
  const atEnd = yearsAgo <= 0;
  const api = useOrrery.getState;
  const driftLabel = motionRateLabel(t, f, drift ? driftRate : 0);
  const offset =
    driftYears < 1
      ? t("time.offsetDays", { value: Math.max(1, Math.round(convert(driftYears, "yr", "d"))) })
      : Math.round(driftYears) < 1000
        ? t("time.offsetYears", { value: Math.round(driftYears) })
        : t("time.offsetThousand", {
            value: f.number(Math.max(1, Math.round(driftYears / 1000)), {
              maximumFractionDigits: 0,
            }),
          });
  const subline =
    yearsAgo > SUN_BIRTH
      ? t("time.noSun")
      : isToday(yearsAgo)
        ? drift && driftYears > 0.002
          ? t("time.clockDrift", { offset, rate: driftLabel })
          : t("time.clock", { date: f.dateTime(now, { dateStyle: "long" }) })
        : t("time.laps", {
            laps: f.number(galacticLaps(yearsAgo), {
              minimumFractionDigits: 1,
              maximumFractionDigits: 1,
            }),
          });
  const playLabel = playing ? t("hud.pause") : atEnd ? t("hud.playRestart") : t("hud.play");
  return (
    <Dock ref={surface} footerClassName={cn(aside && "not-md:hidden")} className="flex flex-col">
      <div className="flex items-center gap-3">
        <div className="flex shrink-0 items-center gap-2 md:gap-1">
          <Tooltip label={playLabel}>
            <IconButton aria-label={playLabel} active={playing} onClick={() => api().togglePlay()}>
              {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
            </IconButton>
          </Tooltip>
          <Tooltip label={t("hud.replay")}>
            <IconButton aria-label={t("hud.replay")} onClick={() => api().replay()}>
              <RotateCcw className="size-4" />
            </IconButton>
          </Tooltip>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-sm font-medium tracking-tight text-fg tabular-nums md:text-base">
            {formatYearsAgo(t, f, yearsAgo)}
          </p>
          {/* Phones wrap into reserved lines, so scrubbing never makes the dock jump. */}
          <p className="text-xs text-muted tabular-nums not-md:line-clamp-2 not-md:min-h-8 md:truncate short:min-h-0 short:truncate">
            {subline}
          </p>
        </div>
      </div>
      {/* A phone held sideways keeps the clock and the track; the scene needs the height. */}
      <p className="mt-2 text-xs text-pretty text-muted not-md:line-clamp-3 not-md:min-h-12 md:line-clamp-3 md:min-h-10 md:leading-5 short:hidden">
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
              "absolute top-[calc(50%-0.25rem)] h-2 w-px transition-colors duration-300 md:h-[1.875rem]",
              s.below ? "md:top-1/2" : "md:top-0.5",
              s.id === epoch ? "bg-accent" : "bg-fg/30",
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
      <div role="group" aria-label={t("hud.epochs")} className="hidden md:block">
        {STATIONS.map((s) => {
          const end = s.at >= 1;
          return (
            <button
              key={s.id}
              type="button"
              aria-pressed={s.id === epoch}
              onClick={() => api().setYearsAgo(s.yearsAgo)}
              style={{ left: trackX(s.at) }}
              className={cn(
                "absolute h-4 rounded-sm text-[11px] leading-4 tracking-wide whitespace-nowrap transition-colors duration-300 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden",
                s.below ? "bottom-0" : "top-0",
                end ? "-translate-x-full pr-2" : "pl-2",
                s.id === epoch ? "font-medium text-accent" : "text-subtle hover:text-fg",
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

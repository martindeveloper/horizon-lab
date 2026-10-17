import { Pause, Play, RotateCcw } from "lucide-react";
import { useFormatter, useLocale, useNow, useTranslations } from "next-intl";

import { DISTANCE_UNITS, formatReadout, type DistanceUnit } from "@horizon/toolkit/science";
import { Dock, IconButton, SegmentedControl, Slider, Tooltip, cn } from "@horizon/toolkit/ui";

import { ORRERY_COPY } from "../lib/model/figures";
import { galacticLaps } from "../lib/model/galactic-orbit";
import { SUN_BIRTH } from "../lib/model/parameters";
import { EPOCHS, epochOf, noteOf, sliderToYearsAgo, yearsAgoToSlider } from "../lib/model/timeline";
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

/** The timeline dock: date and playback, era note, epoch track, then map settings. */
export function TimeDock() {
  const t = useTranslations("orrery");
  const f = useFormatter();
  const yearsAgo = useOrrery((s) => s.yearsAgo);
  const playing = useOrrery((s) => s.playing);
  const viewRealm = useOrrery((s) => s.viewRealm);
  const driftRate = useOrrery((s) => s.driftRate);
  const driftYears = useOrrery((s) => s.driftYears);
  const drift = useOrrery((s) => s.show.drift);
  // Wide screens keep the dock clear of an open rail or card (w-80 on the HUD gutter).
  const aside = useOrrery((s) => s.panel !== "none" || s.selection !== null);
  const now = useNow({ updateInterval: 60_000 });
  const atEnd = yearsAgo <= 0;
  const api = useOrrery.getState;
  const driftLabel =
    !drift || driftRate === 0
      ? t("hud.driftPaused")
      : viewRealm === "galaxy"
        ? t("hud.galaxyMotion")
        : driftRate < 1.2
          ? t("hud.driftDays", { value: Math.round(driftRate * 365) })
          : driftRate < 800
            ? t("hud.driftYears", { value: Math.round(driftRate) })
            : t("hud.driftThousand", {
                value: f.number(driftRate / 1000, { maximumFractionDigits: 1 }),
              });
  const offset =
    driftYears < 1
      ? t("time.offsetDays", { value: Math.round(driftYears * 365.25) })
      : driftYears < 1000
        ? t("time.offsetYears", { value: Math.round(driftYears) })
        : t("time.offsetThousand", {
            value: f.number(driftYears / 1000, { maximumFractionDigits: 1 }),
          });
  const subline =
    yearsAgo > SUN_BIRTH
      ? t("time.noSun")
      : yearsAgo < 5e4
        ? drift && driftYears > 0.002 && viewRealm === "solar"
          ? t("time.clockDrift", { offset, rate: driftLabel })
          : t("time.clock", { date: f.dateTime(now, { dateStyle: "long" }) })
        : t("time.laps", { laps: f.number(galacticLaps(yearsAgo), { maximumFractionDigits: 1 }) });
  const playLabel = playing ? t("hud.pause") : atEnd ? t("hud.playRestart") : t("hud.play");
  return (
    <Dock
      footerClassName={cn(aside && "md:lg:pr-[calc(20rem+2*var(--hud-gutter))]")}
      className="flex flex-col"
    >
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
          <p className="truncate font-display text-sm font-medium tracking-tight text-fg md:text-base">
            {formatYearsAgo(t, f, yearsAgo)}
          </p>
          {/* Phones wrap into reserved lines, so scrubbing never makes the dock jump. */}
          <p className="text-xs text-muted not-md:line-clamp-2 not-md:min-h-8 md:truncate">
            {subline}
          </p>
        </div>
      </div>
      <p className="mt-2 text-xs text-pretty text-muted not-md:line-clamp-3 not-md:min-h-12 md:line-clamp-3 md:min-h-10 md:leading-5">
        {t(`notes.${noteOf(yearsAgo)}`, ORRERY_COPY)}
      </p>
      <Timeline yearsAgo={yearsAgo} />
      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-border pt-2.5 md:mt-1 md:pt-3">
        <div className="flex min-w-0 items-center gap-4 not-md:flex-1">
          <ScaleBar />
          <DistanceUnits className="not-md:ml-auto" />
        </div>
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
  const f = useFormatter();
  const epoch = epochOf(yearsAgo);
  const api = useOrrery.getState;
  return (
    <div className="relative mt-1.5 md:mt-0 md:py-4">
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
              {t(`epochs.${s.id}`)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** A cartographic scale: the round distance the bar spans at the centre of the view. */
function ScaleBar() {
  const t = useTranslations("orrery");
  const locale = useLocale();
  const scalePx = useOrrery((s) => s.scalePx);
  const scaleValue = useOrrery((s) => s.scaleValue);
  const unit = useOrrery((s) => s.distanceUnit);
  const value = formatReadout(scaleValue, locale);
  const label = t("hud.scale", { value, unit: t(`units.${unit}`) });
  return (
    <Tooltip label={label} className="min-w-0 shrink-0">
      <span className="flex flex-col items-start gap-1 font-mono text-[11px] leading-none tracking-wide text-subtle tabular-nums">
        <span aria-hidden className="whitespace-nowrap">
          {value} {t(`units.${unit}`)}
        </span>
        <span
          aria-hidden
          className="h-1.5 border-x border-b border-fg/50 transition-[width] duration-300"
          style={{ width: scalePx }}
        />
        <span className="sr-only">{label}</span>
      </span>
    </Tooltip>
  );
}

function DistanceUnits({ className }: { className?: string }) {
  const t = useTranslations("orrery");
  const unit = useOrrery((s) => s.distanceUnit);
  return (
    <SegmentedControl<DistanceUnit>
      aria-label={t("hud.distanceUnit")}
      className={cn("shrink-0 gap-2", className)}
      value={unit}
      onValueChange={(next) => useOrrery.getState().setDistanceUnit(next)}
      options={DISTANCE_UNITS.map((value) => ({ value, label: t(`units.${value}`) }))}
    />
  );
}

import { Pause, Play, RotateCcw } from "lucide-react";
import { useFormatter, useLocale, useNow, useTranslations } from "next-intl";

import { DISTANCE_UNITS, formatReadout, type DistanceUnit } from "@horizon/toolkit/science";
import { Dock, IconButton, SegmentedControl, Slider, Tooltip, cn } from "@horizon/toolkit/ui";

import { ORRERY_COPY } from "../lib/model/figures";
import { galacticLaps } from "../lib/model/galactic-orbit";
import { SUN_BIRTH } from "../lib/model/parameters";
import {
  EPOCHS,
  epochOf,
  noteOf,
  sliderToYearsAgo,
  yearsAgoToSlider,
  type Epoch,
} from "../lib/model/timeline";
import { useOrrery } from "../lib/store";
import { formatYearsAgo } from "./format";
import { DISPLAY, Switches } from "./view-controls";

/** The timeline dock: date, epochs, playback, scrubber, era note and scale bar. */
export function TimeDock() {
  const t = useTranslations("orrery");
  const f = useFormatter();
  const yearsAgo = useOrrery((s) => s.yearsAgo);
  const playing = useOrrery((s) => s.playing);
  const viewRealm = useOrrery((s) => s.viewRealm);
  const scalePx = useOrrery((s) => s.scalePx);
  const scaleValue = useOrrery((s) => s.scaleValue);
  const unit = useOrrery((s) => s.distanceUnit);
  const locale = useLocale();
  const driftRate = useOrrery((s) => s.driftRate);
  const driftYears = useOrrery((s) => s.driftYears);
  const drift = useOrrery((s) => s.show.drift);
  // Wide screens keep the dock clear of an open rail or card (w-80 on the HUD gutter).
  const aside = useOrrery((s) => s.panel !== "none" || s.selection !== null);
  const now = useNow({ updateInterval: 60_000 });
  const atEnd = yearsAgo <= 0;
  const epoch = epochOf(yearsAgo);
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
      className="flex flex-col gap-2 md:gap-3"
    >
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-sm font-medium tracking-tight text-fg md:text-base">
            {formatYearsAgo(t, f, yearsAgo)}
          </p>
          {/* Phones wrap into reserved lines, so scrubbing never makes the dock jump. */}
          <p className="text-xs text-muted not-md:line-clamp-2 not-md:min-h-8 md:truncate">
            {subline}
          </p>
        </div>
        <div className="hidden md:block">
          <SegmentedControl<Epoch>
            aria-label={t("hud.epochs")}
            value={epoch}
            onValueChange={(id) => api().setYearsAgo(EPOCHS.find((e) => e.id === id)!.yearsAgo)}
            options={EPOCHS.map((e) => ({ value: e.id, label: t(`epochs.${e.id}`) }))}
          />
        </div>
        <Tooltip label={t("hud.replay")}>
          <IconButton aria-label={t("hud.replay")} onClick={() => api().replay()}>
            <RotateCcw className="size-4" />
          </IconButton>
        </Tooltip>
        <Tooltip label={playLabel}>
          <IconButton aria-label={playLabel} active={playing} onClick={() => api().togglePlay()}>
            {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
          </IconButton>
        </Tooltip>
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
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2">
        <p className="col-span-2 min-w-0 text-xs text-muted not-md:line-clamp-3 not-md:min-h-12 md:truncate">
          {t(`notes.${noteOf(yearsAgo)}`, ORRERY_COPY)}
        </p>
        <div className="flex min-w-0 items-center gap-3 font-mono text-xs tracking-wide text-subtle">
          <span className="block h-px shrink-0 bg-fg/50" style={{ width: scalePx }} aria-hidden />
          <span className="min-w-0 not-md:line-clamp-2 md:truncate">
            {t("hud.scale", {
              value: formatReadout(scaleValue, locale),
              unit: t(`units.${unit}`),
            })}
          </span>
          <SegmentedControl<DistanceUnit>
            aria-label={t("hud.distanceUnit")}
            className="shrink-0 gap-2 font-sans"
            value={unit}
            onValueChange={(next) => api().setDistanceUnit(next)}
            options={DISTANCE_UNITS.map((value) => ({ value, label: t(`units.${value}`) }))}
          />
        </div>
        <div className="hidden md:block">
          <Switches keys={DISPLAY} />
        </div>
      </div>
    </Dock>
  );
}

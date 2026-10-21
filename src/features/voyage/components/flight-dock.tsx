import { Pause, Play } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useRef, type ReactNode } from "react";

import { useDockClearance, type DockInTheWay } from "@/components/simulations/use-dock-clearance";
import { asideOpen } from "@/lib/scene-store";
import {
  IconButton,
  Kicker,
  SegmentedControl,
  Slider,
  Surface,
  Tooltip,
  cn,
} from "@horizon/toolkit/ui";

import { anchorNameKey } from "../lib/model/anchors";
import { CLOCK_RATES, type DriveId } from "../lib/model/parameters";
import { useVoyage } from "../lib/store";
import {
  formatCalendar,
  formatDuration,
  formatIrradiance,
  formatRange,
  formatSpeed,
} from "./format";

/** The console never moves for a side panel; where it reaches the panel column, cards end above it. */
const reachesPanels: DockInTheWay = (dock, stage, rem) => dock.right + 22 * rem > stage.right;

const DRIVE_IDS: readonly DriveId[] = ["voyager", "sail", "torch"];
const NONE = "—";

/** The nearest clock rate to a rate, as the slider's index. */
const stepOf = (rate: number) => {
  let best = 0;
  for (let i = 0; i < CLOCK_RATES.length; i += 1)
    if (
      Math.abs(Math.log(CLOCK_RATES[i]!.value / rate)) <
      Math.abs(Math.log(CLOCK_RATES[best]!.value / rate))
    )
      best = i;
  return best;
};

/** One instrument: a small label over its reading, the primary ones in the display face. */
function Instrument({
  label,
  value,
  primary = false,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  primary?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <dt className="font-mono text-[10px] tracking-[0.18em] text-subtle uppercase">{label}</dt>
      <dd
        className={cn(
          "mt-0.5 truncate tabular-nums",
          primary
            ? "font-display text-base font-medium tracking-tight text-fg md:text-lg"
            : "font-mono text-xs text-fg",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

const panelClass =
  "voyage-console-panel pointer-events-auto flex flex-col gap-2.5 rounded-lg px-4 py-3 not-md:px-3.5 not-md:py-2.5";

/**
 * The console: two glass panels angled in towards the pilot, the ship's on the left (its
 * status, the clocks, the clock rate, how it flies) and the target's on the right (speed,
 * range, the closing speed, the light here, the drive), with the engine's scanner between
 * them. Phones stack the panels.
 */
export function FlightDock() {
  const t = useTranslations("voyage");
  const f = useFormatter();
  const locale = useLocale();
  const shipSeconds = useVoyage((s) => s.shipSeconds);
  const earthSeconds = useVoyage((s) => s.earthSeconds);
  const epochMs = useVoyage((s) => s.epochMs);
  const speed = useVoyage((s) => s.speed);
  const gamma = useVoyage((s) => s.gamma);
  const range = useVoyage((s) => s.range);
  const closing = useVoyage((s) => s.closing);
  const aim = useVoyage((s) => s.aim);
  const flying = useVoyage((s) => s.flying);
  const lightToEarth = useVoyage((s) => s.lightToEarth);
  const irradiance = useVoyage((s) => s.irradiance);
  const cmbKelvin = useVoyage((s) => s.cmbKelvin);
  const compression = useVoyage((s) => s.compression);
  const heldCompression = useVoyage((s) => s.heldCompression);
  const mode = useVoyage((s) => s.mode);
  const drive = useVoyage((s) => s.drive);
  const unit = useVoyage((s) => s.distanceUnit);
  const aside = useVoyage(asideOpen);
  const surface = useRef<HTMLDivElement>(null);
  useDockClearance(surface, reachesPanels);
  const api = useVoyage.getState;
  const held = compression === 0;
  const holdLabel = held ? t("hud.run") : t("hud.hold");
  const d = { unit, locale };
  const aimName = t(anchorNameKey(aim));
  const calendar = formatCalendar(f, epochMs, earthSeconds);
  const rateIndex = stepOf(held ? heldCompression : compression);
  const rateLabel = (index: number) => t(`rates.${CLOCK_RATES[index]!.id}`);
  /* The clocks part only at speed; the gap is the lesson, so it reads once it is a second. */
  const apart = earthSeconds - shipSeconds;
  const free = mode === "free";
  /* A parked ship rides with its body: nothing closes. Receding reads negative. */
  const closingText =
    !free && !flying ? NONE : `${closing < 0 ? "−" : ""}${formatSpeed(t, f, Math.abs(closing))}`;
  return (
    <footer
      className={cn(
        "pad-hud-bottom pointer-events-none absolute inset-x-0 bottom-0 z-30",
        aside && "not-md:hidden",
      )}
    >
      <div
        ref={surface}
        className="voyage-console mx-auto grid w-full max-w-6xl grid-cols-1 gap-2 md:grid-cols-[1fr_16rem_1fr] md:items-end md:gap-0"
      >
        <Surface className={cn(panelClass, "voyage-console-left")}>
          <div className="flex items-center gap-3">
            <Tooltip label={holdLabel}>
              <IconButton aria-label={holdLabel} active={!held} onClick={() => api().toggleHold()}>
                {held ? <Play className="size-4" /> : <Pause className="size-4" />}
              </IconButton>
            </Tooltip>
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-sm font-medium tracking-tight text-fg tabular-nums md:text-base">
                {flying
                  ? t("hud.flyingTo", { body: aimName })
                  : free
                    ? t("hud.nearBody", { body: aimName })
                    : t("hud.parkedAt", { body: aimName })}
              </p>
              <p className="truncate text-xs text-muted tabular-nums">
                {rateLabel(rateIndex)}
                {calendar ? ` · ${calendar}` : ""}
              </p>
            </div>
            <Kicker className="not-md:hidden">{t("hud.mode")}</Kicker>
          </div>
          <dl className="grid grid-cols-2 gap-x-3">
            <Instrument
              label={t("hud.shipClock")}
              value={formatDuration(t, f, shipSeconds)}
              primary
            />
            <Instrument
              label={t("hud.earthClock")}
              value={formatDuration(t, f, earthSeconds)}
              primary
            />
            <Instrument
              label={t("hud.clocksApart")}
              value={Math.abs(apart) >= 1 ? formatDuration(t, f, apart) : NONE}
              className="col-span-2 mt-1.5 not-md:hidden"
            />
          </dl>
          <div className="flex items-center gap-3 border-t border-border pt-2.5 short:hidden">
            <SegmentedControl
              aria-label={t("hud.mode")}
              options={[
                { value: "orbit", label: t("hud.modeOrbit") },
                { value: "free", label: t("hud.modeFree") },
              ]}
              value={mode}
              disabled={flying}
              onValueChange={(next) => api().setMode(next)}
            />
            <span className="shrink-0 font-mono text-[10px] tracking-[0.18em] text-subtle uppercase not-md:hidden">
              {t("hud.rate")}
            </span>
            <Slider
              aria-label={t("hud.rate")}
              min={0}
              max={CLOCK_RATES.length - 1}
              step={1}
              value={[rateIndex]}
              valueText={(v) => rateLabel(v)}
              onValueChange={([v]) => api().setCompression(CLOCK_RATES[v ?? 0]!.value)}
            />
          </div>
          {free ? (
            <p className="font-mono text-[10px] tracking-[0.14em] text-subtle uppercase not-md:hidden">
              {t("hud.freeKeys")}
            </p>
          ) : null}
        </Surface>
        {/* The scanner's place: the engine draws it here (lib/scene/cockpit.ts). */}
        <div className="hidden md:block" aria-hidden="true" />
        <Surface className={cn(panelClass, "voyage-console-right")}>
          <div className="flex items-center justify-between gap-3">
            <Kicker>{t("hud.target")}</Kicker>
            <SegmentedControl
              aria-label={t("hud.drive")}
              options={DRIVE_IDS.map((id) => ({ value: id, label: t(`drives.${id}`) }))}
              value={drive}
              onValueChange={(next) => api().setDrive(next)}
            />
          </div>
          <dl className="grid grid-cols-2 gap-x-3">
            <Instrument label={t("hud.speed")} value={formatSpeed(t, f, speed, gamma)} primary />
            <Instrument label={t("hud.range")} value={formatRange(t, f, d, range)} primary />
          </dl>
          <dl className="grid grid-cols-2 gap-x-3 border-t border-border pt-2.5 md:grid-cols-4">
            <Instrument label={t("hud.closing")} value={closingText} />
            <Instrument label={t("hud.lightToEarth")} value={formatDuration(t, f, lightToEarth)} />
            <Instrument
              label={t("hud.sunlight")}
              value={formatIrradiance(t, f, irradiance)}
              className="not-md:hidden"
            />
            <Instrument
              label={t("hud.cmb")}
              value={t("hud.cmbValue", {
                value: f.number(cmbKelvin, { maximumSignificantDigits: 3 }),
              })}
              className="not-md:hidden"
            />
          </dl>
        </Surface>
      </div>
    </footer>
  );
}

"use client";

import { CalendarClock, MoveHorizontal, Sun, Thermometer, type LucideIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";

import { MAP_EPOCH } from "@/space/sun/frame";
import { PARKER_CORONA_EDGE_R } from "@/space/sun/model/parameters";
import { parkerAt, parkerShieldC, parkerSunlight } from "@/space/sun/model/parker";
import { Chip, cn } from "@horizon/toolkit/ui";

import { canRide, useSun } from "../lib/store";

/**
 * One reading: an icon, and the value in a box as wide as its widest reading (`width`, in ch),
 * right-aligned in tabular figures, so the row never shifts as the values run. The label names
 * it for screen readers and on hover.
 */
function Stat({
  icon: Icon,
  label,
  value,
  width,
  className,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  width: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-1.5", className)} title={label}>
      <Icon className="size-3.5 shrink-0 text-subtle" aria-hidden />
      <dt className="sr-only">{label}</dt>
      <dd className={cn("font-mono text-xs whitespace-nowrap text-fg tabular-nums", width)}>
        {value}
      </dd>
    </div>
  );
}

/**
 * Parker's orbit view's row: the ride, and where the probe stands on the lab's clock: the
 * date, its distance from the Sun's centre, how hot its heat shield runs there and how strong
 * the sunlight is, all from its orbit (`@/space/sun/model/parker`).
 */
export function ParkerReadout() {
  const t = useTranslations("sun");
  const f = useFormatter();
  const elapsed = useSun((s) => s.elapsed);
  const riding = useSun((s) => s.closeUp && s.ride);
  const offer = useSun(canRide);
  const api = useSun.getState;
  const date = new Date(MAP_EPOCH + elapsed * 1000);
  const r = Math.hypot(...parkerAt(date.getTime()));
  const sunlight = parkerSunlight(r);
  const inCorona = r < PARKER_CORONA_EDGE_R;
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
      <Chip
        selected={riding}
        aria-pressed={riding}
        disabled={!offer && !riding}
        onClick={() => (riding ? api().leaveCloseUp() : api().rideParker())}
        className="shrink-0 not-md:h-9"
      >
        {riding ? t("hud.leaveCloseUp") : t("hud.rideParker")}
      </Chip>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 md:flex md:items-center">
        <Stat
          icon={CalendarClock}
          label={t("hud.parkerDate")}
          width="min-w-[23ch]"
          className="col-span-2 md:col-span-1"
          value={`${f.dateTime(date, {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            hourCycle: "h23",
            timeZone: "UTC",
          })} UTC`}
        />
        <Stat
          icon={MoveHorizontal}
          label={t("hud.parkerDistance")}
          width="min-w-[8ch] text-right"
          value={`${f.number(r, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} R☉`}
        />
        <Stat
          icon={Thermometer}
          label={t("hud.parkerShield")}
          width="min-w-[8ch] text-right"
          value={f.number(parkerShieldC(r), {
            style: "unit",
            unit: "celsius",
            maximumFractionDigits: 0,
          })}
        />
        <Stat
          icon={Sun}
          label={t("hud.parkerSunlight")}
          width="min-w-[5ch] text-right"
          value={`${f.number(sunlight, { maximumFractionDigits: sunlight < 10 ? 1 : 0 })}×`}
        />
      </dl>
      {/* Inside the corona's edge: shown in a place kept for it, so nothing moves as it comes
          and goes; announced as it crosses. */}
      <span role="status" className="sr-only">
        {inCorona ? t("hud.parkerInCorona") : ""}
      </span>
      <span
        aria-hidden
        className={cn(
          "glass-pill rounded-full px-2.5 py-1 text-xs whitespace-nowrap text-solar transition-opacity",
          inCorona ? "opacity-100" : "opacity-0",
        )}
      >
        {t("hud.parkerInCorona")}
      </span>
    </div>
  );
}

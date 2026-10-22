"use client";

import { CalendarClock, MoveHorizontal, Sun, Thermometer } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";

import { PARKER_CORONA_EDGE_R } from "@/space/sun/model/parameters";
import { parkerAt, parkerShieldC, parkerSunlight } from "@/space/sun/model/parker";
import { DataReadout, StatusBadge, SwitchChip } from "@horizon/toolkit/ui";

import { canRide, useSun } from "../lib/store";

/**
 * Parker's orbit view's row: the ride along with it, and where the probe stands on the lab's
 * clock: the date, its distance from the Sun's centre, how hot its heat shield runs there and
 * how strong the sunlight is, all from its orbit (`@/space/sun/model/parker`). Each value sits
 * in a box as wide as its widest reading, so the row never shifts as the values run; inside
 * the corona's edge a badge says so, in a place kept for it.
 */
export function ParkerReadout() {
  const t = useTranslations("sun");
  const f = useFormatter();
  const moment = useSun((s) => s.moment);
  const riding = useSun((s) => s.closeUp && s.ride);
  const offer = useSun(canRide);
  const api = useSun.getState;
  const r = Math.hypot(...parkerAt(moment));
  const sunlight = parkerSunlight(r);
  const date = f.dateTime(new Date(moment), {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "UTC",
  });
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
      <SwitchChip
        on={riding}
        disabled={!offer && !riding}
        onToggle={() => (riding ? api().leaveCloseUp() : api().rideParker())}
        className="shrink-0 not-md:h-9"
      >
        {t("hud.ride")}
      </SwitchChip>
      <DataReadout
        variant="inline"
        className="short:hidden"
        items={[
          {
            id: "date",
            icon: <CalendarClock />,
            label: t("hud.parkerDate"),
            value: t("hud.utc", { date }),
            valueClassName: "min-w-[23ch]",
          },
          {
            id: "distance",
            icon: <MoveHorizontal />,
            label: t("hud.parkerDistance"),
            value: `${f.number(r, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} R☉`,
            valueClassName: "inline-block min-w-[8ch] text-right",
          },
          {
            id: "shield",
            icon: <Thermometer />,
            label: t("hud.parkerShield"),
            value: f.number(parkerShieldC(r), {
              style: "unit",
              unit: "celsius",
              maximumFractionDigits: 0,
            }),
            valueClassName: "inline-block min-w-[8ch] text-right",
          },
          {
            id: "sunlight",
            icon: <Sun />,
            label: t("hud.parkerSunlight"),
            value: `${f.number(sunlight, { maximumFractionDigits: sunlight < 10 ? 1 : 0 })}×`,
            valueClassName: "inline-block min-w-[5ch] text-right",
          },
        ]}
      />
      <StatusBadge label={t("hud.parkerInCorona")} visible={r < PARKER_CORONA_EDGE_R} accent />
    </div>
  );
}

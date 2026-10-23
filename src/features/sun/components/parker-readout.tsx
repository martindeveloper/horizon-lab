"use client";

import { CalendarClock, MoveHorizontal, Sun, Thermometer } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";

import { PARKER_CORONA_EDGE_R } from "@/space/sun/model/parameters";
import { parkerAt, parkerPredicted, parkerShieldC, parkerSunlight } from "@/space/sun/model/parker";
import { DataReadout, StatusBadge, SwitchChip, kickerClass } from "@horizon/toolkit/ui";

import { canRide, useSun } from "../lib/store";

/** Parker's orbit view's action: the ride along with the probe, behind its shield. */
export function ParkerRide() {
  const t = useTranslations("sun");
  const riding = useSun((s) => s.closeUp && s.ride);
  const offer = useSun(canRide);
  const api = useSun.getState;
  return (
    <SwitchChip
      on={riding}
      disabled={!offer && !riding}
      onToggle={() => (riding ? api().leaveCloseUp() : api().rideParker())}
      className="shrink-0 not-md:h-9"
    >
      {t("hud.ride")}
    </SwitchChip>
  );
}

/**
 * Where the probe stands on the lab's clock: the date, its distance from the Sun's centre, how
 * hot its heat shield runs there and how strong the sunlight is, all from its orbit
 * (`@/space/sun/model/parker`); in a row on wide screens, two by two on phones. Each running
 * value sits in a box as wide as its widest reading, so nothing shifts as the values run.
 * Inside the corona's edge a badge says so: in a place kept for it on wide screens, over the
 * dock's corner on phones.
 */
export function ParkerReadout() {
  const t = useTranslations("sun");
  const f = useFormatter();
  const moment = useSun((s) => s.moment);
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
    <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2 not-md:basis-full">
      <DataReadout
        variant="inline"
        className="not-md:grid not-md:grid-cols-[auto_auto] not-md:justify-between short:hidden"
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
            valueClassName: "inline-block min-w-[8ch] md:text-right",
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
            valueClassName: "inline-block min-w-[8ch] md:text-right",
          },
          {
            id: "sunlight",
            icon: <Sun />,
            label: t("hud.parkerSunlight"),
            value: `${f.number(sunlight, { maximumFractionDigits: sunlight < 10 ? 1 : 0 })}×`,
            valueClassName: "inline-block min-w-[5ch] md:text-right",
          },
        ]}
      />
      {/* Past its latest elements, where it stands is the orbit carried forward. */}
      {parkerPredicted(moment) ? (
        <span className={kickerClass}>{t("hud.parkerPredicted")}</span>
      ) : null}
      <StatusBadge
        label={t("hud.parkerInCorona")}
        visible={r < PARKER_CORONA_EDGE_R}
        accent
        className="not-md:absolute not-md:right-0 not-md:bottom-full not-md:mb-2"
      />
    </div>
  );
}

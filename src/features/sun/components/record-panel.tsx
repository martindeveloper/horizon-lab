"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useMemo } from "react";

import { Rail, RailSection } from "@/components/simulations/rail";
import { ZoomFigure } from "@/components/simulations/zoom-figure";
import { SUNSPOT_NUMBERS, cycleCountOfYear, yearOfCycleCount } from "@/space/sun/model/cycle";
import { RAD_PER_DEG } from "@horizon/toolkit/science";
import { kickerClass } from "@horizon/toolkit/ui";

import {
  BUTTERFLY_REACH_RAD,
  RECORD_FIRST_YEAR,
  RECORD_LAST_YEAR,
  RECORD_LULLS,
  RECORD_PEAK,
  SCALED_GROUPS,
  SUNSPOTS_PER_GROUP,
  butterflyGrid,
} from "../lib/model/record";
import { useSun } from "../lib/store";

const W = 288;
/** The plot's box inside a chart: room for the value labels on the left and the years below. */
const LEFT = 24;
const RIGHT = W - 4;
const TEXT = "fill-fg-tertiary font-mono text-[9px] tabular-nums";

const RECORD = { height: 112, top: 12, bottom: 98 };
const RECORD_TICKS = [1650, 1750, 1850, 1950];
const VALUE_TICKS = [0, 100, 200];

const BUTTERFLY = { height: 104, top: 4, bottom: 90, columns: 132, rows: 40 };
const BUTTERFLY_TICKS_DEG = [30, 0, -30];
/** Density steps the butterfly is shaded in, and each step's opacity. */
const BUTTERFLY_STEPS = [0.12, 0.3, 0.55, 0.8];
const BUTTERFLY_OPACITY = [0.25, 0.5, 0.75, 1];

/** The record's axes, running to `lastYear`. */
const recordX = (year: number, lastYear: number) =>
  LEFT + ((year - RECORD_FIRST_YEAR) / (lastYear - RECORD_FIRST_YEAR)) * (RIGHT - LEFT);
const recordY = (value: number) =>
  RECORD.bottom - (value / RECORD_PEAK) * (RECORD.bottom - RECORD.top);

/** A yearly series as a polyline, each year at its middle. */
const seriesPath = (rows: readonly { year: number; number: number }[], lastYear: number) =>
  rows
    .map(
      ({ year, number }, i) =>
        `${i ? "L" : "M"}${recordX(year + 0.5, lastYear).toFixed(1)} ${recordY(number).toFixed(1)}`,
    )
    .join("");

/** The butterfly's span: the cycle before the model's, the model's and the next. */
const butterflySpan = (cycle: number) => [yearOfCycleCount(cycle - 1), yearOfCycleCount(cycle + 2)];
const butterflyX = (year: number, cycle: number) => {
  const [from, to] = butterflySpan(cycle);
  return LEFT + ((year - from!) / (to! - from!)) * (RIGHT - LEFT);
};
const latitudeY = (deg: number) =>
  BUTTERFLY.top +
  (0.5 - (deg * RAD_PER_DEG) / (2 * BUTTERFLY_REACH_RAD)) * (BUTTERFLY.bottom - BUTTERFLY.top);

/** The butterfly's cells at each density step, as one path per step, runs merged along a row. */
function butterflyShades(cycle: number) {
  const { columns, rows } = BUTTERFLY;
  const [from, to] = butterflySpan(cycle);
  const grid = butterflyGrid(from!, to!, columns, rows);
  const cellW = (RIGHT - LEFT) / columns;
  const cellH = (BUTTERFLY.bottom - BUTTERFLY.top) / rows;
  return BUTTERFLY_STEPS.map((step, s) => {
    const next = BUTTERFLY_STEPS[s + 1] ?? Infinity;
    let d = "";
    for (let r = 0; r < rows; r++) {
      let start = -1;
      for (let c = 0; c <= columns; c++) {
        const value = c < columns ? grid[r * columns + c]! : -1;
        const inStep = value >= step && value < next;
        if (inStep && start < 0) start = c;
        if (!inStep && start >= 0) {
          const width = (c - start) * cellW;
          d += `M${(LEFT + start * cellW).toFixed(1)} ${(BUTTERFLY.top + r * cellH).toFixed(1)}h${width.toFixed(1)}v${cellH.toFixed(1)}h${(-width).toFixed(1)}z`;
          start = -1;
        }
      }
    }
    return d;
  });
}

/**
 * The record behind the cycle: the measured yearly sunspot numbers since 1700 and group numbers
 * since 1610, its lulls shaded and the model's year marked; then where the model's spots emerge
 * across the cycle before, the one shown and the next, the butterfly the globe draws.
 */
export function RecordPanel({ onClose }: { onClose: () => void }) {
  const t = useTranslations("sun");
  const f = useFormatter();
  const year = useSun((s) => s.cycleYear);
  const cycle = Math.floor(cycleCountOfYear(year));
  const year0 = (n: number) => f.number(n, { useGrouping: false });

  /* The record runs to the end of the model's cycle, so the model's year always has a place. */
  const lastYear = Math.max(RECORD_LAST_YEAR + 1, yearOfCycleCount(cycle + 1));
  const x = (y: number) => recordX(y, lastYear);
  const sunspots = useMemo(() => seriesPath(SUNSPOT_NUMBERS, lastYear), [lastYear]);
  const groups = useMemo(() => seriesPath(SCALED_GROUPS, lastYear), [lastYear]);
  const shades = useMemo(() => butterflyShades(cycle), [cycle]);

  const markX = x(year);
  return (
    <Rail id="sun-record" title={t("record.title")} closeLabel={t("hud.close")} onClose={onClose}>
      <RailSection title={t("record.sunspots", { first: year0(RECORD_FIRST_YEAR) })}>
        <ZoomFigure
          title={t("record.sunspots", { first: year0(RECORD_FIRST_YEAR) })}
          label={<span className={kickerClass}>{t("badges.measured")}</span>}
        >
          <svg
            viewBox={`0 0 ${W} ${RECORD.height}`}
            role="img"
            aria-label={t("record.recordLabel", {
              first: year0(RECORD_FIRST_YEAR),
              last: year0(RECORD_LAST_YEAR),
            })}
            className="w-full"
          >
            {RECORD_LULLS.map(({ id, span: [start, end] }) => (
              <g key={id}>
                <rect
                  x={x(start)}
                  y={RECORD.top}
                  width={x(end) - x(start)}
                  height={RECORD.bottom - RECORD.top}
                  className="fill-fg-primary/8"
                />
                <text
                  x={(x(start) + x(end)) / 2}
                  y={RECORD.top - 3}
                  textAnchor="middle"
                  className={TEXT}
                >
                  {t(`record.${id}`)}
                </text>
              </g>
            ))}
            {VALUE_TICKS.map((value) => (
              <g key={value}>
                <line
                  x1={LEFT}
                  x2={RIGHT}
                  y1={recordY(value)}
                  y2={recordY(value)}
                  className="stroke-fg-primary/10"
                />
                <text x={LEFT - 4} y={recordY(value) + 3} textAnchor="end" className={TEXT}>
                  {f.number(value)}
                </text>
              </g>
            ))}
            {RECORD_TICKS.map((tick) => (
              <text
                key={tick}
                x={x(tick)}
                y={RECORD.height - 3}
                textAnchor="middle"
                className={TEXT}
              >
                {year0(tick)}
              </text>
            ))}
            <path d={groups} fill="none" className="stroke-fg-tertiary" strokeWidth={1} />
            <path d={sunspots} fill="none" className="stroke-fg-primary" strokeWidth={1.2} />
            <line
              x1={markX}
              x2={markX}
              y1={RECORD.top}
              y2={RECORD.bottom}
              className="stroke-accent"
              strokeWidth={1.4}
            />
          </svg>
        </ZoomFigure>
        <p className="mt-1 flex flex-wrap gap-x-3 text-micro text-fg-secondary">
          <span>
            <span aria-hidden className="mr-1 inline-block h-px w-3 bg-fg-primary align-middle" />
            {t("record.sunspotNumber")}
          </span>
          <span>
            <span aria-hidden className="mr-1 inline-block h-px w-3 bg-fg-tertiary align-middle" />
            {t("record.groups", {
              factor: f.number(SUNSPOTS_PER_GROUP, { maximumFractionDigits: 0 }),
            })}
          </span>
          <span>
            <span aria-hidden className="mr-1 inline-block h-2.5 w-px bg-accent align-middle" />
            {t("hud.modelYear", { value: year0(Math.floor(year)) })}
          </span>
        </p>
        <p className="mt-1 text-micro text-fg-tertiary">{t("record.recordSource")}</p>
      </RailSection>
      <RailSection title={t("record.butterfly")}>
        <ZoomFigure
          title={t("record.butterfly")}
          label={<span className={kickerClass}>{t("record.model")}</span>}
        >
          <svg
            viewBox={`0 0 ${W} ${BUTTERFLY.height}`}
            role="img"
            aria-label={t("record.butterflyLabel", { from: cycle - 1, to: cycle + 1 })}
            className="w-full text-accent"
          >
            {shades.map((d, s) => (
              <path key={s} d={d} fill="currentColor" opacity={BUTTERFLY_OPACITY[s]} />
            ))}
            {BUTTERFLY_TICKS_DEG.map((deg) => (
              <g key={deg}>
                <line
                  x1={LEFT}
                  x2={RIGHT}
                  y1={latitudeY(deg)}
                  y2={latitudeY(deg)}
                  className={deg === 0 ? "stroke-fg-primary/25" : "stroke-fg-primary/10"}
                />
                <text x={LEFT - 4} y={latitudeY(deg) + 3} textAnchor="end" className={TEXT}>
                  {t("record.degrees", { value: f.number(deg) })}
                </text>
              </g>
            ))}
            {[cycle - 1, cycle, cycle + 1].map((n) => (
              <text
                key={n}
                x={butterflyX(yearOfCycleCount(n + 0.5), cycle)}
                y={BUTTERFLY.height - 3}
                textAnchor="middle"
                className={TEXT}
              >
                {t("record.cycle", { number: n })}
              </text>
            ))}
            <line
              x1={butterflyX(year, cycle)}
              x2={butterflyX(year, cycle)}
              y1={BUTTERFLY.top}
              y2={BUTTERFLY.bottom}
              className="stroke-fg-primary"
              strokeWidth={1.2}
            />
          </svg>
        </ZoomFigure>
        <p className="mt-1 text-micro text-fg-tertiary">{t("record.butterflySource")}</p>
      </RailSection>
    </Rail>
  );
}

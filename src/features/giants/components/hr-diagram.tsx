"use client";

import { useLocale } from "next-intl";

import {
  SOLAR_TEFF_K,
  blackbodyColor,
  cssColor,
  formatSignificant,
  powerOfTen,
} from "@horizon/toolkit/science";

import { HR_GROUPS, HR_POINTS, groupOf, type HrPoint } from "../lib/model/compare";
import type { RungId } from "../lib/model/rungs";
import { useGiants } from "../lib/store";
import { useGiantsT } from "./format";

/** The plot's box in SVG units, and the margins its axis labels take. */
const W = 280;
const H = 176;
const LEFT = 34;
const BOTTOM = 18;
const TOP = 6;
const RIGHT = 6;

/** Its reach in temperature (hot on the left, as astronomers draw it) and light, by decades. */
const HOT_K = 60_000;
const COOL_K = 2_000;
const BRIGHT = 1e8;
const DIM = 1e-4;
/** The ticks it labels, and the radii (R☉) its lines of equal size are drawn for. */
const KELVIN_TICKS = [30_000, 10_000, 3_000];
const LIGHT_TICKS = [1e6, 1e3, 1, 1e-3];
const RADII = [0.01, 1, 100, 1000];

const lerp = (v: number, from: number, to: number, a: number, b: number) =>
  a + ((Math.log10(v) - Math.log10(from)) / (Math.log10(to) - Math.log10(from))) * (b - a);
const xOf = (kelvin: number) => lerp(kelvin, HOT_K, COOL_K, LEFT, W - RIGHT);
const yOf = (light: number) => lerp(light, BRIGHT, DIM, TOP, H - BOTTOM);
/** Light of a star of this radius (R☉) and temperature: L = R² (T/T☉)⁴. */
const lightAt = (radius: number, kelvin: number) => radius ** 2 * (kelvin / SOLAR_TEFF_K) ** 4;
/** The temperature at which a line of equal radius reaches this light. */
const kelvinAt = (radius: number, light: number) => SOLAR_TEFF_K * (light / radius ** 2) ** 0.25;

/** A label's gap above the band it names, and the width a band needs to be followed, SVG units. */
const LABEL_GAP = 9;
const BAND_MIN = 60;
/** The main sequence's label runs beneath it, in the empty space below the band, clear of its stars. */
const BELOW: ReadonlySet<string> = new Set(["mainSequence"]);
/** The labels' type size, SVG units. */
const LABEL_SIZE = 8;

/**
 * Each group's label, laid along its band (from its hottest star to its coolest, as the main
 * sequence runs diagonally) and lifted just above it.
 */
const GROUPS = HR_GROUPS.map((group) => {
  const members = HR_POINTS.filter((point) => groupOf(point.id) === group);
  const hot = members.reduce((a, b) => (b.kelvin > a.kelvin ? b : a));
  const cool = members.reduce((a, b) => (b.kelvin < a.kelvin ? b : a));
  const [x1, y1, x2, y2] = [xOf(hot.kelvin), yOf(hot.light), xOf(cool.kelvin), yOf(cool.light)];
  const angle = x2 - x1 > BAND_MIN ? (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI : 0;
  const lift = BELOW.has(group) ? LABEL_GAP + LABEL_SIZE : -LABEL_GAP;
  return { group, x: (x1 + x2) / 2, y: (y1 + y2) / 2, angle, lift };
});

/** Where a line of equal radius leaves the plot on its cool, faint side: its label's place. */
function radiusLine(radius: number) {
  const hot = { x: xOf(HOT_K), y: yOf(lightAt(radius, HOT_K)) };
  const coolK = Math.max(COOL_K, kelvinAt(radius, DIM));
  return { hot, end: { x: xOf(coolK), y: yOf(lightAt(radius, coolK)) } };
}

const colourOf = (point: HrPoint) => cssColor(blackbodyColor(point.kelvin));

/**
 * The body in focus on a Hertzsprung–Russell diagram among every star on the ladder: hot on
 * the left, bright at the top, with diagonal lines of equal radius, so size reads as light
 * and temperature together. Absent for bodies that do not shine by their temperature.
 */
export function HrDiagram({ id }: { id: RungId }) {
  const { t } = useGiantsT();
  const locale = useLocale();
  const focus = HR_POINTS.find((point) => point.id === id);
  if (!focus) return null;
  const go = (point: HrPoint) => useGiants.getState().goTo(point.id);
  return (
    <figure className="flex flex-col gap-1.5">
      <figcaption className="text-xs text-muted">{t("hr.title")}</figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full text-muted"
        role="img"
        aria-label={t("hr.label", { name: t(`rungs.${id}.name`) })}
      >
        <defs>
          <clipPath id="giants-hr-plot">
            <rect x={LEFT} y={TOP} width={W - LEFT - RIGHT} height={H - TOP - BOTTOM} />
          </clipPath>
        </defs>
        <rect
          x={LEFT}
          y={TOP}
          width={W - LEFT - RIGHT}
          height={H - TOP - BOTTOM}
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.25}
        />
        {KELVIN_TICKS.map((kelvin) => (
          <text
            key={kelvin}
            x={xOf(kelvin)}
            y={H - 5}
            textAnchor="middle"
            className="fill-current font-mono text-[8px]"
          >
            {`${formatSignificant(kelvin, locale, 2)} K`}
          </text>
        ))}
        <text
          transform={`translate(7 ${(TOP + H - BOTTOM) / 2}) rotate(-90)`}
          textAnchor="middle"
          className="fill-current text-[8px]"
        >
          {t("hr.light")}
        </text>
        {LIGHT_TICKS.map((light) => (
          <text
            key={light}
            x={LEFT - 4}
            y={yOf(light) + 3}
            textAnchor="end"
            className="fill-current font-mono text-[8px]"
          >
            {light === 1 ? "1" : powerOfTen(Math.log10(light))}
          </text>
        ))}
        <g clipPath="url(#giants-hr-plot)">
          {RADII.map((radius) => {
            const line = radiusLine(radius);
            return (
              <g key={radius}>
                <line
                  x1={line.hot.x}
                  y1={line.hot.y}
                  x2={line.end.x}
                  y2={line.end.y}
                  stroke="currentColor"
                  strokeOpacity={0.3}
                  strokeDasharray="2 3"
                />
                <text
                  x={line.end.x - 3}
                  y={line.end.y - 4}
                  textAnchor="end"
                  className="fill-current font-mono text-[7px]"
                >
                  {`${formatSignificant(radius, locale, 1)} ${t("units.sun")}`}
                </text>
              </g>
            );
          })}
        </g>
        {GROUPS.map(({ group, x, y, angle, lift }) => (
          <text
            key={group}
            transform={`translate(${x} ${y}) rotate(${angle}) translate(0 ${lift})`}
            textAnchor="middle"
            fontSize={LABEL_SIZE}
            className="fill-current italic"
          >
            {t(`hr.groups.${group}`)}
          </text>
        ))}
        <g className="text-fg">
          {HR_POINTS.map((point) => (
            <circle
              key={point.id}
              cx={xOf(point.kelvin)}
              cy={yOf(point.light)}
              r={point.id === id ? 4 : 2.5}
              fill={colourOf(point)}
              stroke="currentColor"
              strokeOpacity={point.id === id ? 0 : 0.35}
              strokeWidth={0.6}
              className="cursor-pointer"
              onClick={() => go(point)}
            >
              <title>{t(`rungs.${point.id}.name`)}</title>
            </circle>
          ))}
          <circle
            cx={xOf(focus.kelvin)}
            cy={yOf(focus.light)}
            r={7}
            fill="none"
            className="stroke-solar"
            strokeWidth={1}
          />
        </g>
      </svg>
      <p className="flex justify-between pl-7 text-[11px] text-muted" aria-hidden>
        <span>{t("hr.hotter")}</span>
        <span>{t("hr.cooler")}</span>
      </p>
      <p className="text-xs leading-relaxed text-muted">{t("hr.lesson")}</p>
    </figure>
  );
}

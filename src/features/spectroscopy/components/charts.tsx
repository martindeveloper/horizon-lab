"use client";

import { useFormatter } from "next-intl";

import { cssColor, wavelengthColor } from "@horizon/toolkit/science";

import { ionizationEnergy, type Line } from "../lib/model/atoms";
import { SPECTRAL_CLASSES } from "../lib/model/stars";
import { levelName } from "./format";
import { useDrawingGamut } from "./use-gamut";

const W = 280;

/**
 * The transition on an energy ladder: the ground state, the line's two levels and the
 * ionization limit, with the photon going in (absorbed) or out (emitted) in its own colour.
 */
export function LevelDiagram({
  line,
  emitting,
  labels,
}: {
  line: Line;
  emitting: boolean;
  labels: { ground: string; limit: string; title: string };
}) {
  const f = useFormatter();
  const gamut = useDrawingGamut();
  const limit = ionizationEnergy(line.species);
  const H = 132;
  const y = (eV: number) => H - 14 - (eV / limit) * (H - 30);
  const colour = cssColor(wavelengthColor(line.wavelength, gamut), 1, gamut);
  const lower = y(line.lower);
  const upper = y(line.upper);
  const x = 132;
  const ev = (v: number) =>
    `${f.number(v, { maximumFractionDigits: 2, minimumFractionDigits: 2 })} eV`;
  const showGround = line.lower > limit * 0.06;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={labels.title} className="w-full">
      <title>{labels.title}</title>
      <line
        x1={70}
        x2={W - 4}
        y1={y(limit)}
        y2={y(limit)}
        className="stroke-muted/60"
        strokeDasharray="3 3"
      />
      <text
        x={W - 4}
        y={y(limit) - 4}
        textAnchor="end"
        className="fill-subtle font-mono text-[9px]"
      >
        {labels.limit} · {ev(limit)}
      </text>
      {showGround ? (
        <>
          <line x1={70} x2={190} y1={y(0)} y2={y(0)} className="stroke-muted/60" />
          <text x={194} y={y(0) + 3} className="fill-subtle font-mono text-[9px]">
            {labels.ground}
          </text>
        </>
      ) : null}
      <line x1={70} x2={190} y1={lower} y2={lower} className="stroke-fg" strokeWidth={1.4} />
      <line x1={70} x2={190} y1={upper} y2={upper} className="stroke-fg" strokeWidth={1.4} />
      <text
        x={64}
        y={lower + 3}
        textAnchor="end"
        className="fill-muted font-mono text-[9px] tabular-nums"
      >
        {ev(line.lower)}
      </text>
      <text
        x={64}
        y={upper + 3}
        textAnchor="end"
        className="fill-muted font-mono text-[9px] tabular-nums"
      >
        {ev(line.upper)}
      </text>
      <text x={194} y={lower + 3} className="fill-fg font-mono text-[9px]">
        {levelName(line, line.lowerLevel)}
      </text>
      <text x={194} y={upper + 3} className="fill-fg font-mono text-[9px]">
        {levelName(line, line.upperLevel)}
      </text>
      <line
        x1={x}
        x2={x}
        y1={emitting ? upper + 2 : lower - 2}
        y2={emitting ? lower - 6 : upper + 6}
        stroke={colour}
        strokeWidth={2}
      />
      <path
        d={
          emitting
            ? `M${x - 4} ${lower - 7} L${x} ${lower - 1} L${x + 4} ${lower - 7} Z`
            : `M${x - 4} ${upper + 7} L${x} ${upper + 1} L${x + 4} ${upper + 7} Z`
        }
        fill={colour}
      />
      <path
        d={wave(emitting ? x + 8 : 80, (lower + upper) / 2, emitting ? 44 : 44)}
        fill="none"
        stroke={colour}
        strokeWidth={1.4}
      />
    </svg>
  );
}

function wave(x0: number, y0: number, length: number) {
  let d = `M${x0} ${y0}`;
  for (let i = 1; i <= 24; i++) {
    const x = x0 + (length * i) / 24;
    d += ` L${x.toFixed(1)} ${(y0 + Math.sin((i / 24) * Math.PI * 6) * 3).toFixed(1)}`;
  }
  return d;
}

/**
 * The curve of growth: log W against log of the number of atoms, the current gas marked.
 * Straight (W ∝ N) while the line is thin, nearly flat once its core is black, then W ∝ √N
 * as the wings take over.
 */
export function GrowthChart({
  points,
  labels,
}: {
  points: readonly [number, number][];
  labels: { title: string; x: string; y: string; weak: string; saturated: string; damped: string };
}) {
  if (points.length < 3) return null;
  const H = 104;
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const [x0, x1] = [Math.min(...xs), Math.max(...xs)];
  const [y0, y1] = [Math.min(...ys), Math.max(...ys)];
  const px = (v: number) => 24 + ((v - x0) / (x1 - x0)) * (W - 32);
  const py = (v: number) => H - 18 - ((v - y0) / Math.max(1e-6, y1 - y0)) * (H - 30);
  const here = points.reduce((best, p) => (Math.abs(p[0]) < Math.abs(best[0]) ? p : best));
  const path = points
    .map((p, i) => `${i ? "L" : "M"}${px(p[0]).toFixed(1)} ${py(p[1]).toFixed(1)}`)
    .join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={labels.title} className="w-full">
      <title>{labels.title}</title>
      <line x1={24} x2={W - 8} y1={H - 18} y2={H - 18} className="stroke-border-strong" />
      <line x1={24} x2={24} y1={8} y2={H - 18} className="stroke-border-strong" />
      <text x={W - 8} y={H - 5} textAnchor="end" className="fill-subtle font-mono text-[9px]">
        {labels.x}
      </text>
      <text x={4} y={12} className="fill-subtle font-mono text-[9px]">
        {labels.y}
      </text>
      <text x={px(x0 + (x1 - x0) * 0.12)} y={H - 24} className="fill-subtle text-[9px]">
        {labels.weak}
      </text>
      <text
        x={px(x0 + (x1 - x0) * 0.5)}
        y={py(y0 + (y1 - y0) * 0.55) + 14}
        className="fill-subtle text-[9px]"
      >
        {labels.saturated}
      </text>
      <text x={W - 10} y={22} textAnchor="end" className="fill-subtle text-[9px]">
        {labels.damped}
      </text>
      <path d={path} fill="none" className="stroke-fg" strokeWidth={1.3} />
      <circle cx={px(here[0])} cy={py(here[1])} r={3.5} className="fill-solar" />
    </svg>
  );
}

/**
 * How strong this line is in main-sequence stars from hot (left, as spectral types run) to
 * cool, the star in view marked: Payne's insight that temperature, not composition, sets the
 * sequence.
 */
export function SequenceChart({
  points,
  marker,
  labels,
}: {
  points: readonly [number, number][];
  marker: number | null;
  labels: { title: string; y: string };
}) {
  if (points.length < 3) return null;
  const H = 96;
  const lo = Math.log(Math.min(...points.map((p) => p[0])));
  const hi = Math.log(Math.max(...points.map((p) => p[0])));
  const top = Math.max(...points.map((p) => p[1])) || 1;
  const px = (T: number) => 8 + ((hi - Math.log(T)) / (hi - lo)) * (W - 16);
  const py = (w: number) => H - 22 - (w / top) * (H - 34);
  const path = points
    .map((p, i) => `${i ? "L" : "M"}${px(p[0]).toFixed(1)} ${py(p[1]).toFixed(1)}`)
    .join(" ");
  const fill = `${path} L${px(points.at(-1)![0]).toFixed(1)} ${H - 22} L${px(points[0]![0]).toFixed(1)} ${H - 22} Z`;
  const at = marker === null ? null : interpolate(points, marker);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={labels.title} className="w-full">
      <title>{labels.title}</title>
      <text x={8} y={10} className="fill-subtle font-mono text-[9px]">
        {labels.y}
      </text>
      <path d={fill} className="fill-fg/8" />
      <path d={path} fill="none" className="stroke-fg" strokeWidth={1.3} />
      <line x1={8} x2={W - 8} y1={H - 22} y2={H - 22} className="stroke-border-strong" />
      {SPECTRAL_CLASSES.map(([name, bound], i) => {
        const upper = i === 0 ? Math.exp(hi) : SPECTRAL_CLASSES[i - 1]![1];
        const lower = Math.max(bound, Math.exp(lo));
        if (upper <= Math.exp(lo) || lower >= Math.exp(hi)) return null;
        const mid = Math.sqrt(Math.min(upper, Math.exp(hi)) * lower);
        return (
          <g key={name}>
            {i > 0 && bound > Math.exp(lo) && SPECTRAL_CLASSES[i - 1]![1] < Math.exp(hi) ? (
              <line
                x1={px(SPECTRAL_CLASSES[i - 1]![1])}
                x2={px(SPECTRAL_CLASSES[i - 1]![1])}
                y1={H - 22}
                y2={H - 17}
                className="stroke-border-strong"
              />
            ) : null}
            <text
              x={px(mid)}
              y={H - 6}
              textAnchor="middle"
              className="fill-subtle font-mono text-[10px]"
            >
              {name}
            </text>
          </g>
        );
      })}
      {at !== null && marker !== null ? (
        <circle cx={px(marker)} cy={py(at)} r={3.5} className="fill-solar" />
      ) : null}
    </svg>
  );
}

function interpolate(points: readonly [number, number][], T: number) {
  const sorted = [...points].sort((a, b) => a[0] - b[0]);
  if (T <= sorted[0]![0] || T >= sorted.at(-1)![0]) return null;
  const i = sorted.findIndex((p) => p[0] >= T);
  const [ta, wa] = sorted[i - 1]!;
  const [tb, wb] = sorted[i]!;
  return wa + ((T - ta) / (tb - ta)) * (wb - wa);
}

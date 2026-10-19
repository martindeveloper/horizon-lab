"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useMemo, type ReactNode } from "react";

import { dopplerFactor } from "@horizon/toolkit/science";
import { Chip, Slider } from "@horizon/toolkit/ui";

import { MEASURE_LINES, type ElementId } from "../lib/model/atoms";
import { useSpectroscopy } from "../lib/store";
import { lineName, signed, wavelength } from "./format";
import { useObservation, useSpectrum } from "./use-spectrum";

/** The lens's reach either side of the laboratory wavelength, km/s. */
const REACH = 250;
const TICKS = [-200, -100, 0, 100, 200];
const SAMPLES = 240;

/** The element measured on: the one picked, if still marked, else the one marked last. */
export const measuredElement = (compare: readonly ElementId[], measure: ElementId | null) =>
  measure && compare.includes(measure) ? measure : (compare.at(-1) ?? null);

/**
 * Measuring a velocity the way astronomers do: one line, close up, on an axis of velocity.
 * The dashed line is where the line lies in the laboratory; the gold marker is where the
 * visitor says it lies in the spectrum. Sliding the marker onto the line's centre reads the
 * source's radial velocity, v = c·Δλ/λ (relativistic, `dopplerFactor`), and every lab line of
 * every marked element shifts by the same factor under the spectrum.
 */
export function VelocityLens({ step }: { step: ReactNode }) {
  const t = useTranslations("spectroscopy");
  const f = useFormatter();
  const obs = useObservation();
  const compare = useSpectroscopy((s) => s.compare);
  const measure = useSpectroscopy((s) => s.measure);
  const velocity = useSpectroscopy((s) => s.velocity);
  const api = useSpectroscopy.getState;
  const element = measuredElement(compare, measure);
  const line = element ? MEASURE_LINES[element] : undefined;
  const lab = line?.wavelength ?? 500;
  const range: readonly [number, number] = useMemo(
    () => [lab * dopplerFactor(-REACH), lab * dopplerFactor(REACH)],
    [lab],
  );
  const spectrum = useSpectrum(obs, range, line ? SAMPLES : 0);
  const [from, to] = range;
  const xOf = (nm: number) => ((nm - from) / (to - from)) * 100;
  const glowing = obs.kind === "slab" && obs.background === null;

  /* Flux against the continuum (the top is the continuum), or for a glowing gas against its
     brightest light anywhere (the bottom is dark): a window with no line stays flat. */
  const path = useMemo(() => {
    if (!spectrum) return "";
    const { flux, continuum, peak } = spectrum;
    const n = flux.length;
    const y = Array.from(flux, (v, i) =>
      glowing ? v / (peak || 1) : continuum[i]! > 0 ? v / continuum[i]! : 1,
    );
    const lo = glowing ? 0 : Math.min(0.9, ...y);
    const hi = glowing ? Math.max(0.1, ...y) : 1;
    return y
      .map((v, i) => {
        const px = (i / (n - 1)) * 100;
        const py = 92 - ((v - lo) / (hi - lo)) * 84;
        return `${i ? "L" : "M"}${px.toFixed(2)},${py.toFixed(2)}`;
      })
      .join("");
  }, [spectrum, glowing]);

  const observed = lab * dopplerFactor(velocity);
  const kms = (v: number) => t("dock.kms", { value: signed(f, v) });

  return (
    <div
      role="group"
      aria-label={t("dock.shift")}
      className="flex min-w-0 flex-col gap-1.5 md:gap-2"
    >
      <div className="flex h-5 items-center justify-between gap-3 text-xs">
        <span className="text-muted">{step}</span>
        <span className="font-mono text-fg tabular-nums">{line ? kms(velocity) : null}</span>
      </div>
      {line ? (
        <div>
          <div className="rounded-md bg-fg/[0.03] ring-1 ring-border ring-inset">
            {/* The line measured, and the marked elements to measure on instead. */}
            <div className="flex items-center justify-between gap-2 px-2.5 pt-1.5">
              <span className="truncate font-mono text-[11px] text-muted tabular-nums">
                {line.species} {wavelength(f, lab)} nm
              </span>
              {compare.length > 1 ? (
                <div
                  role="group"
                  aria-label={t("dock.measuring")}
                  className="no-scrollbar -mr-1 flex min-w-0 items-center gap-0.5 overflow-x-auto"
                >
                  {compare.map((e) => (
                    <Chip
                      key={e}
                      selected={e === element}
                      aria-pressed={e === element}
                      aria-label={`${t("dock.measuring")}: ${lineName(MEASURE_LINES[e], f)}`}
                      onClick={() => api().setMeasure(e)}
                      className="h-9 min-w-9 shrink-0 px-2 font-mono text-[11px] md:h-6 md:min-w-7"
                    >
                      {e}
                    </Chip>
                  ))}
                </div>
              ) : null}
            </div>
            {/* Inset by the thumb's half-width, so the marker stands right above the thumb. */}
            <div aria-hidden className="relative mx-[7px] mt-1 h-11 md:h-16 short:h-7">
              <svg
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                className="absolute inset-0 size-full overflow-visible"
              >
                {TICKS.map((v) => (
                  <line
                    key={v}
                    x1={xOf(lab * dopplerFactor(v))}
                    x2={xOf(lab * dopplerFactor(v))}
                    y1={0}
                    y2={100}
                    className={v === 0 ? "stroke-fg/45" : "stroke-fg/8"}
                    strokeDasharray={v === 0 ? "3 3" : undefined}
                    vectorEffect="non-scaling-stroke"
                  />
                ))}
                <path
                  d={path}
                  fill="none"
                  className="stroke-fg/85"
                  strokeWidth={1.25}
                  vectorEffect="non-scaling-stroke"
                />
                <line
                  x1={xOf(observed)}
                  x2={xOf(observed)}
                  y1={0}
                  y2={100}
                  className="stroke-accent"
                  strokeWidth={2}
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
            </div>
            {/* Velocity along the axis; zero is the laboratory wavelength. */}
            <div aria-hidden className="relative mx-[7px] h-5 font-mono text-[10px] text-subtle">
              {TICKS.map((v) => (
                <span
                  key={v}
                  className="absolute top-1 -translate-x-1/2 tabular-nums"
                  style={{ left: `${xOf(lab * dopplerFactor(v))}%` }}
                >
                  {v === 0 ? t("dock.lab") : signed(f, v)}
                </span>
              ))}
            </div>
          </div>
          <Slider
            aria-label={t("dock.shift")}
            min={-REACH}
            max={REACH}
            step={1}
            value={[velocity]}
            valueText={kms}
            onValueChange={([v]) => api().setVelocity(v ?? 0)}
          />
          <p className="font-mono text-[11px] text-subtle tabular-nums not-md:hidden">
            {t("dock.reading", {
              shift: signed(f, observed - lab, 2),
              observed: wavelength(f, observed),
            })}
          </p>
        </div>
      ) : (
        <p className="grid h-24 place-items-center rounded-md px-6 text-center text-xs text-pretty text-muted ring-1 ring-border ring-inset md:h-36 short:h-20">
          {t("dock.markFirst")}
        </p>
      )}
    </div>
  );
}

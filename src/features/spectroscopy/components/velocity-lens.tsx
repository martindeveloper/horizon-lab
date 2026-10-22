"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useId, useMemo, type ReactNode } from "react";

import { dopplerWavelengthRatio } from "@horizon/toolkit/science";
import { Chip, Slider, cn } from "@horizon/toolkit/ui";

import { measuredElement, measureLine } from "../lib/model/atoms";
import { useSpectroscopy } from "../lib/store";
import { lineName, signed, wavelength } from "./format";
import { useFormedLines, useObservation, useSpectrum } from "./use-spectrum";

/** The lens's reach either side of the laboratory wavelength, km/s. */
const REACH = 250;
const TICKS = [-200, -100, 0, 100, 200];
const SAMPLES = 240;

/**
 * Measuring a velocity the way astronomers do: one line, close up, on an axis of velocity.
 * The dashed line is where the line lies in the laboratory; the gold marker is where the
 * visitor says it lies in the spectrum. Sliding the marker onto the line's centre reads the
 * source's radial velocity, v = c·Δλ/λ (relativistic, `dopplerWavelengthRatio`), and every lab line of
 * every marked element shifts by the same factor under the spectrum.
 */
export function VelocityLens({ step }: { step: ReactNode }) {
  const t = useTranslations("spectroscopy");
  const f = useFormatter();
  const obs = useObservation();
  const formed = useFormedLines(obs);
  const compare = useSpectroscopy((s) => s.compare);
  const measure = useSpectroscopy((s) => s.measure);
  const velocity = useSpectroscopy((s) => s.velocity);
  const api = useSpectroscopy.getState;
  /* A plain id: useId's punctuation does not survive url(#…). */
  const clip = `lens-${useId().replace(/[^a-zA-Z0-9-]/g, "")}`;
  const element = measuredElement(compare, measure);
  const line = element ? measureLine(element, formed) : undefined;
  const lab = line?.wavelength ?? 500;
  const range: readonly [number, number] = useMemo(
    () => [lab * dopplerWavelengthRatio(-REACH), lab * dopplerWavelengthRatio(REACH)],
    [lab],
  );
  const shown = useSpectrum(obs, range, line ? SAMPLES : 0);
  const [from, to] = range;
  /* Only the measured line's own window is drawn: another line's would sit off the axis. */
  const spectrum = shown?.range[0] === from && shown.range[1] === to ? shown.spectrum : null;
  const xOf = (nm: number) => ((nm - from) / (to - from)) * 100;
  const seen = shown?.obs ?? obs;
  const glowing = seen.kind === "slab" && seen.background === null;

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

  const observed = lab * dopplerWavelengthRatio(velocity);
  const kms = (v: number) => t("dock.kms", { value: signed(f, v) });

  return (
    <div
      role="group"
      aria-label={t("dock.shift")}
      className="flex min-w-0 flex-col gap-1.5 md:gap-2"
    >
      <div className="flex h-5 items-center justify-between gap-3 text-xs">
        <span className="text-fg-secondary">{step}</span>
        <span className="font-mono text-fg-primary tabular-nums">
          {line ? kms(velocity) : null}
        </span>
      </div>
      {/* One shape whether or not there is a line to measure yet, so marking the first element
          never changes the dock's height. */}
      <div>
        <div className="rounded-md bg-fg-primary/[0.03] ring-1 ring-border ring-inset">
          {/* The line measured, and the marked elements to measure on instead. */}
          <div className="flex h-9 items-center justify-between gap-2 px-2.5 pt-1.5 md:h-7">
            <span
              className={cn(
                "truncate text-[11px] tabular-nums",
                line ? "font-mono text-fg-secondary" : "text-fg-tertiary",
              )}
            >
              {line ? `${line.species} ${wavelength(f, lab)} nm` : t("dock.markFirst")}
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
                    aria-label={`${t("dock.measuring")}: ${lineName(measureLine(e, formed), f)}`}
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
                  x1={xOf(lab * dopplerWavelengthRatio(v))}
                  x2={xOf(lab * dopplerWavelengthRatio(v))}
                  y1={0}
                  y2={100}
                  className={v === 0 ? "stroke-fg-primary/45" : "stroke-fg-primary/8"}
                  strokeDasharray={v === 0 ? "3 3" : undefined}
                  vectorEffect="non-scaling-stroke"
                />
              ))}
              <defs>
                <clipPath id={clip}>
                  <rect x={0} y={-10} width={100} height={120} />
                </clipPath>
              </defs>
              <path
                d={line ? path : ""}
                fill="none"
                className="stroke-fg-primary/85"
                strokeWidth={1.25}
                vectorEffect="non-scaling-stroke"
              />
              {/* The profile reflected about the marker (λ → 2λ_m − λ, a mirror in x here). A
                  line is symmetric about its centre, so the two curves coincide exactly when
                  the marker sits on it: the mirror (bisector) method of finding a line's
                  centre, precise even across a broad, flat-bottomed core. */}
              {line ? (
                <g clipPath={`url(#${clip})`}>
                  <path
                    d={path}
                    transform={`translate(${2 * xOf(observed)} 0) scale(-1 1)`}
                    fill="none"
                    className="stroke-accent/60"
                    strokeWidth={1}
                    vectorEffect="non-scaling-stroke"
                  />
                </g>
              ) : null}
              <line
                x1={xOf(observed)}
                x2={xOf(observed)}
                y1={0}
                y2={100}
                className={line ? "stroke-accent" : "stroke-fg-primary/15"}
                strokeWidth={2}
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          </div>
          {/* Velocity along the axis; zero is the laboratory wavelength. */}
          <div aria-hidden className="relative mx-[7px] h-5 font-mono text-[10px] text-fg-tertiary">
            {TICKS.map((v) => (
              <span
                key={v}
                className="absolute top-1 -translate-x-1/2 tabular-nums"
                style={{ left: `${xOf(lab * dopplerWavelengthRatio(v))}%` }}
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
          disabled={!line}
          onValueChange={([v]) => api().setVelocity(v ?? 0)}
        />
        <p className="font-mono text-[11px] text-fg-tertiary tabular-nums not-md:hidden">
          {line
            ? t("dock.reading", {
                shift: signed(f, observed - lab, 2),
                observed: wavelength(f, observed),
              })
            : "—"}
        </p>
        {/* The method, in a line: a desktop has the room; a phone's dock keeps the slider in view. */}
        {line ? (
          <p className="text-[11px] text-pretty text-fg-tertiary not-md:hidden short:hidden">
            {t("dock.mirror")}
          </p>
        ) : null}
      </div>
    </div>
  );
}

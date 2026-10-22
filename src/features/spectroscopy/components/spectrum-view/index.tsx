"use client";

import { Minus, Plus, ScanLine } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useMemo, useRef } from "react";

import { dopplerWavelengthRatio } from "@horizon/toolkit/science";
import { IconButton, Tooltip, cn } from "@horizon/toolkit/ui";

import { lineById, measuredElement, type Line } from "../../lib/model/atoms";
import { FULL_RANGE, markerVelocity } from "../../lib/model/scenes";
import { qualityScale } from "../../lib/quality";
import { useSpectroscopy } from "../../lib/store";
import { digitsFor, lineName, wavelength } from "../format";
import { useDrawingGamut } from "../use-gamut";
import { useFormedLines, useObservation, useSettings, useSpectrum } from "../use-spectrum";
import { lineLabels, markerLabels, markerLines, visibleLines } from "./labels";
import { FLUX_GRID, FLUX_LABELS, axisTicks, usePlotPath } from "./plot";
import { useRibbon } from "./ribbon";
import { useBoxSize } from "./use-box-size";
import { useWindowGestures } from "./use-window-gestures";

/** The ribbon halo's width in CSS pixels, with the Glow switch on. */
const RIBBON_HALO_PX = 6;

/**
 * The spectrum: the light as the eye would see it spread out (the ribbon), the laboratory
 * wavelengths of the elements being compared, and the measured flux. Hover reads a
 * wavelength; a click or the arrow keys pick a line; the wheel, a pinch or the buttons zoom,
 * a drag pans.
 */
export function SpectrumView({ className }: { className?: string }) {
  const t = useTranslations("spectroscopy");
  const f = useFormatter();
  const settings = useSettings();
  /* The settings leave out a velocity that only moves the markers (a mystery's); read it here. */
  const rawVelocity = useSpectroscopy((s) => s.velocity);
  const obs = useObservation();
  const range = useSpectroscopy((s) => s.range);
  const normalizedSetting = useSpectroscopy((s) => s.normalized);
  const letters = useSpectroscopy((s) => s.letters);
  const compare = useSpectroscopy((s) => s.compare);
  const measure = useSpectroscopy((s) => s.measure);
  const preview = useSpectroscopy((s) => s.preview);
  const selection = useSpectroscopy((s) => s.selection);
  const checked = useSpectroscopy((s) => s.result !== null);
  const api = useSpectroscopy.getState;

  const box = useRef<HTMLDivElement>(null);
  const ribbon = useRef<HTMLCanvasElement>(null);
  const surface = useRef<HTMLDivElement>(null);
  const gamut = useDrawingGamut();
  const { width, dpr } = useBoxSize(box);
  /* The plot is SVG, smoothed by the browser: anti-aliasing has nothing to add, and must not
     change how finely the spectrum is sampled. */
  const scale = useSpectroscopy((s) => qualityScale(dpr, s.quality));
  /* While the guide moves, a spectrum per frame at one sample per CSS pixel keeps it smooth. */
  const moving = useSpectroscopy((s) => s.guideOpen && !s.guideLanded);
  const samples = Math.min(2400, Math.round(width * (moving ? 1 : scale)));
  const shown = useSpectrum(obs, range, samples);
  const spectrum = shown?.spectrum ?? null;
  useEffect(() => {
    if (spectrum && !api().ready) api().setReady();
  }, [spectrum, api]);

  /* Everything over the plot follows the spectrum on screen: its window, its source and lines,
     until the newer one the settings ask for arrives. */
  const seen = shown?.obs ?? obs;
  const formed = useFormedLines(seen);
  const drawn = shown?.range ?? range;
  const [from, to] = drawn;
  const span = to - from;
  const xOf = (nm: number) => (nm - from) / span;
  const glowing = seen.kind === "slab" && seen.background === null;
  const normalized = normalizedSetting && !glowing;
  /** Lines may be named: everywhere but an unsolved mystery. */
  const identify = settings.view !== "mystery" || checked;
  const name = (line: Line) => lineName(line, f);

  const visible = useMemo(
    () => (spectrum ? visibleLines(formed, spectrum, from, to, glowing) : []),
    [formed, spectrum, from, to, glowing],
  );
  /* The Glow switch's halo, 6 CSS pixels wide, in the ribbon's own pixels. */
  const glow = useSpectroscopy((s) => s.glow);
  useRibbon(ribbon, spectrum, gamut, glow ? (RIBBON_HALO_PX * samples) / Math.max(1, width) : 0);
  const plot = usePlotPath(spectrum, normalized, glowing);
  const { step, ticks, minorTicks } = axisTicks(from, to);
  const labels = lineLabels({
    visible,
    letters,
    view: settings.view,
    velocity: seen.velocity,
    air: seen.airmass > 0,
    identify,
    span,
    width,
    xOf,
    name,
  });

  /* Lab lines straight through the ribbon and the plot: the element in focus (previewed, or
     the one measured on, else the last marked) in full gold, the others faint, so a line that
     sits in a dip reads at a glance. */
  const markerShift = dopplerWavelengthRatio(
    markerVelocity({ view: settings.view, velocity: rawVelocity }),
  );
  const previewing = preview !== null && !compare.includes(preview) ? preview : null;
  const focus = preview ?? measuredElement(compare, measure);
  const marked = previewing ? [...compare, previewing] : compare;
  const markers = markerLines(marked, focus, markerShift, xOf);
  const markerNames = markerLabels(markers, focus, width, name);

  const selected = selection ? lineById(selection) : undefined;
  const selectedCentre = selected
    ? (visible.find((v) => v.line.id === selected.id)?.centre ??
      selected.wavelength * dopplerWavelengthRatio(seen.velocity))
    : null;

  const { hover, hovered, handlers } = useWindowGestures({
    surface,
    range: drawn,
    width,
    visible,
    identify,
    selectedCentre,
  });
  const digits = digitsFor(span);

  return (
    <section
      aria-label={t("spectrum.label")}
      className={cn(
        "spectroscopy-spectrum pointer-events-auto relative flex min-h-0 flex-col select-none",
        className,
      )}
    >
      {/* The plot takes whatever height the stage has to spare, and gives it up first when short. */}
      <div ref={box} className="relative flex min-h-0 flex-1 flex-col [&>*]:shrink-0">
        <div aria-hidden className="relative h-5 text-[11px] leading-5 short:hidden">
          {labels.map((l, i) => (
            <span
              key={l.key}
              style={{ left: `${l.x * 100}%`, "--i": Math.min(i, 16) }}
              className={cn(
                "spectroscopy-label absolute -translate-x-1/2 whitespace-nowrap",
                l.letter ? "font-display text-solar" : "font-mono text-space-muted",
              )}
            >
              {l.text}
            </span>
          ))}
        </div>
        {/* A canvas keeps the colour space of its first context: a new gamut takes a new one. */}
        <canvas
          key={gamut}
          ref={ribbon}
          aria-hidden
          className="spectroscopy-ribbon block h-[clamp(1.5rem,5dvh,3rem)] w-full rounded-[3px]"
          style={{ imageRendering: "pixelated" }}
        />
        {/* The focused element's lines, named; the lines themselves run through everything. */}
        <div aria-hidden className="relative mt-0.5 h-3.5 font-mono text-[10px] leading-3.5">
          {markerNames.map((l) => (
            <span
              key={l.key}
              /* Centred on its line, or held inside the edges. */
              style={{
                left: `${l.x * 100}%`,
                translate: l.x < 0.05 ? "0" : l.x > 0.95 ? "-100%" : "-50%",
              }}
              className="absolute anim-fade rounded-sm bg-space/80 px-1 whitespace-nowrap text-solar"
            >
              {l.text}
            </span>
          ))}
        </div>
        <div
          aria-hidden
          className="relative mt-1.5 min-h-12 shrink! grow! basis-[clamp(3rem,17dvh,9rem)]"
        >
          <svg
            className="absolute inset-0 block size-full overflow-visible"
            viewBox={`0 0 ${Math.max(1, plot?.n ?? 1) - 1} 100`}
            preserveAspectRatio="none"
          >
            {plot
              ? FLUX_GRID.filter((v) => v <= plot.ceiling).map((v) => (
                  <line
                    key={`y${v}`}
                    x1={0}
                    x2={plot.n - 1}
                    y1={100 - (v / plot.ceiling) * 100}
                    y2={100 - (v / plot.ceiling) * 100}
                    className="stroke-space-fg/[0.07]"
                    vectorEffect="non-scaling-stroke"
                  />
                ))
              : null}
            {plot
              ? ticks.map((v) => (
                  <line
                    key={`x${v}`}
                    x1={xOf(v) * (plot.n - 1)}
                    x2={xOf(v) * (plot.n - 1)}
                    y1={0}
                    y2={100}
                    className="stroke-space-fg/[0.07]"
                    vectorEffect="non-scaling-stroke"
                  />
                ))
              : null}
            {plot && normalized ? (
              <line
                x1={0}
                x2={plot.n - 1}
                y1={plot.unit}
                y2={plot.unit}
                className="stroke-space-fg/25"
                strokeDasharray="3 4"
                vectorEffect="non-scaling-stroke"
              />
            ) : null}
            {plot?.cont ? (
              <path
                d={plot.cont}
                fill="none"
                className="stroke-space-fg/30"
                strokeDasharray="3 4"
                vectorEffect="non-scaling-stroke"
              />
            ) : null}
            {plot ? (
              <path
                d={plot.line}
                fill="none"
                className="stroke-space-fg"
                strokeWidth={1.25}
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            ) : null}
          </svg>
          {/* The flux scale, inside the plot's left edge, and what it measures. */}
          {plot
            ? FLUX_LABELS.filter((v) => v <= plot.ceiling).map((v) => (
                <span
                  key={v}
                  style={{ top: `${100 - (v / plot.ceiling) * 100}%` }}
                  className="absolute left-0 -translate-y-1/2 rounded-sm bg-space/70 px-0.5 font-mono text-[10px] leading-none text-space-muted tabular-nums"
                >
                  {f.number(v, { minimumFractionDigits: v % 1 ? 1 : 0 })}
                </span>
              ))
            : null}
          <span className="absolute -top-1 left-7 font-mono text-[10px] leading-none text-space-muted not-md:hidden">
            {normalized
              ? t("spectrum.normalized")
              : glowing
                ? t("spectrum.glow")
                : t("spectrum.flux")}
          </span>
        </div>
        {/* The wavelength axis: minor ticks, labelled major ones, and its unit at the end. */}
        <div
          aria-hidden
          className="relative mt-1 h-4 font-mono text-[10px] text-space-muted tabular-nums"
        >
          {minorTicks.map((v) => (
            <span
              key={`m${v}`}
              style={{ left: `${xOf(v) * 100}%` }}
              className="absolute top-0 h-1 w-px bg-space-fg/20"
            />
          ))}
          {ticks.map((v) => (
            <span key={v}>
              <span
                style={{ left: `${xOf(v) * 100}%` }}
                className="absolute top-0 h-1.5 w-px bg-space-fg/40"
              />
              {/* A label that would run into the unit gives way to it. */}
              {xOf(v) * width + 16 < width - 22 ? (
                <span
                  style={{ left: `${xOf(v) * 100}%` }}
                  className="absolute top-1.5 -translate-x-1/2 leading-none whitespace-nowrap"
                >
                  {f.number(v, { maximumFractionDigits: step < 1 ? 2 : 0 })}
                </span>
              ) : null}
            </span>
          ))}
          <span className="absolute top-1.5 right-0 leading-none">nm</span>
        </div>

        {/* Lab lines of the marked elements, through ribbon and plot */}
        {markers.length ? (
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-5 bottom-5">
            {markers.map(({ line, x, weight }) => (
              <span
                key={line.id}
                style={{ left: `${x * 100}%`, opacity: weight }}
                className={cn(
                  "absolute inset-y-0 w-px transition-opacity duration-control ease-standard",
                  line.element === previewing
                    ? "bg-[repeating-linear-gradient(to_bottom,rgb(var(--solar))_0_3px,transparent_3px_6px)]"
                    : "bg-solar",
                )}
              />
            ))}
          </div>
        ) : null}
        {selectedCentre !== null && xOf(selectedCentre) >= 0 && xOf(selectedCentre) <= 1 ? (
          <span
            aria-hidden
            style={{ left: `${xOf(selectedCentre) * 100}%` }}
            className="pointer-events-none absolute top-5 bottom-5 w-px bg-solar shadow-[0_0_6px_rgb(var(--solar)/0.6)]"
          />
        ) : null}
        {selection &&
        selectedCentre !== null &&
        xOf(selectedCentre) >= 0 &&
        xOf(selectedCentre) <= 1 ? (
          <span
            key={selection}
            aria-hidden
            style={{ left: `${xOf(selectedCentre) * 100}%` }}
            className="spectroscopy-pulse pointer-events-none absolute top-5 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-solar"
          />
        ) : null}
        {hover !== null ? (
          <span
            aria-hidden
            style={{ left: `${xOf(hovered?.centre ?? hover) * 100}%` }}
            className="pointer-events-none absolute top-5 bottom-5 w-px bg-space-fg/40"
          />
        ) : null}
        {hover !== null ? (
          <span
            aria-hidden
            style={{ left: `${Math.min(0.85, Math.max(0.02, xOf(hover))) * 100}%` }}
            className="pointer-events-none absolute -top-1 z-20 rounded-sm bg-space/85 px-1.5 py-0.5 font-mono text-[11px] whitespace-nowrap text-space-fg tabular-nums"
          >
            {hovered
              ? `${lineName(hovered.line, f)} · ${wavelength(f, hovered.centre, digits)} nm`
              : `${wavelength(f, hover, digits)} nm`}
          </span>
        ) : null}

        <div
          ref={surface}
          role="slider"
          data-spectrum-surface
          tabIndex={0}
          aria-label={t("spectrum.surface", {
            from: wavelength(f, from, digits),
            to: wavelength(f, to, digits),
          })}
          aria-orientation="horizontal"
          aria-valuemin={from}
          aria-valuemax={to}
          aria-valuenow={selectedCentre ?? (from + to) / 2}
          aria-valuetext={
            selected && selectedCentre !== null
              ? `${lineName(selected, f)} · ${wavelength(f, selectedCentre, digits)} nm`
              : t("spectrum.window", {
                  from: wavelength(f, from, digits),
                  to: wavelength(f, to, digits),
                })
          }
          aria-describedby="spectroscopy-spectrum-keys"
          onPointerDown={handlers.onPointerDown}
          onPointerMove={handlers.onPointerMove}
          onPointerUp={handlers.onPointerUp}
          onPointerCancel={handlers.onPointerUp}
          onPointerLeave={handlers.onPointerLeave}
          onDoubleClick={() => api().setRange(FULL_RANGE)}
          onKeyDown={handlers.onKeyDown}
          className="absolute inset-x-0 top-5 bottom-5 cursor-crosshair touch-none rounded-sm outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
        />
        <p id="spectroscopy-spectrum-keys" className="sr-only">
          {t("spectrum.keys")}
        </p>
      </div>

      <div className="mt-1 flex items-center justify-between gap-3 short:hidden">
        <p className="font-mono text-[11px] text-space-muted tabular-nums">
          {t("spectrum.window", {
            from: wavelength(f, from, digits),
            to: wavelength(f, to, digits),
          })}
        </p>
        <div className="flex items-center gap-1">
          {/* The dock sits just below: these tips open upward. */}
          <Tooltip label={t("spectrum.zoomOut")} side="top">
            <IconButton aria-label={t("spectrum.zoomOut")} onClick={() => api().zoom(1 / 0.6)}>
              <Minus className="size-3.5" />
            </IconButton>
          </Tooltip>
          <Tooltip label={t("spectrum.zoomIn")} side="top">
            <IconButton
              aria-label={t("spectrum.zoomIn")}
              onClick={() => api().zoom(0.6, selectedCentre ?? undefined)}
            >
              <Plus className="size-3.5" />
            </IconButton>
          </Tooltip>
          <Tooltip label={t("spectrum.reset")} align="end" side="top">
            <IconButton
              aria-label={t("spectrum.reset")}
              aria-disabled={from === FULL_RANGE[0] && to === FULL_RANGE[1]}
              onClick={() => api().setRange(FULL_RANGE)}
              className="aria-disabled:opacity-40"
            >
              <ScanLine className="size-3.5" />
            </IconButton>
          </Tooltip>
        </div>
      </div>
    </section>
  );
}

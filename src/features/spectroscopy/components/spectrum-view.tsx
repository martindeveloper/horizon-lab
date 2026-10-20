"use client";

import { Minus, Plus, ScanLine } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

import { dopplerFactor, wavelengthColor, type Gamut, type Rgb } from "@horizon/toolkit/science";
import { IconButton, Tooltip, cn } from "@horizon/toolkit/ui";

import { LINES, NAMED, labStrength, lineById, type ElementId, type Line } from "../lib/model/atoms";
import { markerVelocity } from "../lib/model/scenes";
import { depthAt, type Spectrum } from "../lib/model/spectrum";
import { BAND_HEADS } from "../lib/model/telluric";
import { FULL_RANGE } from "../lib/model/tour";
import { context2d, qualityScale } from "../lib/quality";
import { useSpectroscopy } from "../lib/store";
import { digitsFor, lineName, wavelength } from "./format";
import { useDrawingGamut } from "./use-gamut";
import { useFormedLines, useObservation, useSettings, useSpectrum } from "./use-spectrum";
import { measuredElement } from "./velocity-lens";

/** Hues of each nanometre in each gamut, computed once: the ribbon's colours. */
const HUES = new Map<Gamut, readonly Rgb[]>();
function huesIn(gamut: Gamut) {
  let hues = HUES.get(gamut);
  if (!hues) {
    hues = Array.from({ length: FULL_RANGE[1] - FULL_RANGE[0] + 2 }, (_, i) =>
      wavelengthColor(FULL_RANGE[0] + i, gamut),
    );
    HUES.set(gamut, hues);
  }
  return hues;
}
function hueAt(nm: number, hues: readonly Rgb[]): readonly [number, number, number] {
  const x = Math.min(hues.length - 1.001, Math.max(0, nm - FULL_RANGE[0]));
  const i = Math.floor(x);
  const t = x - i;
  const a = hues[i]!;
  const b = hues[i + 1]!;
  return [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1]), a[2] + t * (b[2] - a[2])];
}

/** The eye barely sees the ends of the range: the ribbon fades there, as the tile's does. */
function edgeFade(nm: number) {
  const smooth = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
  return 0.35 + 0.65 * smooth((nm - 380) / 50) * smooth((770 - nm) / 80);
}

/** Flux gridlines, and the values labelled on them. */
const FLUX_GRID = [0, 0.25, 0.5, 0.75, 1];
const FLUX_LABELS = [0, 0.5, 1];

/** Tick spacing for a window: about eight labelled ticks. */
function tickStep(span: number) {
  for (const step of [0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50]) if (span / step <= 9) return step;
  return 100;
}

/** How strong a laboratory line is, 0–1 within its element (`labStrength`). */
const markWeights = new Map<ElementId, Map<string, number>>();
for (const line of LINES) {
  const index = labStrength(line);
  const map = markWeights.get(line.element) ?? new Map<string, number>();
  map.set(line.id, index);
  markWeights.set(line.element, map);
}
for (const map of markWeights.values()) {
  const top = Math.max(...map.values());
  for (const [id, v] of map) map.set(id, Math.max(0.25, 1 - (top - v) / 3));
}

type Visible = { line: Line; centre: number; strength: number };

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
  const formed = useFormedLines(obs);
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
  const gamut = useDrawingGamut();
  const [width, setWidth] = useState(0);
  const [dpr, setDpr] = useState(1);
  /* The plot is SVG, smoothed by the browser: anti-aliasing has nothing to add, and must not
     change how finely the spectrum is sampled. */
  const scale = useSpectroscopy((s) => qualityScale(dpr, s.quality));
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      setWidth(el.clientWidth);
      setDpr(window.devicePixelRatio || 1);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  /* While the guide moves, a spectrum per frame at one sample per CSS pixel keeps it smooth. */
  const moving = useSpectroscopy((s) => s.guideOpen && !s.guideLanded);
  const samples = Math.min(2400, Math.round(width * (moving ? 1 : scale)));
  const spectrum = useSpectrum(obs, range, samples);
  useEffect(() => {
    if (spectrum && !api().ready) api().setReady();
  }, [spectrum, api]);

  const [from, to] = range;
  const span = to - from;
  const xOf = (nm: number) => (nm - from) / span;
  const glowing = obs.kind === "slab" && obs.background === null;
  const normalized = normalizedSetting && !glowing;
  /** Lines may be named: everywhere but an unsolved mystery. */
  const identify = settings.view !== "mystery" || checked;

  const visible: Visible[] = useMemo(() => {
    if (!spectrum) return [];
    const out: Visible[] = [];
    for (const { line, centre } of formed) {
      if (centre < from || centre > to) continue;
      const strength = glowing ? emissionAt(spectrum, centre) : depthAt(spectrum, centre);
      if (strength > 0.015) out.push({ line, centre, strength });
    }
    return out.sort((a, b) => a.centre - b.centre);
  }, [formed, spectrum, from, to, glowing]);

  /* The ribbon: each pixel the hue of its wavelength at the brightness of its light. */
  useEffect(() => {
    const canvas = ribbon.current;
    if (!canvas || !spectrum) return;
    const n = spectrum.wavelengths.length;
    canvas.width = n;
    canvas.height = 1;
    const ctx = context2d(canvas, gamut);
    if (!ctx) return;
    const image = ctx.createImageData(n, 1, {
      colorSpace: gamut === "p3" ? "display-p3" : "srgb",
    });
    const hues = huesIn(gamut);
    const top = spectrum.peak || 1;
    for (let i = 0; i < n; i++) {
      const nm = spectrum.wavelengths[i]!;
      const [r, g, b] = hueAt(nm, hues);
      const level = Math.sqrt(Math.max(0, spectrum.flux[i]! / top)) * edgeFade(nm);
      image.data[i * 4] = r * level * 255;
      image.data[i * 4 + 1] = g * level * 255;
      image.data[i * 4 + 2] = b * level * 255;
      image.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(image, 0, 0);
  }, [spectrum, gamut]);

  /* The plot's path, in a viewBox one unit per sample by 100. */
  const plot = useMemo(() => {
    if (!spectrum) return null;
    const { flux, continuum, peak } = spectrum;
    const n = flux.length;
    const values = new Float64Array(n);
    let top = 0;
    for (let i = 0; i < n; i++) {
      values[i] = normalized ? flux[i]! / (continuum[i]! || 1) : flux[i]! / (peak || 1);
      top = Math.max(top, values[i]!);
    }
    const ceiling = normalized ? Math.max(1.08, top * 1.04) : 1.06;
    const y = (v: number) => 100 - (v / ceiling) * 100;
    let line = "";
    let cont = "";
    for (let i = 0; i < n; i++) {
      line += `${i ? "L" : "M"}${i} ${y(values[i]!).toFixed(2)}`;
      if (!normalized && !glowing)
        cont += `${i ? "L" : "M"}${i} ${y(continuum[i]! / (peak || 1)).toFixed(2)}`;
    }
    return { n, line, cont, unit: y(1), ceiling };
  }, [spectrum, normalized, glowing]);

  const step = tickStep(span);
  const ticks: number[] = [];
  for (let v = Math.ceil(from / step) * step; v <= to + 1e-9; v += step) ticks.push(v);
  /* Minor ticks: fifths of a step, or quarters of a step of 2. */
  const minor = step / (String(step).replace(/[0.]/g, "").startsWith("2") ? 4 : 5);
  const minorTicks: number[] = [];
  for (let k = Math.ceil(from / minor); k * minor <= to + 1e-9; k++)
    if (Math.abs((k * minor) / step - Math.round((k * minor) / step)) > 1e-6)
      minorTicks.push(k * minor);

  /* Names over the lines: Fraunhofer's letters on the Sun, species when zoomed in. */
  const labels = (() => {
    const out: { key: string; x: number; text: string; letter: boolean }[] = [];
    if (letters && settings.view === "sun") {
      const formedIds = new Set(visible.map((v) => v.line.id));
      for (const named of NAMED) {
        if (!named.letter || !formedIds.has(named.line.id)) continue;
        const centre = named.line.wavelength * dopplerFactor(settings.velocity);
        out.push({ key: named.line.id, x: xOf(centre), text: named.letter, letter: true });
      }
      if (settings.air)
        for (const [letter, head] of Object.entries(BAND_HEADS))
          out.push({ key: letter, x: xOf(head), text: letter, letter: true });
    } else if (identify && span < 25) {
      for (const v of [...visible].sort((a, b) => b.strength - a.strength).slice(0, 10))
        out.push({ key: v.line.id, x: xOf(v.centre), text: lineName(v.line, f), letter: false });
    }
    /* Keep labels apart: the first placed (strongest, or Fraunhofer's order) wins. */
    const placed: typeof out = [];
    const room = width > 0 ? (out.some((l) => !l.letter) ? 56 : 14) / width : 0;
    for (const label of out)
      if (label.x >= 0 && label.x <= 1 && placed.every((p) => Math.abs(p.x - label.x) > room))
        placed.push(label);
    return placed;
  })();

  /* Lab lines straight through the ribbon and the plot: the element in focus (previewed, or
     the one measured on, else the last marked) in full gold, the others faint, so a line that
     sits in a dip reads at a glance. */
  const markerShift = dopplerFactor(markerVelocity({ view: settings.view, velocity: rawVelocity }));
  const previewing = preview !== null && !compare.includes(preview) ? preview : null;
  const focus = preview ?? measuredElement(compare, measure);
  const marked = previewing ? [...compare, previewing] : compare;
  const markers = marked.flatMap((element) =>
    LINES.filter((l) => l.element === element)
      .map((l) => ({
        line: l,
        x: xOf(l.wavelength * markerShift),
        weight: (markWeights.get(element)?.get(l.id) ?? 0.5) * (element === focus ? 1 : 0.3),
      }))
      .filter(({ x }) => x >= 0 && x <= 1),
  );
  /* The focused element's strongest lines in view, named under the ribbon. */
  const markerLabels = (() => {
    if (!focus) return [];
    const out: { key: string; x: number; text: string }[] = [];
    const room = width > 0 ? 76 / width : 0;
    for (const m of markers
      .filter((m) => m.line.element === focus)
      .sort((a, b) => b.weight - a.weight)) {
      if (out.length >= 6) break;
      if (out.every((o) => Math.abs(o.x - m.x) > room))
        out.push({ key: m.line.id, x: m.x, text: lineName(m.line, f) });
    }
    return out;
  })();

  const selected = selection ? lineById(selection) : undefined;
  const selectedCentre = selected
    ? (visible.find((v) => v.line.id === selected.id)?.centre ??
      selected.wavelength * dopplerFactor(obs.velocity))
    : null;

  /* Pointer: hover reads, a tap picks, a drag pans, two fingers or the wheel zoom. The hover is
     kept as a fraction of the width, so a zoom under a still cursor reads the new wavelength. */
  const [hoverAt, setHoverAt] = useState<number | null>(null);
  const hover = hoverAt === null ? null : from + hoverAt * span;
  const pointers = useRef(new Map<number, number>());
  /** A gesture that has had a second finger is never a tap, until every finger lifts. */
  const gesture = useRef(false);
  const drag = useRef<{ x: number; range: readonly [number, number]; moved: boolean } | null>(null);
  const pinch = useRef<{ distance: number; range: readonly [number, number] } | null>(null);
  const surface = useRef<HTMLDivElement>(null);

  const fractionAt = (clientX: number) => {
    const rect = surface.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return 0;
    return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
  };
  const nmAt = (clientX: number) => from + fractionAt(clientX) * span;
  const nearest = (nm: number): Visible | null => {
    const tolerance = (10 / Math.max(1, width)) * span;
    let best: Visible | null = null;
    for (const v of visible)
      if (
        Math.abs(v.centre - nm) <= tolerance &&
        (!best || Math.abs(v.centre - nm) < Math.abs(best.centre - nm))
      )
        best = v;
    return best;
  };

  useEffect(() => {
    const el = surface.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const [a, b] = useSpectroscopy.getState().range;
      const about = a + ((e.clientX - rect.left) / rect.width) * (b - a);
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) api().pan(e.deltaX / Math.max(200, rect.width));
      else api().zoom(Math.exp(e.deltaY * 0.0015), about);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [api]);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, e.clientX);
    if (pointers.current.size === 2) {
      gesture.current = true;
      const [a, b] = [...pointers.current.values()];
      pinch.current = { distance: Math.abs(a! - b!), range };
      drag.current = null;
    } else drag.current = { x: e.clientX, range, moved: false };
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse") setHoverAt(fractionAt(e.clientX));
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, e.clientX);
    const rect = surface.current?.getBoundingClientRect();
    if (!rect) return;
    if (pinch.current && pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const distance = Math.max(8, Math.abs(a! - b!));
      const [lo, hi] = pinch.current.range;
      const centre = lo + (((a! + b!) / 2 - rect.left) / rect.width) * (hi - lo);
      const factor = pinch.current.distance / distance;
      api().setRange([centre - (centre - lo) * factor, centre + (hi - centre) * factor]);
    } else if (drag.current) {
      const dx = e.clientX - drag.current.x;
      if (Math.abs(dx) > 4) drag.current.moved = true;
      if (drag.current.moved) {
        const [lo, hi] = drag.current.range;
        const shift = (-dx / rect.width) * (hi - lo);
        api().setRange([lo + shift, hi + shift]);
      }
    }
  };
  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const wasDrag = drag.current?.moved || gesture.current;
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    if (pointers.current.size === 0) {
      if (!wasDrag && identify) api().select(nearest(nmAt(e.clientX))?.line.id ?? null);
      drag.current = null;
      gesture.current = false;
    }
  };

  const onKeyDown = (e: ReactKeyboardEvent) => {
    const keys: Record<string, () => void> = {
      "+": () => api().zoom(0.6),
      "=": () => api().zoom(0.6),
      "-": () => api().zoom(1 / 0.6),
      "0": () => api().setRange(FULL_RANGE),
    };
    if (keys[e.key]) {
      e.preventDefault();
      keys[e.key]!();
      return;
    }
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    if (e.shiftKey || !identify || visible.length === 0) {
      api().pan(e.key === "ArrowRight" ? 0.1 : -0.1);
      return;
    }
    const current = selectedCentre ?? (e.key === "ArrowRight" ? from - 1 : to + 1);
    const next =
      e.key === "ArrowRight"
        ? visible.find((v) => v.centre > current + 1e-6)
        : [...visible].reverse().find((v) => v.centre < current - 1e-6);
    if (next) api().select(next.line.id);
  };

  const hovered = hover !== null && identify ? nearest(hover) : null;
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
        {/* Names over the lines */}
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
          {markerLabels.map((l) => (
            <span
              key={l.key}
              /* Centred on its line, or held inside the edges. */
              style={{
                left: `${l.x * 100}%`,
                translate: l.x < 0.05 ? "0" : l.x > 0.95 ? "-100%" : "-50%",
              }}
              className="anim-fade absolute rounded-sm bg-space/80 px-1 whitespace-nowrap text-solar"
            >
              {l.text}
            </span>
          ))}
        </div>
        {/* The plot: flux on a labelled scale over faint gridlines. */}
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
                  "absolute inset-y-0 w-px transition-opacity duration-300",
                  line.element === previewing
                    ? "bg-[repeating-linear-gradient(to_bottom,rgb(var(--solar))_0_3px,transparent_3px_6px)]"
                    : "bg-solar",
                )}
              />
            ))}
          </div>
        ) : null}
        {/* The selected line, through ribbon and plot */}
        {selectedCentre !== null && xOf(selectedCentre) >= 0 && xOf(selectedCentre) <= 1 ? (
          <span
            aria-hidden
            style={{ left: `${xOf(selectedCentre) * 100}%` }}
            className="pointer-events-none absolute top-5 bottom-5 w-px bg-solar shadow-[0_0_6px_rgb(var(--solar)/0.6)]"
          />
        ) : null}
        {/* A new pick rings at the top of the ribbon */}
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

        {/* Hover, tap, drag, pinch and wheel all land here */}
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
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onPointerLeave={() => setHoverAt(null)}
          onDoubleClick={() => api().setRange(FULL_RANGE)}
          onKeyDown={onKeyDown}
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

/** A glowing gas's brightness at a wavelength, against its brightest light in view. */
function emissionAt(spectrum: Spectrum, nm: number) {
  const { wavelengths, flux, peak } = spectrum;
  const n = wavelengths.length;
  const x = ((nm - wavelengths[0]!) / (wavelengths[n - 1]! - wavelengths[0]!)) * (n - 1);
  const i = Math.round(x);
  return i >= 0 && i < n && peak > 0 ? flux[i]! / peak : 0;
}

"use client";

import { useEffect, useRef, useState } from "react";

import { median, refreshRate, vsyncWindows } from "./frame-stats-model";
import { cn } from "./utils";

/** Any frame meter: the frame rate now, and the times between recent frames (ms, oldest first). */
export type FrameSource = {
  rate: (now?: number) => number;
  intervals: () => readonly number[];
};

export type FrameStatsProps = {
  source: FrameSource;
  /** A bar per recent frame, as tall as the frame took, with its frame time beside the rate. */
  graph?: boolean;
  /**
   * The display's refresh rate and the vsync windows a frame takes; across the graph, a line per
   * window and bars marked by how many windows they missed.
   */
  vsync?: boolean;
  /** The JavaScript heap in use, where the browser reports it (Chromium); hidden elsewhere. */
  memory?: boolean;
  /** `idle` while nothing is drawn; `heap` names the memory row. */
  labels: { idle: string; heap?: string };
  className?: string;
};

type Reading = { fps: number; frameMs: number; hz: number; windows: number; heapMb: number | null };

const IDLE: Reading = { fps: 0, frameMs: 0, hz: 0, windows: 0, heapMb: null };
/** How often the numbers change, ms; the graph draws every display frame. */
const READ_MS = 250;
/** CSS px: one column per frame. */
const GRAPH_W = 120;
const GRAPH_H = 32;
/** Frames the numbers average over, and display frames the refresh rate is taken from. */
const RECENT = 30;
const DISPLAY = 60;

function heapMb() {
  const memory = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
  return memory ? memory.usedJSHeapSize / 1_048_576 : null;
}

/** Bars by the vsync windows a frame took: one, two, three or more; plain without vsync. */
function colours(el: Element) {
  const style = getComputedStyle(el);
  const get = (name: string) => style.getPropertyValue(name).trim();
  return {
    bar: get("--color-subtle"),
    late: get("--color-accent"),
    missed: get("--color-danger"),
    line: get("--color-border-strong"),
  };
}

function drawGraph(
  canvas: HTMLCanvasElement,
  intervals: readonly number[],
  refreshMs: number,
  vsync: boolean,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const dpr = window.devicePixelRatio || 1;
  if (canvas.width !== Math.round(GRAPH_W * dpr)) {
    canvas.width = Math.round(GRAPH_W * dpr);
    canvas.height = Math.round(GRAPH_H * dpr);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, GRAPH_W, GRAPH_H);
  const paint = colours(canvas);
  /* Three vsync windows tall, or 50 ms before the refresh rate is known. */
  const top = refreshMs > 0 ? refreshMs * 3 : 50;
  const y = (ms: number) => GRAPH_H - (Math.min(ms, top) / top) * GRAPH_H;
  const shown = intervals.slice(-GRAPH_W);
  const x0 = GRAPH_W - shown.length;
  shown.forEach((ms, i) => {
    const windows = vsync ? vsyncWindows(ms, refreshMs) : 1;
    ctx.fillStyle = windows >= 3 ? paint.missed : windows === 2 ? paint.late : paint.bar;
    ctx.fillRect(x0 + i, y(ms), 1, GRAPH_H - y(ms));
  });
  if (vsync && refreshMs > 0) {
    ctx.fillStyle = paint.line;
    for (const k of [1, 2]) ctx.fillRect(0, Math.round(y(refreshMs * k)), GRAPH_W, 1);
  }
}

/**
 * A frame-rate readout for any `FrameSource`: the rate alone by default; `graph`, `vsync` and
 * `memory` add a frame-time graph, the display's vsync windows and the JavaScript heap. Labels
 * come in props; units (fps, ms, Hz, MB) are printed as they are. Position it yourself.
 */
export function FrameStats({
  source,
  graph = false,
  vsync = false,
  memory = false,
  labels,
  className,
}: FrameStatsProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [reading, setReading] = useState(IDLE);

  useEffect(() => {
    const display: number[] = [];
    let previous: number | null = null;
    let lastRead = -Infinity;
    let frame = 0;
    const read = (now: number) => {
      const recent = source.intervals().slice(-RECENT);
      const refreshMs = median(display);
      const frameMs = median(recent);
      setReading({
        fps: Math.round(source.rate(now)),
        frameMs,
        hz: refreshRate(refreshMs),
        windows: vsyncWindows(frameMs, refreshMs),
        heapMb: memory ? heapMb() : null,
      });
    };
    /* The rate alone needs no display frames of its own. */
    if (!graph && !vsync) {
      const id = window.setInterval(() => read(performance.now()), READ_MS * 2);
      return () => window.clearInterval(id);
    }
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      /* The display's own frame times, for its refresh interval; a stall is not one. */
      if (previous !== null && now - previous < 250) {
        display.push(now - previous);
        if (display.length > DISPLAY) display.shift();
      }
      previous = now;
      if (graph && canvas.current)
        drawGraph(canvas.current, source.intervals(), median(display), vsync);
      if (now - lastRead >= READ_MS) {
        lastRead = now;
        read(now);
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [source, graph, vsync, memory]);

  const { fps, frameMs, hz, windows, heapMb: heap } = reading;
  const detailed = graph || vsync || memory;
  return (
    <div
      className={cn(
        "glass-pill font-mono text-[11px] text-fg tabular-nums",
        detailed ? "flex flex-col gap-1 rounded-lg px-2.5 py-1.5" : "rounded-full px-2.5 py-1",
        className,
      )}
    >
      <span>
        {fps > 0 ? `${fps} fps` : labels.idle}
        {fps > 0 && graph ? ` · ${frameMs.toFixed(1)} ms` : null}
      </span>
      {graph ? (
        <canvas
          ref={canvas}
          aria-hidden
          className="block"
          style={{ width: GRAPH_W, height: GRAPH_H }}
        />
      ) : null}
      {vsync && hz > 0 ? (
        <span className="text-subtle">
          {hz} Hz{fps > 0 && windows > 0 ? ` · ${windows}×` : null}
        </span>
      ) : null}
      {memory && heap !== null ? (
        <span className="text-subtle">
          {labels.heap ? `${labels.heap} ` : null}
          {heap.toFixed(0)} MB
        </span>
      ) : null}
    </div>
  );
}

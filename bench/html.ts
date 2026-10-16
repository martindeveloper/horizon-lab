import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { Eta } from "eta";

import { rollingMedian, type GrabDraw } from "@horizon/toolkit/bench";

import { comparisonWarnings, shaderLine, type Report, type Run, type Scaling } from "./report";

/**
 * The human report: Eta templates in `templates/` render a view model built
 * here. Templates hold markup and loops only; numbers arrive formatted and
 * chart geometry arrives computed. Eta escapes every `<%= %>` output.
 */
const TEMPLATES = fileURLToPath(new URL("templates/", import.meta.url));
const eta = new Eta({ views: TEMPLATES, cache: true });

const f = (value: number, digits = 2) => value.toFixed(digits);
const ms = (value: number) => `${f(value)} ms`;
const LEVEL = { error: "Error", regression: "Regression", warning: "Warning", info: "Note" };
const COLORS = [
  "#e8b860",
  "#7fb4ff",
  "#ff8f70",
  "#9be0a8",
  "#c99bff",
  "#ffd36e",
  "#6fd6d6",
  "#ff7fb0",
];
const anchor = (prefix: string, key: string) => `${prefix}-${key.replace(/[^\w-]+/g, "-")}`;

/** Per-frame times as polyline coordinates, with the median and hitch threshold. */
function sparkline(run: Run) {
  const sequence = run.sequence!;
  const values = sequence.timeline.map((frame) =>
    run.timer === "gpu" ? (frame.gpuMs ?? frame.wallMs) : frame.wallMs,
  );
  const limit = rollingMedian(values).map((m) => m * 2);
  const width = 300;
  const height = 56;
  const max = Math.max(...values, run.ms * 1.2, 1e-6);
  const x = (i: number) => (values.length > 1 ? (i / (values.length - 1)) * width : width / 2);
  const y = (v: number) => height - 4 - (Math.min(v, max) / max) * (height - 8);
  const line = (series: number[]) => series.map((v, i) => `${f(x(i), 1)},${f(y(v), 1)}`).join(" ");
  return {
    width,
    height,
    points: line(values),
    limit: line(limit),
    median: f(y(run.ms), 1),
    caption: `${sequence.frames} frames · worst ${ms(sequence.worst.ms)} at ${f(sequence.worst.progress)} · ${sequence.spikes.length} hitch(es)`,
  };
}

function card(run: Run) {
  const timing = run.gpu ?? run.wall;
  return {
    id: anchor("run", run.key),
    title: run.scene,
    size: `${run.width}×${run.height}`,
    description: run.description,
    strip: run.images.map((image) => ({ src: image.path, label: image.progress })),
    metrics: [
      { label: "median ms", value: f(run.ms) },
      { label: "p90 ms", value: f(timing.p90) },
      { label: "submit ms", value: f(run.submit.median) },
      { label: "ns / pixel", value: f(run.nsPerPixel, 1) },
    ],
    spark: run.sequence ? sparkline(run) : null,
    note: `${run.timer} timer · first frame ${f(run.firstFrameMs, 0)} ms`,
    links: [
      run.grab ? { href: `#${anchor("grab", run.key)}`, label: "frame grab" } : null,
      run.trace ? { href: run.trace, label: "trace" } : null,
      run.profile ? { href: run.profile, label: "cpu profile" } : null,
    ].filter(Boolean),
  };
}

function scalingChart(target: string, series: Scaling[], sizes: string[]) {
  const width = 640;
  const height = 300;
  const left = 44;
  const right = width - 12;
  const bottom = height - 44;
  const maxX = Math.max(...series.flatMap((s) => s.points.map((p) => p.pixels / 1e6)));
  const maxY = Math.max(...series.flatMap((s) => s.points.map((p) => p.ms))) * 1.1;
  const x = (mp: number) => left + (mp / maxX) * (right - left);
  const y = (value: number) => bottom - (value / maxY) * (bottom - 12);
  return {
    target,
    width,
    height,
    left,
    right,
    bottom,
    ticks: [0, 0.25, 0.5, 0.75, 1].map((t) => ({
      y: f(y(t * maxY), 1),
      x: f(x(t * maxX), 1),
      ms: f(t * maxY),
      mp: f(t * maxX, 1),
    })),
    series: series.map((s, i) => {
      const points = [...s.points].sort((a, b) => a.pixels - b.pixels);
      return {
        name: s.scene,
        color: COLORS[i % COLORS.length],
        points: points.map((p) => `${f(x(p.pixels / 1e6), 1)},${f(y(p.ms), 1)}`).join(" "),
        dots: points.map((p) => ({
          x: f(x(p.pixels / 1e6), 1),
          y: f(y(p.ms), 1),
          title: `${s.scene} ${p.size}: ${ms(p.ms)}`,
        })),
      };
    }),
    sizes,
    rows: series.map((s) => ({
      scene: s.scene,
      cells: sizes.map((size) => {
        const point = s.points.find((p) => p.size === size);
        return point ? f(point.ms) : "–";
      }),
      fixed: f(s.fit.fixedMs),
      slope: f(s.fit.msPerMegapixel),
      r2: f(s.fit.r2, 3),
    })),
  };
}

function comparison(report: Report) {
  const c = report.comparison;
  if (!c) return null;
  return {
    title: c.label ?? c.createdAt,
    status: c.likeForLike
      ? "Like for like: settings, environment and scenes match."
      : "Not like for like: these deltas are skewed.",
    likeForLike: c.likeForLike,
    code: c.sameCode === null ? null : c.sameCode ? "Same code as the baseline." : "Code changed.",
    warnings: comparisonWarnings(c),
    notes: [
      ...(c.missing.length ? [`Not measured this time: ${c.missing.join(", ")}.`] : []),
      ...(c.added.length ? [`Not in the baseline: ${c.added.join(", ")}.`] : []),
    ],
    rows: c.rows.map((row) => {
      const image = row.image;
      return {
        key: row.key,
        before: ms(row.beforeMs),
        after: ms(row.afterMs),
        delta: `${row.deltaPct >= 0 ? "+" : ""}${f(row.deltaPct, 1)}%`,
        deltaClass: row.slower ? "bad" : row.deltaPct < -3 ? "good" : "",
        diff:
          image === null
            ? "–"
            : image === "size"
              ? "size differs"
              : `${f(image.changed * 100, 2)}% · mean ${f(image.meanAbs)}`,
        diffClass: row.changed ? "bad" : "",
        scene: row.sceneChanged ? "changed" : row.sceneChanged === null ? "?" : "same",
        sceneClass: row.sceneChanged ? "bad" : "",
        heatmap: image && image !== "size" ? (image.heatmap ?? null) : null,
      };
    }),
  };
}

function grab(run: Run, draws: GrabDraw[]) {
  const g = run.grab!;
  const kib = (bytes: number) => `${f(bytes / 1024, 1)} KiB`;
  return {
    id: anchor("grab", run.key),
    key: run.key,
    summary: [
      `${g.calls} calls`,
      `${g.draws} draws in ${g.passes.length} pass(es)`,
      `${g.programs} program(s)`,
      `${g.stateChanges} state changes`,
      `uploads: ${g.uploads.textureCalls} texture (${kib(g.uploads.textureBytes)}), ${g.uploads.bufferCalls} buffer (${kib(g.uploads.bufferBytes)})`,
      ...(g.drawGpuMs === null ? [] : [`draws ${f(g.drawGpuMs, 3)} ms GPU`]),
    ].join(" · "),
    errors: g.errors.length ? g.errors.join(", ") : null,
    shaderLines: g.shaders.map(shaderLine),
    json: `${g.dir}/grab.json`,
    shaders: `${g.dir}/shaders/`,
    draws: draws.map((draw) => ({
      index: draw.index,
      fn: draw.fn,
      mode: draw.mode,
      count: draw.instances > 1 ? `${draw.count} ×${draw.instances}` : String(draw.count),
      program: draw.program ?? "–",
      target: draw.framebuffer ?? "screen",
      viewport: `${draw.viewport[2]}×${draw.viewport[3]}`,
      gpu: draw.gpuMs === null ? "–" : f(draw.gpuMs, 3),
      snapshot: draw.snapshot ?? null,
      snapshotError: draw.snapshotError ?? null,
      uniforms: JSON.stringify(draw.uniforms, null, 1),
    })),
  };
}

export function html(report: Report, grabs: Map<string, GrabDraw[]>) {
  const byTarget = new Map<string, Scaling[]>();
  for (const s of report.scaling) byTarget.set(s.target, [...(byTarget.get(s.target) ?? []), s]);
  return eta.render("./report", {
    title: `Bench report${report.label ? ` · ${report.label}` : ""}`,
    label: report.label,
    css: readFileSync(`${TEMPLATES}report.css`, "utf8"),
    meta: [
      `${report.createdAt} · ${report.gpu?.renderer ?? "unknown GPU"} · ${report.browser}`,
      `${report.machine.cpu}, ${report.machine.cores} cores, ${report.machine.memoryGb} GB · ${report.machine.platform}`,
      `Sizes ${report.options.sizes.join(", ")} · ${report.options.frames} frames · ${report.options.rounds} round(s) · ${report.command}`,
    ],
    findings: report.findings.map((finding) => ({ ...finding, label: LEVEL[finding.level] })),
    scenes: report.runs.filter((r) => r.kind === "static").map(card),
    sequences: report.runs.filter((r) => r.kind === "sequence").map(card),
    scaling: [...byTarget.entries()].map(([target, series]) =>
      scalingChart(target, series, report.options.sizes),
    ),
    comparison: comparison(report),
    grabs: report.runs.filter((r) => r.grab).map((r) => grab(r, grabs.get(r.key) ?? [])),
  });
}

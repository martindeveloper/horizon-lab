import type { Mismatch } from "./fingerprint";
import type { ComparisonSummary, Finding, GrabSummary, Report } from "./model";

const f = (value: number, digits = 2) => value.toFixed(digits);
const sig = (value: number) => Number(value.toPrecision(3));
const show = (value: unknown) => (typeof value === "string" ? value : JSON.stringify(value));

/** "frames 30 → 20" */
export const describeMismatch = (m: Mismatch) => `${m.field} ${show(m.before)} → ${show(m.after)}`;

/** Why a comparison is not like for like, one line per reason; empty when it is. */
export function comparisonWarnings(c: ComparisonSummary): string[] {
  const out: string[] = [];
  const settings = c.mismatches.filter((m) => m.scope === "settings");
  const environment = c.mismatches.filter((m) => m.scope === "environment");
  if (settings.length)
    out.push(
      `Settings differ from the baseline (${settings.map(describeMismatch).join(", ")}): timings are skewed.`,
    );
  if (environment.length)
    out.push(
      `Environment differs from the baseline (${environment.map(describeMismatch).join("; ")}): timings are not comparable.`,
    );
  if (c.legacy)
    out.push(
      "The baseline predates fingerprints: its scene definitions and some settings cannot be checked.",
    );
  if (c.changedScenes.length)
    out.push(
      `Scene definitions changed since the baseline (${c.changedScenes.join(", ")}): those rows compare different views.`,
    );
  return out;
}

/** Automatic observations; deliberately conservative, each with the number behind it. */
export function findings(
  report: Report,
  budgets: { slowdown: number | null; changed: number | null },
) {
  const out: Finding[] = [];
  for (const error of report.errors)
    out.push({ level: "error", key: error.key, message: error.message });
  const gpu = report.gpu;
  if (gpu && /swiftshader|llvmpipe|software/i.test(gpu.renderer))
    out.push({
      level: "warning",
      message: `Software rasteriser (${gpu.renderer}): timings do not describe a GPU.`,
    });
  if (gpu && !gpu.timerQueries)
    out.push({
      level: "info",
      message: "No GPU timer queries: times are wall clock to a 1-pixel readback.",
    });
  for (const run of report.runs) {
    if (run.grab?.errors.length)
      out.push({
        level: "error",
        key: run.key,
        message: `WebGL errors in the grabbed frame: ${run.grab.errors.join(", ")}.`,
      });
    if (run.sequence?.spikes.length) {
      const { worst } = run.sequence;
      out.push({
        level: "warning",
        key: run.key,
        message: `${run.sequence.spikes.length} of ${run.sequence.frames} frames took over twice their local median (hitches); worst ${f(worst.ms)} ms at progress ${f(worst.progress)}, sequence median ${f(run.ms)} ms.`,
      });
    }
    if (run.submit.median > Math.max(0.5, run.ms * 0.5))
      out.push({
        level: "info",
        key: run.key,
        message: `CPU submission (${f(run.submit.median)} ms) is at least half the frame (${f(run.ms)} ms): JavaScript or uploads, not shading, dominate.`,
      });
    if (run.heap && run.heap.after - run.heap.before > 2e6)
      out.push({
        level: "warning",
        key: run.key,
        message: `JS heap (after garbage collection) grew ${f((run.heap.after - run.heap.before) / 1e6, 1)} MB across the run: something outlives the scene.`,
      });
  }
  const firstScene = report.runs[0];
  if (firstScene && firstScene.firstFrameMs > 250)
    out.push({
      level: "info",
      key: firstScene.key,
      message: `First frame took ${f(firstScene.firstFrameMs, 0)} ms (shader compilation; later scenes reuse the browser's program cache).`,
    });
  // Fixed per-frame cost: one finding for all scenes, it is usually one cause.
  const fixed: string[] = [];
  for (const scaling of report.scaling) {
    const smallest = scaling.points.reduce((a, b) => (a.pixels < b.pixels ? a : b));
    if (scaling.fit.r2 < 0.9)
      out.push({
        level: "info",
        key: `${scaling.target}/${scaling.scene}`,
        message: `Frame time is not linear in pixel count (r² ${f(scaling.fit.r2)}): check caches, occupancy or resolution-dependent logic.`,
      });
    else if (scaling.fit.fixedMs > smallest.ms * 0.3 && scaling.fit.fixedMs > 0.1)
      fixed.push(
        `${scaling.scene} ${f(scaling.fit.fixedMs)} ms (${f((scaling.fit.fixedMs / smallest.ms) * 100, 0)}% at ${smallest.size})`,
      );
  }
  if (fixed.length)
    out.push({
      level: "info",
      message: `Per-frame cost that does not scale with pixels: ${fixed.join(", ")}. Small frames are dominated by it.`,
    });
  for (const row of report.comparison?.rows ?? []) {
    if (row.slower)
      out.push({
        level: "regression",
        key: row.key,
        message: `${f(row.beforeMs)} → ${f(row.afterMs)} ms (+${f(row.deltaPct, 1)}%), over the ${budgets.slowdown}% budget.`,
      });
    if (row.changed && row.image && row.image !== "size")
      out.push({
        level: "regression",
        key: row.key,
        message: `${f(row.image.changed * 100, 2)}% of pixels changed at progress ${row.image.progress}, over the ${budgets.changed}% budget.`,
      });
    if (row.changed && row.image === "size")
      out.push({
        level: "regression",
        key: row.key,
        message: "Image size differs from the baseline.",
      });
  }
  const tiny = (report.comparison?.rows ?? []).filter(
    (row) => Math.min(row.beforeMs, row.afterMs) < 0.5,
  );
  if (tiny.length)
    out.push({
      level: "info",
      message: `${tiny.length} compared run(s) take under 0.5 ms per frame, where run-to-run noise reaches ±30%: judge time changes at 1280×720 or larger.`,
    });
  const c = report.comparison;
  if (c) {
    for (const message of comparisonWarnings(c)) out.push({ level: "warning", message });
    if (c.missing.length)
      out.push({ level: "info", message: `Not measured this time: ${c.missing.join(", ")}.` });
    if (c.added.length)
      out.push({ level: "info", message: `Not in the baseline: ${c.added.join(", ")}.` });
    if (c.sameCode && c.rows.length) {
      const spread = Math.max(...c.rows.map((row) => Math.abs(row.deltaPct)));
      out.push({
        level: "info",
        message: `Same code as the baseline: time differences (up to ±${f(spread, 1)}%) are run-to-run noise.`,
      });
    }
  }
  const order = { error: 0, regression: 1, warning: 2, info: 3 };
  return out.sort((a, b) => order[a.level] - order[b.level]);
}

/** Compact, number-first summary for language models and scripts. */
export function llmSummary(report: Report) {
  return {
    about:
      "Headless WebGL benchmark. ms = median frame time on `timer` (gpu: timer queries; cpu: wall time to readback). " +
      "Lower is better. Keys are target/scene@WIDTHxHEIGHT. Full data: report.json; human report: index.html.",
    createdAt: report.createdAt,
    label: report.label,
    gpu: report.gpu?.renderer ?? null,
    browser: report.browser,
    machine: `${report.machine.cpu} · ${report.machine.platform}`,
    findings: report.findings,
    runs: report.runs.map((run) => ({
      key: run.key,
      kind: run.kind,
      timer: run.timer,
      ms: sig(run.ms),
      p90: sig((run.gpu ?? run.wall).p90),
      submitMs: sig(run.submit.median),
      nsPerPixel: sig(run.nsPerPixel),
      ...(run.sequence
        ? { spikes: run.sequence.spikes.length, worstMs: sig(run.sequence.worst.ms) }
        : {}),
      ...(run.grab
        ? {
            draws: run.grab.draws,
            calls: run.grab.calls,
            passes: run.grab.passes.length,
            programs: run.grab.programs,
          }
        : {}),
    })),
    scaling: report.scaling.map((s) => ({
      key: `${s.target}/${s.scene}`,
      fixedMs: sig(s.fit.fixedMs),
      msPerMegapixel: sig(s.fit.msPerMegapixel),
      r2: sig(s.fit.r2),
    })),
    fingerprints: report.fingerprints
      ? {
          settings: report.fingerprints.settings.hash,
          environment: report.fingerprints.environment.hash,
          code: report.fingerprints.code,
        }
      : null,
    comparison: report.comparison
      ? {
          baseline: report.comparison.label ?? report.comparison.createdAt,
          likeForLike: report.comparison.likeForLike,
          sameCode: report.comparison.sameCode,
          mismatches: report.comparison.mismatches.map((m) => `${m.scope}: ${describeMismatch(m)}`),
          changedScenes: report.comparison.changedScenes,
          missing: report.comparison.missing,
          added: report.comparison.added,
          rows: report.comparison.rows.map((row) => ({
            key: row.key,
            deltaPct: sig(row.deltaPct),
            changedPct:
              row.image && row.image !== "size" ? sig(row.image.changed * 100) : row.image,
            ...(row.sceneChanged ? { sceneChanged: true } : {}),
          })),
        }
      : null,
    errors: report.errors,
  };
}

function table(header: string[], rows: string[][]) {
  const line = (cells: string[]) => `| ${cells.join(" | ")} |`;
  return [line(header), line(header.map((_, i) => (i ? "---:" : "---"))), ...rows.map(line)].join(
    "\n",
  );
}

const LEVEL = { error: "Error", regression: "Regression", warning: "Warning", info: "Note" };

/** "program#1 fragment: 712 lines, 30.5 KiB → 70.6 KiB translated, compiles in 41.2 ms" */
export function shaderLine(shader: GrabSummary["shaders"][number]) {
  const translated =
    shader.translatedBytes === null
      ? ""
      : ` → ${f(shader.translatedBytes / 1024, 1)} KiB translated`;
  const compile = shader.compileMs === null ? "" : `, compiles in ${f(shader.compileMs, 1)} ms`;
  return `${shader.program} ${shader.type}: ${shader.lines} lines, ${f(shader.bytes / 1024, 1)} KiB${translated}${compile}`;
}

/** The same results as Markdown, for people and for pasting into a conversation. */
export function markdown(report: Report) {
  const lines: string[] = [];
  lines.push(`# Bench report${report.label ? `: ${report.label}` : ""}`, "");
  lines.push(
    `${report.createdAt} · ${report.gpu?.renderer ?? "unknown GPU"} · ${report.browser} · ${report.machine.cpu}`,
    "",
    `Sizes ${report.options.sizes.join(", ")} · ${report.options.frames} frames · ${report.options.rounds} round(s) · \`${report.command}\``,
    "",
    ...(report.fingerprints
      ? [
          `Fingerprints: settings \`${report.fingerprints.settings.hash}\` · environment \`${report.fingerprints.environment.hash}\` · code \`${report.fingerprints.code}\``,
          "",
        ]
      : []),
  );
  if (report.findings.length) {
    lines.push("## Findings", "");
    for (const finding of report.findings)
      lines.push(
        `- **${LEVEL[finding.level]}**${finding.key ? ` \`${finding.key}\`` : ""}: ${finding.message}`,
      );
    lines.push("");
  }
  const statics = report.runs.filter((r) => r.kind === "static");
  if (statics.length) {
    lines.push("## Scenes", "");
    lines.push(
      table(
        ["scene", "median ms", "p90 ms", "submit ms", "ns/px", "timer", "first ms"],
        statics.map((r) => [
          `\`${r.key}\``,
          f(r.ms),
          f((r.gpu ?? r.wall).p90),
          f(r.submit.median),
          f(r.nsPerPixel, 1),
          r.timer,
          f(r.firstFrameMs, 0),
        ]),
      ),
      "",
    );
  }
  const sequences = report.runs.filter((r) => r.sequence);
  if (sequences.length) {
    lines.push("## Sequences", "");
    lines.push(
      table(
        ["sequence", "frames", "median ms", "p90 ms", "worst ms", "at", "spikes", "submit ms"],
        sequences.map((r) => [
          `\`${r.key}\``,
          String(r.sequence!.frames),
          f(r.ms),
          f((r.gpu ?? r.wall).p90),
          f(r.sequence!.worst.ms),
          f(r.sequence!.worst.progress),
          String(r.sequence!.spikes.length),
          f(r.submit.median),
        ]),
      ),
      "",
    );
  }
  if (report.scaling.length) {
    lines.push(
      "## Resolution scaling",
      "",
      "Least-squares fit: ms = fixed + per-megapixel × MP.",
      "",
    );
    lines.push(
      table(
        ["scene", ...report.options.sizes, "fixed ms", "ms/MP", "r²"],
        report.scaling.map((s) => [
          `\`${s.target}/${s.scene}\``,
          ...report.options.sizes.map((size) => {
            const point = s.points.find((p) => p.size === size);
            return point ? f(point.ms) : "–";
          }),
          f(s.fit.fixedMs),
          f(s.fit.msPerMegapixel),
          f(s.fit.r2, 3),
        ]),
      ),
      "",
    );
  }
  if (report.comparison) {
    const c = report.comparison;
    lines.push(`## Compared with ${c.label ?? c.createdAt}`, "");
    const code =
      c.sameCode === null ? "" : c.sameCode ? " Same code as the baseline." : " Code changed.";
    lines.push(
      c.likeForLike
        ? `Like for like: settings, environment and scenes match.${code}`
        : `**Not like for like.**${code}`,
      "",
      ...comparisonWarnings(c).map((warning) => `- ${warning}`),
      ...(comparisonWarnings(c).length ? [""] : []),
    );
    lines.push(
      table(
        ["scene", "before ms", "after ms", "Δ", "pixels changed", "mean |Δ|", "scene"],
        c.rows.map((row) => [
          `\`${row.key}\``,
          f(row.beforeMs),
          f(row.afterMs),
          `${row.deltaPct >= 0 ? "+" : ""}${f(row.deltaPct, 1)}%${row.slower ? " ✗" : ""}`,
          row.image === null
            ? "–"
            : row.image === "size"
              ? "size differs"
              : `${f(row.image.changed * 100, 2)}%${row.changed ? " ✗" : ""}`,
          row.image && row.image !== "size" ? f(row.image.meanAbs) : "–",
          row.sceneChanged ? "changed ⚠" : row.sceneChanged === null ? "?" : "same",
        ]),
      ),
      "",
    );
  }
  const grabs = report.runs.filter((r) => r.grab);
  if (grabs.length) {
    lines.push("## Frame grabs", "");
    for (const run of grabs) {
      const g = run.grab!;
      const uploads = `uploads ${g.uploads.textureCalls} texture (${f(g.uploads.textureBytes / 1024, 1)} KiB), ${g.uploads.bufferCalls} buffer (${f(g.uploads.bufferBytes / 1024, 1)} KiB)`;
      const gpu = g.drawGpuMs !== null ? ` · draws ${f(g.drawGpuMs, 3)} ms GPU` : "";
      lines.push(
        `### \`${run.key}\``,
        "",
        `${g.calls} calls · ${g.draws} draws in ${g.passes.length} pass(es) · ${g.programs} program(s) · ${g.stateChanges} state changes · ${uploads}${gpu} · \`${g.dir}/grab.json\``,
        "",
        ...g.shaders.map((shader) => `- ${shaderLine(shader)}`),
        "",
      );
    }
  }
  lines.push(
    "## Files",
    "",
    "- `report.json`: everything, including per-frame timelines",
    "- `summary.json`: compact numbers and findings",
    "- `index.html`: images, charts, grabs",
    "",
  );
  return lines.join("\n");
}

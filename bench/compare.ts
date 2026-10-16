import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { diffFields, type BenchSettings, type Mismatch } from "./fingerprint";
import { compareImages } from "./images";
import type { Comparison, ComparisonSummary, Report, Run } from "./model";

/**
 * Comparing two runs: per-run time and image deltas, and whether the two
 * measured the same thing. Settings and environment are diffed field by
 * field; a run whose scene fingerprint differs compares different views.
 */

export function loadReport(dir: string): Report {
  const file = path.join(dir, "report.json");
  if (!existsSync(file)) throw new Error(`No report.json in ${dir}`);
  const payload: unknown = JSON.parse(readFileSync(file, "utf8"));
  if (!isReport(payload)) throw new Error(`${file} is from an older bench format; re-run it`);
  return payload;
}

/** Settings a report ran with; reports before fingerprints only know some of them. */
export function settingsOf(report: Report): Partial<BenchSettings> {
  return (
    report.fingerprints?.settings.values ?? {
      frames: report.options.frames,
      warmup: report.options.warmup,
      time: report.options.time,
      rounds: report.options.rounds,
    }
  );
}

export async function compare(
  report: Report,
  outDir: string,
  baselineDir: string,
  baseline: Report,
  expected: (run: Run) => boolean,
  budgets: { slowdown: number | null; changed: number | null },
): Promise<ComparisonSummary> {
  const rows: Comparison[] = [];
  const baselineRuns = new Map(baseline.runs.map((run) => [run.key, run]));
  for (const run of report.runs) {
    const before = baselineRuns.get(run.key);
    if (!before) continue;
    const timer = run.gpu && before.gpu ? "gpu" : "cpu";
    const afterMs = timer === "gpu" ? run.gpu!.median : run.wall.median;
    const beforeMs = timer === "gpu" ? before.gpu!.median : before.wall.median;
    const deltaPct = (afterMs / beforeMs - 1) * 100;
    let image: Comparison["image"] = null;
    for (const shot of run.images) {
      const old = before.images.find((i) => i.progress === shot.progress);
      if (!old) continue;
      const heatmap = shot.path.replace(/\.webp$/, ".diff.webp");
      const diff = await compareImages(
        path.join(outDir, shot.path),
        path.join(baselineDir, old.path),
        path.join(outDir, heatmap),
      );
      if (diff === "size") image = "size";
      else if (diff && image !== "size" && (!image || diff.changed > image.changed))
        image = {
          ...diff,
          progress: shot.progress,
          ...(diff.changed > 0 ? { heatmap } : {}),
        };
    }
    const changed =
      budgets.changed !== null &&
      (image === "size" || (image !== null && image.changed * 100 > budgets.changed));
    rows.push({
      key: run.key,
      timer,
      beforeMs,
      afterMs,
      deltaPct,
      image,
      slower: budgets.slowdown !== null && deltaPct > budgets.slowdown,
      changed,
      sceneChanged: before.sceneHash && run.sceneHash ? before.sceneHash !== run.sceneHash : null,
    });
  }

  const now = report.fingerprints!;
  const mismatches: Mismatch[] = [
    ...diffFields("settings", settingsOf(baseline), now.settings.values),
    ...diffFields(
      "environment",
      baseline.fingerprints?.environment.values ?? {
        gpu: baseline.gpu?.renderer,
        browser: baseline.browser,
        cpu: baseline.machine.cpu,
      },
      now.environment.values,
    ),
  ];
  const measured = new Set(report.runs.map((r) => r.key));
  const known = baselineRuns;
  const changedScenes = rows.filter((row) => row.sceneChanged).map((row) => row.key);
  return {
    baseline: path.relative(outDir, baselineDir),
    label: baseline.label,
    createdAt: baseline.createdAt,
    // A baseline without fingerprints cannot prove its scenes match.
    likeForLike:
      mismatches.length === 0 && changedScenes.length === 0 && Boolean(baseline.fingerprints),
    mismatches,
    changedScenes,
    missing: baseline.runs.filter((r) => expected(r) && !measured.has(r.key)).map((r) => r.key),
    added: report.runs.filter((r) => !known.has(r.key)).map((r) => r.key),
    sameCode: baseline.fingerprints ? baseline.fingerprints.code === now.code : null,
    legacy: !baseline.fingerprints,
    rows,
  };
}

function isReport(value: unknown): value is Report {
  return (
    typeof value === "object" &&
    value !== null &&
    "version" in value &&
    (value.version === 2 || value.version === 3) &&
    "createdAt" in value &&
    typeof value.createdAt === "string" &&
    "runs" in value &&
    Array.isArray(value.runs) &&
    "scaling" in value &&
    Array.isArray(value.scaling) &&
    "findings" in value &&
    Array.isArray(value.findings) &&
    "errors" in value &&
    Array.isArray(value.errors)
  );
}

import { mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import type { Browser, Page } from "playwright-core";

import { fitScaling, staticFrame, type BenchScene, type GrabDraw } from "@horizon/toolkit/bench";

import { call, launchBrowser, openBenchPage } from "./browser";
import { buildBenchBundle, discoverTargets, ROOT } from "./build";
import { HELP, parseCli } from "./cli";
import { compare } from "./compare";
import { fingerprint, fingerprints } from "./fingerprint";
import { fixed } from "./format";
import { grab } from "./grab";
import { html } from "./html";
import {
  buildRun,
  createAccumulator,
  median,
  runInteractive,
  runScripted,
  runStatic,
  type Job,
} from "./measure";
import type { Report, Run, Scaling } from "./model";
import { findings, llmSummary, markdown } from "./report";
import { printReport, write } from "./terminal";

const TRACE_CATEGORIES = [
  "devtools.timeline",
  "disabled-by-default-devtools.timeline",
  "disabled-by-default-devtools.timeline.frame",
  "toplevel",
  "blink",
  "v8",
  "cc",
  "viz",
  "gpu",
  "disabled-by-default-gpu.service",
];

function selectScenes(scenes: readonly BenchScene[], filters: string[]) {
  if (filters.length === 0) return scenes;
  return scenes.filter((scene) =>
    filters.some((filter) =>
      filter.startsWith("tag:") ? scene.tags?.includes(filter.slice(4)) : filter === scene.id,
    ),
  );
}

type Config = Exclude<ReturnType<typeof parseCli>, { help: true }>;

const firstLine = (error: unknown) =>
  String(error instanceof Error ? error.message : error).split("\n")[0]!;

/**
 * Measures every job for the configured rounds, then builds its run (with a frame grab on
 * request). A job that fails in any round is reported and dropped; traces and profiles are
 * taken in the last round only.
 */
async function measureTargets(
  page: Page,
  browser: Browser,
  jobs: Job[],
  outDir: string,
  { values, options, rounds, settings }: Config,
) {
  // A cold GPU idles at low clocks; the first scenes would otherwise look slow.
  const settleMs = settings.settle;
  if (settleMs > 0) {
    const first = jobs[0]!;
    process.stdout.write(`Settling the GPU for ${settleMs} ms … `);
    await page.setViewportSize({ width: first.width, height: first.height });
    await call(page, "open", first.target, first.scene.id, {
      ...options,
      width: first.width,
      height: first.height,
      capture: false,
    });
    const frame = staticFrame(options.time);
    const until = Date.now() + settleMs;
    while (Date.now() < until) await call(page, "warm", frame);
    await call(page, "close");
    write("done");
  }

  const pooled = new Map<string, ReturnType<typeof createAccumulator>>();
  const errors: Report["errors"] = [];
  const traces = new Map<string, string>();
  const profiles = new Map<string, string>();
  // DevTools protocol: garbage-collected heap readings, and CPU profiles on request.
  const cdp = await page.context().newCDPSession(page);
  if (settings.profile) await cdp.send("Profiler.enable");
  const heapUsed = async () => {
    await cdp.send("HeapProfiler.collectGarbage");
    return (await cdp.send("Runtime.getHeapUsage")).usedSize;
  };
  for (let round = 0; round < rounds; round++) {
    if (rounds > 1) write(`Round ${round + 1}/${rounds}`);
    const last = round === rounds - 1;
    for (const job of jobs) {
      if (errors.some((e) => e.key === job.key)) continue;
      process.stdout.write(`  ${job.key} … `);
      const samples = pooled.get(job.key) ?? createAccumulator();
      pooled.set(job.key, samples);
      const runOptions = {
        ...options,
        width: job.width,
        height: job.height,
        capture: options.capture && last,
      };
      let tracing = false;
      let profiling = false;
      const safe = job.key.replace(/[/@]/g, "_");
      try {
        await page.setViewportSize({ width: job.width, height: job.height });
        if (settings.trace && last) {
          await browser.startTracing(page, { categories: TRACE_CATEGORIES, screenshots: false });
          tracing = true;
        }
        const heapBefore = last ? await heapUsed() : 0;
        if (settings.profile && last) {
          await cdp.send("Profiler.start");
          profiling = true;
        }
        if (job.scene.script?.input?.length) await runInteractive(page, job, runOptions, samples);
        else if (job.scene.script) await runScripted(page, job, runOptions, samples);
        else await runStatic(page, job, runOptions, samples);
        if (last) samples.heap = { before: heapBefore, after: await heapUsed() };
        if (settings.profile && last) {
          const { profile } = await cdp.send("Profiler.stop");
          profiling = false;
          const file = path.join("profiles", `${safe}.cpuprofile`);
          mkdirSync(path.join(outDir, "profiles"), { recursive: true });
          writeFileSync(path.join(outDir, file), JSON.stringify(profile));
          profiles.set(job.key, file);
        }
        if (settings.trace && last) {
          const trace = await browser.stopTracing();
          tracing = false;
          const file = path.join("traces", `${safe}.json`);
          mkdirSync(path.join(outDir, "traces"), { recursive: true });
          writeFileSync(path.join(outDir, file), trace);
          traces.set(job.key, file);
        }
        const latest = samples.timelines.at(-1);
        const frameMs = latest
          ? median(latest.map((t) => t.gpuMs ?? t.wallMs))
          : median(samples.gpu.every((g): g is number => g !== null) ? samples.gpu : samples.wall);
        write(`${fixed(frameMs)} ms`);
      } catch (error) {
        const message = firstLine(error);
        write(`failed: ${message}`);
        errors.push({ key: job.key, message });
        // Earlier rounds are incomplete results once any round fails.
        pooled.delete(job.key);
      } finally {
        // Never carry diagnostics from a failed scene into the next one.
        try {
          if (profiling) await cdp.send("Profiler.stop");
        } finally {
          if (tracing) await browser.stopTracing();
        }
      }
    }
  }

  const runs: Run[] = [];
  const grabDraws = new Map<string, GrabDraw[]>();
  for (const job of jobs) {
    const samples = pooled.get(job.key);
    if (!samples || samples.wall.length === 0) continue;
    const run = await buildRun(job, samples, outDir);
    const trace = traces.get(job.key);
    const profile = profiles.get(job.key);
    if (trace !== undefined) run.trace = trace;
    if (profile !== undefined) run.profile = profile;
    if (values.grab) {
      process.stdout.write(`  grab ${job.key} … `);
      try {
        await page.setViewportSize({ width: job.width, height: job.height });
        const grabbed = await grab(
          page,
          job,
          { ...options, width: job.width, height: job.height },
          outDir,
        );
        run.grab = grabbed.summary;
        grabDraws.set(job.key, grabbed.draws);
        write(`${grabbed.summary.calls} calls, ${grabbed.summary.draws} draws`);
      } catch (error) {
        const message = firstLine(error);
        write(`failed: ${message}`);
        errors.push({ key: `${job.key} (grab)`, message });
      }
    }
    runs.push(run);
  }
  const gpu = [...pooled.values()].find((a) => a.environment)?.environment ?? null;
  return { runs, errors, grabDraws, gpu };
}

/** How each scene's frame time scales with pixels, when more than one size was measured. */
function scalingOf(runs: Run[], sizes: number) {
  const scaling: Scaling[] = [];
  if (sizes <= 1) return scaling;
  const groups = new Map<string, Run[]>();
  for (const run of runs) {
    const id = `${run.target}/${run.scene}`;
    const group = groups.get(id);
    if (group) group.push(run);
    else groups.set(id, [run]);
  }
  for (const group of groups.values()) {
    const points = group.map((r) => ({
      size: `${r.width}x${r.height}`,
      pixels: r.width * r.height,
      ms: r.ms,
    }));
    const fit = fitScaling(points);
    if (fit) scaling.push({ target: group[0]!.target, scene: group[0]!.scene, points, fit });
  }
  return scaling;
}

function writeOutputs(outDir: string, report: Report, grabDraws: Map<string, GrabDraw[]>) {
  writeFileSync(path.join(outDir, "report.json"), `${JSON.stringify(report, null, 1)}\n`);
  writeFileSync(
    path.join(outDir, "summary.json"),
    `${JSON.stringify(llmSummary(report), null, 1)}\n`,
  );
  writeFileSync(path.join(outDir, "report.md"), markdown(report));
  writeFileSync(path.join(outDir, "index.html"), html(report, grabDraws));
}

/** The terminal summary; the run fails on errors, regressions, or, with --strict, an unlike comparison. */
function printSummary(report: Report, outDir: string, strict: boolean) {
  printReport(report, outDir);
  const unlike = strict && report.comparison && !report.comparison.likeForLike;
  if (unlike) write("--strict: the comparison is not like for like.");
  if (report.errors.length || unlike || report.findings.some((x) => x.level === "regression"))
    process.exitCode = 1;
}

async function main() {
  const config = parseCli(process.argv.slice(2));
  if (config.help) return write(HELP);
  const { values, baselineDir, previous, parsedSizes, sizes, options, rounds, settings, budgets } =
    config;

  const available = discoverTargets();
  const wanted =
    values.target ??
    (values.compare && previous
      ? [...new Set(previous.runs.map((r) => r.target))]
      : available.map((t) => t.id));
  const unknown = wanted.filter((id) => !available.some((t) => t.id === id));
  if (unknown.length && !values.compare) throw new Error(`Unknown target ${unknown.join(", ")}`);
  const targets = available.filter((t) => wanted.includes(t.id));

  write(`Bundling ${targets.map((t) => t.id).join(", ")}…`);
  const bundle = await buildBenchBundle(targets);
  const browser = await launchBrowser(values.browser, Boolean(values.headed));
  try {
    const page = await openBenchPage(browser, bundle);
    const listing = await call(page, "list");
    if (values.list) {
      for (const target of listing) {
        write(target.id);
        for (const scene of target.scenes) {
          const seq = scene.script
            ? ` (${scene.script.frames} frames${scene.script.input?.length ? ", input" : ""})`
            : "";
          const tags = scene.tags?.length ? `  [${scene.tags.join(", ")}]` : "";
          write(`  ${scene.id.padEnd(24)} ${scene.description}${seq}${tags}`);
        }
      }
      return;
    }

    const createJob = (
      target: string,
      scene: BenchScene,
      size: (typeof parsedSizes)[number],
    ): Job => ({
      target,
      scene,
      sceneHash: fingerprint({ target, scene }),
      width: size.width,
      height: size.height,
      size: size.size,
      key: `${target}/${scene.id}@${size.size}`,
    });
    const sceneFilters = values.scene ?? [];
    const sizeFilter = new Set(parsedSizes.map((s) => s.size));
    /** Whether a baseline run falls inside this run's selection (for "not measured" reports). */
    const expected = (run: Run) =>
      wanted.includes(run.target) &&
      sizeFilter.has(`${run.width}x${run.height}`) &&
      selectScenes([{ id: run.scene, description: "", tags: run.tags }], sceneFilters).length > 0;
    const jobs: Job[] =
      values.compare && previous
        ? // Replay the earlier run's own list, in its order.
          previous.runs.filter(expected).flatMap((run) => {
            const scene = listing
              .find((t) => t.id === run.target)
              ?.scenes.find((s) => s.id === run.scene);
            const size = parsedSizes.find((s) => s.size === `${run.width}x${run.height}`);
            return scene && size ? [createJob(run.target, scene, size)] : [];
          })
        : parsedSizes.flatMap((size) =>
            listing.flatMap((target) =>
              selectScenes(target.scenes, sceneFilters).map((scene) =>
                createJob(target.id, scene, size),
              ),
            ),
          );
    if (jobs.length === 0) throw new Error("No scenes match the selection");

    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const outDir = path.resolve(
      values.out ??
        path.join(ROOT, "bench-results", values.label ? `${stamp}-${values.label}` : stamp),
    );
    mkdirSync(outDir, { recursive: true });
    const browserName = `${browser.browserType().name()} ${browser.version()}`;
    write(
      `${browserName} · ${jobs.length} run(s) · ${sizes.join(", ")} · ${rounds} round(s) → ${path.relative(process.cwd(), outDir)}`,
    );

    const { runs, errors, grabDraws, gpu } = await measureTargets(
      page,
      browser,
      jobs,
      outDir,
      config,
    );

    const machine = {
      platform: `${os.type()} ${os.release()} ${process.arch}`,
      cpu: os.cpus()[0]?.model ?? "unknown CPU",
      cores: os.cpus().length,
      memoryGb: Math.round(os.totalmem() / 1e9),
      node: process.version,
    };
    const report: Report = {
      version: 3,
      createdAt: new Date().toISOString(),
      label: values.label ?? null,
      command: `npm run bench -- ${process.argv.slice(2).join(" ")}`.trim(),
      machine,
      browser: browserName,
      gpu,
      fingerprints: fingerprints(
        settings,
        {
          gpu: gpu?.renderer ?? "unknown",
          browser: browserName,
          cpu: machine.cpu,
          platform: machine.platform,
        },
        bundle,
      ),
      options: {
        sizes,
        frames: options.frames,
        warmup: options.warmup,
        time: options.time,
        rounds,
      },
      runs,
      scaling: scalingOf(runs, parsedSizes.length),
      findings: [],
      errors,
    };
    if (previous && baselineDir)
      report.comparison = await compare(
        report,
        outDir,
        path.resolve(baselineDir),
        previous,
        expected,
        budgets,
      );
    report.findings = findings(report, budgets);

    writeOutputs(outDir, report, grabDraws);
    printSummary(report, outDir, Boolean(values.strict));
  } finally {
    await browser.close();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { Page } from "playwright-core";

import {
  sequenceFrames,
  staticFrame,
  type BenchOptions,
  type FrameGrab,
  type GrabDraw,
} from "@horizon/toolkit/bench";

import { call } from "./browser";
import { writeDataUrl } from "./images";
import type { Job } from "./measure";

const STATE =
  /^(enable|disable|blend|depth|cull|bind|useProgram|viewport|scissor|colorMask|stencil|activeTexture|pixelStorei|frontFace|polygonOffset|vertexAttrib)/;

/** Records one steady-state frame call by call and writes its artifacts. */
export async function grab(page: Page, job: Job, options: BenchOptions, outDir: string) {
  const script = job.scene.script;
  const frame = script
    ? sequenceFrames(script, options.time)[Math.floor((script.frames - 1) / 2)]!
    : staticFrame(options.time);
  await call(page, "open", job.target, job.scene.id, { ...options, capture: false });
  let result: FrameGrab;
  try {
    for (let i = 0; i <= options.warmup; i++) await call(page, "warm", frame);
    result = await call(page, "grab", frame, {
      snapshots: true,
      thumbWidth: 480,
      maxSnapshots: 48,
      maxCalls: 6000,
    });
  } finally {
    await call(page, "close");
  }
  const dir = path.join("grabs", job.target, `${job.scene.id}@${job.size}`);
  const abs = path.join(outDir, dir);
  mkdirSync(path.join(abs, "shaders"), { recursive: true });
  const draws: GrabDraw[] = result.draws.map((draw) => {
    if (!draw.snapshot) return draw;
    const file = path.join("draws", `${String(draw.index).padStart(3, "0")}.png`);
    writeDataUrl(path.join(abs, file), draw.snapshot);
    return { ...draw, snapshot: path.join(dir, file) };
  });
  for (const program of result.programs)
    for (const shader of program.shaders) {
      const base = path.join(abs, "shaders", `${program.id.replace("#", "-")}.${shader.type}`);
      writeFileSync(`${base}.glsl`, shader.source);
      if (shader.translated) writeFileSync(`${base}.translated.txt`, shader.translated);
    }
  const stored = {
    ...result,
    draws: draws.map((d) => ({
      ...d,
      snapshot: d.snapshot ? path.relative(dir, d.snapshot) : undefined,
    })),
    programs: result.programs.map((p) => ({
      ...p,
      shaders: p.shaders.map((s) => ({
        type: s.type,
        file: `shaders/${p.id.replace("#", "-")}.${s.type}.glsl`,
        translated: s.translated
          ? `shaders/${p.id.replace("#", "-")}.${s.type}.translated.txt`
          : null,
        lines: s.source.split("\n").length,
        compileMs: s.compileMs ?? null,
      })),
    })),
  };
  writeFileSync(path.join(abs, "grab.json"), `${JSON.stringify(stored, null, 1)}\n`);
  const gpuTimes = draws.map((d) => d.gpuMs);
  return {
    draws,
    summary: {
      dir,
      draws: result.draws.length,
      calls: Object.values(result.counts).reduce((a, b) => a + b, 0),
      programs: result.programs.length,
      passes: result.passes,
      drawGpuMs:
        gpuTimes.length && gpuTimes.every((g): g is number => g !== null)
          ? gpuTimes.reduce((a, b) => a + b, 0)
          : null,
      uploads: result.uploads,
      stateChanges: Object.entries(result.counts)
        .filter(([name]) => STATE.test(name))
        .reduce((sum, [, n]) => sum + n, 0),
      shaders: result.programs.flatMap((p) =>
        p.shaders.map((s) => ({
          program: p.id,
          type: s.type,
          lines: s.source.split("\n").length,
          bytes: Buffer.byteLength(s.source),
          translatedBytes: s.translated ? Buffer.byteLength(s.translated) : null,
          compileMs: s.compileMs ?? null,
        })),
      ),
      errors: result.errors,
    },
  };
}

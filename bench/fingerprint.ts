import { createHash } from "node:crypto";

/**
 * Fingerprints say whether two runs measured the same thing. Settings and
 * environment change every timing; a scene's definition (camera, quality,
 * script, input) changes what is drawn. Code is expected to differ between
 * runs being compared, so its hash is information, not a mismatch.
 */

/** JSON with sorted keys, so field order never changes a hash. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const entries: [string, unknown][] = [];
  for (const key of Object.keys(value)) {
    const field: unknown = Reflect.get(value, key);
    if (field !== undefined) entries.push([key, field]);
  }
  entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
}

/** 12 hex digits of SHA-256: short enough to read, long enough never to collide here. */
export const fingerprint = (value: unknown) =>
  createHash("sha256").update(stableStringify(value)).digest("hex").slice(0, 12);

/**
 * Everything that changes timings without changing what is drawn. Image
 * capture is untimed, so it is not a setting here.
 */
export type BenchSettings = {
  frames: number;
  minTime: number;
  warmup: number;
  time: number;
  rounds: number;
  settle: number;
  trace: boolean;
  profile: boolean;
};

export type BenchEnvironmentKey = {
  gpu: string;
  browser: string;
  cpu: string;
  platform: string;
};

export type Fingerprints = {
  settings: { hash: string; values: BenchSettings };
  environment: { hash: string; values: BenchEnvironmentKey };
  /** Hash of the benchmarked bundle: shaders, renderer and target code. */
  code: string;
};

export function fingerprints(
  settings: BenchSettings,
  environment: BenchEnvironmentKey,
  bundle: string,
): Fingerprints {
  return {
    settings: { hash: fingerprint(settings), values: settings },
    environment: { hash: fingerprint(environment), values: environment },
    code: fingerprint(bundle),
  };
}

export type Mismatch = {
  scope: "settings" | "environment";
  field: string;
  before: unknown;
  after: unknown;
};

/** Fields that differ; a field missing on one side (an older report) is not a mismatch. */
export function diffFields(
  scope: Mismatch["scope"],
  before: Partial<Record<string, unknown>>,
  after: Partial<Record<string, unknown>>,
): Mismatch[] {
  const fields = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
  return fields
    .filter((field) => before[field] !== undefined && after[field] !== undefined)
    .filter((field) => stableStringify(before[field]) !== stableStringify(after[field]))
    .map((field) => ({ scope, field, before: before[field], after: after[field] }));
}

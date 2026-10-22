import type { BenchTarget } from "./types";

/** Reject ambiguous result keys and scripts that cannot be replayed as declared. */
export function validateTarget(target: BenchTarget) {
  const idPattern = /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/;
  if (!idPattern.test(target.id)) throw new Error(`Invalid bench target id: ${target.id}`);
  const ids = new Set<string>();
  for (const scene of target.scenes) {
    const key = `${target.id}/${scene.id}`;
    const fail = (message: string): never => {
      throw new Error(`Bench scene ${key}: ${message}`);
    };
    if (!idPattern.test(scene.id)) fail("id must use letters, digits, hyphens or underscores");
    if (ids.has(scene.id)) fail("duplicate scene id");
    ids.add(scene.id);
    const script = scene.script;
    if (!script) continue;
    if (!Number.isSafeInteger(script.frames) || script.frames < 1)
      fail("frames must be a positive integer");
    if (!Number.isFinite(script.duration) || script.duration < 0)
      fail("duration must be finite and non-negative");
    const progress = (value: number) => {
      if (!Number.isFinite(value) || value < 0 || value > 1)
        fail("input and keyframe progress must be between 0 and 1");
    };
    for (const mark of script.keyframes ?? []) progress(mark);
    for (const input of script.input ?? []) {
      if (input.kind === "drag") {
        progress(input.start);
        progress(input.end);
        if (input.end < input.start) fail("drag end must not precede its start");
      } else progress(input.at);
    }
  }
}

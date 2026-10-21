import { lerp } from "../math";
import type { BenchFrame, BenchInput, BenchScript } from "./types";

/** One low-level input step, in canvas fractions; the harness turns it into browser input. */
export type InputAction =
  | { type: "move"; x: number; y: number }
  | { type: "down"; button: "left" | "middle" | "right" }
  | { type: "up"; button: "left" | "middle" | "right" }
  | { type: "wheel"; x: number; y: number; deltaX: number; deltaY: number }
  | { type: "click"; x: number; y: number }
  | { type: "key"; key: string };

const progressOf = (index: number, count: number) => (count > 1 ? index / (count - 1) : 0);

/** The frames of a sequence, starting at simulation time `start`. */
export function sequenceFrames(script: BenchScript, start: number): BenchFrame[] {
  const count = Math.max(1, Math.round(script.frames));
  const dt = count > 1 ? script.duration / (count - 1) : 0;
  return Array.from({ length: count }, (_, index) => {
    const progress = progressOf(index, count);
    return { index, count, progress, time: start + progress * script.duration, dt: index ? dt : 0 };
  });
}

/** True on the first frame whose progress reaches `at`. */
function reaches(at: number, index: number, count: number) {
  const progress = progressOf(index, count);
  return progress >= at && (index === 0 || progressOf(index - 1, count) < at);
}

/** Input to deliver before frame `index` renders. */
export function inputActions(
  inputs: readonly BenchInput[],
  index: number,
  count: number,
): InputAction[] {
  const progress = progressOf(index, count);
  const actions: InputAction[] = [];
  for (const input of inputs) {
    if (input.kind === "drag") {
      const button = input.button ?? "left";
      const starts = reaches(input.start, index, count);
      const ends = reaches(Math.max(input.end, input.start), index, count);
      if (starts) {
        actions.push(
          { type: "move", x: input.from[0], y: input.from[1] },
          { type: "down", button },
        );
      }
      if (ends) {
        actions.push({ type: "move", x: input.to[0], y: input.to[1] }, { type: "up", button });
      } else if (progress > input.start && progress < input.end) {
        const t = (progress - input.start) / (input.end - input.start);
        actions.push({
          type: "move",
          x: lerp(input.from[0], input.to[0], t),
          y: lerp(input.from[1], input.to[1], t),
        });
      }
    } else if (reaches(input.at, index, count)) {
      if (input.kind === "wheel") {
        const [x, y] = input.point ?? [0.5, 0.5];
        actions.push({ type: "wheel", x, y, deltaX: input.deltaX ?? 0, deltaY: input.deltaY });
      } else if (input.kind === "click") {
        actions.push({ type: "click", x: input.point[0], y: input.point[1] });
      } else actions.push({ type: "key", key: input.key });
    }
  }
  return actions;
}

/** Frame indices closest to each keyframe progress, without duplicates. */
export function keyframeIndices(script: BenchScript): Map<number, string> {
  const count = Math.max(1, Math.round(script.frames));
  const marks = new Map<number, string>();
  for (const progress of script.keyframes ?? [0, 0.5, 1]) {
    const index = Math.round(Math.min(1, Math.max(0, progress)) * (count - 1));
    if (!marks.has(index))
      marks.set(index, String(Math.round(progressOf(index, count) * 1000) / 1000));
  }
  return marks;
}

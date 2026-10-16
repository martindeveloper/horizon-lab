export type {
  BenchEnvironment,
  BenchFrame,
  BenchInput,
  BenchInstance,
  BenchOptions,
  BenchPoint,
  BenchResult,
  BenchScene,
  BenchScript,
  BenchSurface,
  BenchTarget,
  FrameTiming,
} from "./types";
export {
  BenchSession,
  installBenchRuntime,
  runBenchScene,
  runBenchSequence,
  staticFrame,
  type BenchRegistry,
  type BenchRuntime,
} from "./runner";
export {
  grabFrame,
  type FrameGrab,
  type GrabCall,
  type GrabDraw,
  type GrabOptions,
  type GrabPass,
  type GrabProgram,
  type GrabShader,
} from "./grab";
export { inputActions, keyframeIndices, sequenceFrames, type InputAction } from "./script";
export {
  compareRgba,
  differenceMap,
  findSpikes,
  fitScaling,
  rollingMedian,
  summarizeTimings,
  type ImageDifference,
  type ScalingFit,
  type TimingSummary,
} from "./stats";

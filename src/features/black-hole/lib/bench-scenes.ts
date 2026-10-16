import type { BenchScene } from "@horizon/toolkit/bench";
import { sampleOrbitFlight, type OrbitPose } from "@horizon/toolkit/camera";
import { lerp, smootherstep } from "@horizon/toolkit/math";

import type { CameraPose } from "./frame";
import { HOLES, holeById } from "./holes";
import type { Quality } from "./presets";

/** The store's opening azimuth, so preset scenes match what a visitor first sees. */
const HOME_AZIMUTH = 0.55;

/** How a sequence moves: scripted camera paths, a spin change, a guided tour, or live input. */
export type BlackHoleMotion =
  | { kind: "orbit"; turns: number }
  | { kind: "dolly"; from: number; to: number }
  | { kind: "spin"; from: number; to: number }
  | { kind: "tour" }
  | { kind: "input" };

export type BlackHoleBenchScene = BenchScene & {
  presetId: string;
  quality: Quality;
  /** Overrides of the preset's home pose. */
  pose?: Partial<CameraPose>;
  motion?: BlackHoleMotion;
};

const tourSeconds = (presetId: string) =>
  holeById(presetId).tour.reduce((sum, beat) => sum + beat.duration, 0);

/**
 * Every preset at its home view, a quality sweep, stress views that bound
 * the per-pixel cost, and sequences.
 *
 * The sweep is edge-on at zero spin: there the ISCO gap lets rays near the
 * critical curve wind around the hole, so the step budget decides the image.
 * (With a high-spin disk those rays end on the disk first and every budget
 * draws the same frame.) The close camera marches every pixel; the distant
 * one is mostly analytic sky. Sequences move the camera along scripted paths,
 * re-integrate the disk profile every frame (spin), replay a guided tour, and
 * drive the real orbit input with a drag and wheel zooms.
 */
export const BENCH_SCENES: readonly BlackHoleBenchScene[] = [
  ...HOLES.map((hole): BlackHoleBenchScene => ({
    id: hole.id,
    description: `${hole.name}, home view, standard quality`,
    tags: ["preset"],
    presetId: hole.id,
    quality: "standard",
  })),
  ...(["economy", "standard", "cinema"] as const).map((quality): BlackHoleBenchScene => ({
    id: `edge-on-${quality}`,
    description: `Schwarzschild, edge-on disk, ${quality} quality`,
    tags: ["quality", "stress"],
    presetId: "schwarzschild",
    quality,
    pose: { inclination: 0.03 },
  })),
  {
    id: "kerr-close",
    description: "Near-extremal Kerr from 6 M, cinema quality",
    tags: ["stress"],
    presetId: "kerr",
    quality: "cinema",
    pose: { distance: 6 },
  },
  {
    id: "lensed-far",
    description: "Lensed disk from 480 M, standard quality",
    tags: ["stress"],
    presetId: "lensed",
    quality: "standard",
    pose: { distance: 480 },
  },
  {
    id: "orbit",
    description: "One full orbit around the lensed disk",
    tags: ["sequence", "camera"],
    presetId: "lensed",
    quality: "standard",
    motion: { kind: "orbit", turns: 1 },
    script: { frames: 120, duration: 8, keyframes: [0, 0.25, 0.5, 0.75] },
  },
  {
    id: "dolly-in",
    description: "Push in from 480 M to 3 M: cost per pixel rises as rays bend",
    tags: ["sequence", "camera", "stress"],
    presetId: "lensed",
    quality: "standard",
    motion: { kind: "dolly", from: 480, to: 3 },
    script: { frames: 120, duration: 6, keyframes: [0, 0.5, 0.8, 1] },
  },
  {
    id: "spin-sweep",
    description: "Spin 0 → 0.998: the disk profile is re-integrated on the CPU every frame",
    tags: ["sequence", "cpu"],
    presetId: "kerr",
    quality: "standard",
    motion: { kind: "spin", from: 0, to: 0.998 },
    script: { frames: 90, duration: 3 },
  },
  {
    id: "tour-m87",
    description: "Messier 87* guided tour, every beat",
    tags: ["sequence", "camera", "tour"],
    presetId: "m87",
    quality: "standard",
    motion: { kind: "tour" },
    script: {
      frames: 240,
      duration: tourSeconds("m87"),
      keyframes: [0, 0.2, 0.4, 0.6, 0.8, 1],
    },
  },
  {
    id: "drag-zoom",
    description: "Scripted visitor: drag to orbit, wheel in, wheel out (real orbit input)",
    tags: ["sequence", "input"],
    presetId: "lensed",
    quality: "standard",
    motion: { kind: "input" },
    script: {
      frames: 120,
      duration: 4,
      keyframes: [0, 0.55, 0.75, 1],
      input: [
        { kind: "drag", from: [0.35, 0.55], to: [0.7, 0.42], start: 0.05, end: 0.55 },
        { kind: "wheel", at: 0.7, deltaY: -900 },
        { kind: "wheel", at: 0.88, deltaY: 1400 },
      ],
    },
  },
];

export function benchPose(scene: BlackHoleBenchScene): CameraPose {
  const hole = holeById(scene.presetId);
  return {
    azimuth: HOME_AZIMUTH,
    inclination: hole.inclination,
    distance: hole.distance,
    roll: 0,
    ...scene.pose,
  };
}

/**
 * Camera and spin for a scripted frame. `elapsed` is simulation seconds since
 * the sequence began; `input` scenes return the home pose (the orbit input moves it).
 */
export function benchMotion(
  scene: BlackHoleBenchScene,
  progress: number,
  elapsed: number,
): { pose: CameraPose; spin: number } {
  const home = benchPose(scene);
  const spin = holeById(scene.presetId).spin;
  const motion = scene.motion;
  if (!motion || motion.kind === "input") return { pose: home, spin };
  if (motion.kind === "orbit")
    return {
      pose: { ...home, azimuth: home.azimuth + motion.turns * 2 * Math.PI * progress },
      spin,
    };
  if (motion.kind === "dolly")
    return {
      pose: { ...home, distance: motion.from * (motion.to / motion.from) ** progress },
      spin,
    };
  if (motion.kind === "spin") return { pose: home, spin: lerp(motion.from, motion.to, progress) };

  // Guided tour: each beat flies from where the previous one ended, as in the engine.
  let from: OrbitPose = home;
  let roll = 0;
  let start = 0;
  for (const beat of holeById(scene.presetId).tour) {
    const end = start + beat.duration;
    if (elapsed <= end) {
      const t = Math.min(1, Math.max(0, (elapsed - start) / beat.duration));
      return {
        pose: {
          ...sampleOrbitFlight(t, from, beat),
          roll: lerp(roll, beat.roll ?? 0, smootherstep(t)),
        },
        spin,
      };
    }
    from = sampleOrbitFlight(1, from, beat);
    roll = beat.roll ?? 0;
    start = end;
  }
  return { pose: { ...from, roll }, spin };
}

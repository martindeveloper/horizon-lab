import type { BenchScene } from "@horizon/toolkit/bench";
import { lerp } from "@horizon/toolkit/math";

import type { CameraPose } from "./frame";
import { holeById, PRESETS, type Quality } from "./holes";
import { MAX_SPIN } from "./physics";
import { tourAt } from "./tour-flight";

/** The store's opening azimuth, so preset scenes match what a visitor first sees. */
const HOME_AZIMUTH = 0.55;

/** How a sequence moves: scripted camera paths, a spin change, a guided tour, or live input. */
type BlackHoleMotion =
  | { kind: "orbit"; turns: number }
  | { kind: "dolly"; from: number; to: number }
  | { kind: "spin"; from: number; to: number }
  | { kind: "tour" }
  | { kind: "input" };

type BlackHoleBenchScene = BenchScene & {
  presetId: string;
  quality: Quality;
  /** Overrides of the preset's home pose. */
  pose?: Partial<CameraPose>;
  /** Bloom on: the frame is traced as radiance, bloomed and resolved. */
  bloom?: boolean;
  /** Lens on: the frame is traced as radiance, spiked and fringed, and resolved. */
  lens?: boolean;
  /** Wide colour on: the canvas shows Display P3, the display step converting the radiance. */
  wideColour?: boolean;
  motion?: BlackHoleMotion;
};

const tourSeconds = (presetId: string) =>
  holeById(presetId).tour.reduce((sum, beat) => sum + beat.duration, 0);

/**
 * Every preset at its home view, a quality sweep, stress views that bound
 * the per-pixel cost, the lensed disk with bloom, with the lens and in wide colour (against
 * its plain home view, each effect's cost), and sequences.
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
  ...PRESETS.map((hole): BlackHoleBenchScene => ({
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
    id: "lensed-bloom",
    description: "Lensed disk, home view, standard quality, bloom on",
    tags: ["effects"],
    presetId: "lensed",
    quality: "standard",
    bloom: true,
  },
  {
    id: "lensed-lens",
    description: "Lensed disk, home view, standard quality, lens on",
    tags: ["effects"],
    presetId: "lensed",
    quality: "standard",
    lens: true,
  },
  {
    id: "lensed-wide",
    description: "Lensed disk, home view, standard quality, wide colour on",
    tags: ["effects"],
    presetId: "lensed",
    quality: "standard",
    wideColour: true,
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
    description: `Spin 0 → ${MAX_SPIN}: the disk profile is re-integrated on the CPU every frame`,
    tags: ["sequence", "cpu"],
    presetId: "kerr",
    quality: "standard",
    motion: { kind: "spin", from: 0, to: MAX_SPIN },
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
  return { pose: tourAt(holeById(scene.presetId).tour, home, elapsed), spin };
}

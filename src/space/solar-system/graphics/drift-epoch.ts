/**
 * Along-orbit drift on the GPU, re-based in time as a floating origin re-bases space. The
 * shaders place a body at M = φ + n (drift − epoch) in single precision. The drift grows
 * without bound, and a float32 n · drift, once large, steps further than a body is wide (a
 * Kuiper-belt rock nine million years along steps 0.7 au), so the GPU only sees the drift
 * since an epoch. Each body's phase φ at the epoch is the model's, worked out in double
 * precision, wrapped to a turn and uploaded once: when the drift since the epoch would put the
 * fastest body a fraction of a pixel astray, or when the clearing has moved the orbits (a
 * body's mean motion follows its semi-major axis, so its phase at the epoch does too).
 */
import type { BufferAttribute } from "three";

import { TAU } from "@horizon/toolkit/math";

/** float32's machine epsilon: the spacing of single-precision numbers just above 1. */
const FLOAT32_EPSILON = 2 ** -23;
/**
 * Units of ε the shader's n (drift − epoch) may be off by, relative to itself: GLSL ES allows
 * exp and exp2 3 + 2|x| ulps and log2 3, and the semi-major axis's log-space mix, pow's log2
 * and exp2, the product and the sum each add theirs, a few tens at the arguments here.
 */
const PHASE_ULPS = 32;
/** The most the drift since the epoch may put a body astray, in pixels: a re-base never shows. */
const ASTRAY_PX = 0.25;

/** The drift the shaders see, re-based as it needs. */
export type DriftEpoch = {
  /**
   * The drift since the epoch for the shader's `drift` uniform, at clearing progress `mig`,
   * `years` along the orbits, with a pixel `pixel` world units across where the bodies are seen.
   */
  since(mig: number, years: number, pixel: number): number;
};

/**
 * The drift epoch of `bodies`, whose phases at it are the x of `phases`; `phaseAt(index, mig,
 * years)` is a body's mean anomaly in radians, from the model in double precision.
 */
export function createDriftEpoch(
  bodies: readonly { a0: number; a1: number }[],
  phases: BufferAttribute,
  phaseAt: (index: number, mig: number, years: number) => number,
): DriftEpoch {
  /* A phase off by PHASE_ULPS ε n |drift − epoch| is a clock off by PHASE_ULPS ε |drift − epoch|
     years, which the fastest orbit (the innermost: a n = 2π / √a au a year) turns into the most
     astray any body is. */
  const innermost = bodies.reduce((a, b) => Math.min(a, b.a0, b.a1), Infinity);
  const fastest = TAU / Math.sqrt(innermost);
  const astrayPerYear = PHASE_ULPS * FLOAT32_EPSILON * fastest;
  /* The phases start as each body's at no drift, valid at any mig. */
  let epoch = 0;
  let epochMig = Number.NaN;
  return {
    since(mig, years, pixel) {
      const astray = Math.abs(years - epoch) * astrayPerYear;
      if (astray > ASTRAY_PX * pixel || (epoch !== 0 && mig !== epochMig)) {
        epoch = years;
        epochMig = mig;
        for (let i = 0; i < phases.count; i += 1) phases.setX(i, phaseAt(i, mig, epoch));
        phases.needsUpdate = true;
      }
      return years - epoch;
    },
  };
}

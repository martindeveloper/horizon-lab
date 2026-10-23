/** The planetesimal sample: where each leftover of the disk starts and where the clearing sends it. */
import { periodYears, type Elements } from "@horizon/toolkit/bodies";
import { clamp, lerp, mulberry32, smoothstep, wrap } from "@horizon/toolkit/math";
import { RAD_PER_DEG } from "@horizon/toolkit/science";

import { tracerSemiMajorAxis } from "./equations";
import { migrationProgress } from "./moment";
import { COLD_CLASSICAL_AU, DISK_AU, TRACER_PUMP } from "./parameters";

type Kind = "cold" | "hot" | "scattered" | "oort" | "ejected";
export type Bin = "disk" | "kuiper" | "scattered" | "oort" | "ejected";
export const BINS: readonly Bin[] = ["disk", "kuiper", "scattered", "oort", "ejected"];

type Tracer = {
  kind: Kind;
  a0: number;
  a1: number;
  e0: number;
  e1: number;
  i0: number;
  i1: number;
  omega: number;
  node: number;
  M: number;
  p0: number;
  p1: number;
};

const logLerp = (a0: number, a1: number, s: number) => tracerSemiMajorAxis.compute({ a0, a1, s });

function scatterS(tr: Tracer, mig: number) {
  return smoothstep(tr.p0, Math.max(tr.p0 + 1e-6, tr.p1), mig);
}

function kindOf(roll: number): Kind {
  if (roll < 0.08) {
    return "cold";
  }
  if (roll < 0.18) {
    return "hot";
  }
  if (roll < 0.32) {
    return "scattered";
  }
  if (roll < 0.46) {
    return "oort";
  }
  return "ejected";
}

/**
 * A seeded sample of planetesimals. The primordial disk spans about 16–34 AU
 * (Nice model); cold classicals form near 42–48 AU and stay. Shares are
 * illustrative: most leftovers are ejected, a minority ends in the belt, the
 * scattered disk and the Oort cloud.
 */
function createTracers(count: number, seed = 20261014): Tracer[] {
  const rng = mulberry32(seed);
  const out: Tracer[] = [];
  for (let n = 0; n < count; n += 1) {
    const kind = kindOf(rng());
    const angles = { omega: rng() * 360, node: rng() * 360, M: rng() * 360 };
    const p0 = rng() * 0.22;
    const p1 = 0.55 + rng() * 0.42;
    if (kind === "cold") {
      const a = COLD_CLASSICAL_AU[0] + rng() * (COLD_CLASSICAL_AU[1] - COLD_CLASSICAL_AU[0]);
      const e = 0.02 + rng() * 0.05;
      const i = rng() * 4;
      out.push({ kind, a0: a, a1: a, e0: e, e1: e, i0: i, i1: i, ...angles, p0: 0, p1: 1 });
      continue;
    }
    const a0 = DISK_AU[0] + rng() * (DISK_AU[1] - DISK_AU[0]);
    const e0 = 0.01 + rng() * 0.03;
    const i0 = rng() * 2;
    switch (kind) {
      case "hot":
        out.push({
          kind,
          a0,
          a1: 36 + rng() * 12,
          e0,
          e1: 0.08 + rng() * 0.18,
          i0,
          i1: 6 + rng() * 18,
          ...angles,
          p0,
          p1,
        });
        break;
      case "scattered": {
        const a1 = 70 + rng() * 520;
        const q = 30 + rng() * 10;
        out.push({
          kind,
          a0,
          a1,
          e0,
          e1: clamp(1 - q / a1, 0.25, 0.94),
          i0,
          i1: 8 + rng() * 24,
          ...angles,
          p0,
          p1,
        });
        break;
      }
      case "oort": {
        const a1 = logLerp(3_000, 100_000, rng());
        const q1 = 400 + rng() * Math.min(6_000, a1 * 0.35);
        out.push({
          kind,
          a0,
          a1,
          e0,
          e1: clamp(1 - q1 / a1, 0.15, 0.9),
          i0,
          /* Isotropic: cos i uniform, so polar orbits are no likelier than on a sphere. */
          i1: Math.acos(1 - 2 * rng()) / RAD_PER_DEG,
          ...angles,
          p0,
          p1,
        });
        break;
      }
      case "ejected":
        out.push({
          kind,
          a0,
          a1: 120_000,
          e0,
          e1: 0.88,
          i0,
          i1: rng() * 35,
          ...angles,
          p0,
          p1,
        });
        break;
    }
  }
  return out;
}

export const TRACERS: readonly Tracer[] = createTracers(560);

/** The stage a sample is at: the bin it counts in, or gone, past the Sun's hold and no longer drawn. */
export type Stage = Bin | "gone";

/**
 * How each kind passes through the clearing, by its own progress s (0..1, `scatterS`). It starts
 * in the first of its `stages` and enters each next one at its step of s. Its semi-major axis
 * reaches a₁ by `aBy` (the ejected are flung out early, then coast); its inclination leaves i₀
 * from `iFrom` (the Oort cloud's orbits tilt only once far out); a `pumped` eccentricity first
 * climbs with the perihelion held near Neptune (`TRACER_PUMP`), the rest move straight to e₁.
 * The vertex shader (rock.vert.glsl) draws the sample from these, so each body's track is its
 * instance attributes (graphics/tracers.ts).
 */
type Track = {
  stages: readonly [Bin, ...Stage[]];
  /** One for each stage after the first: the s at which it begins. */
  steps: readonly number[];
  aBy: number;
  iFrom: number;
  pumped: boolean;
};
const STRAIGHT = { aBy: 1, iFrom: 0, pumped: false };
export const TRACKS: Readonly<Record<Kind, Track>> = {
  cold: { stages: ["kuiper"], steps: [], ...STRAIGHT },
  hot: { stages: ["disk", "kuiper"], steps: [0.28], ...STRAIGHT },
  scattered: { stages: ["disk", "scattered"], steps: [0.22], ...STRAIGHT },
  oort: {
    stages: ["disk", "scattered", "oort"],
    steps: [0.3, 0.62],
    aBy: 1,
    iFrom: 0.55,
    pumped: true,
  },
  ejected: { stages: ["disk", "ejected", "gone"], steps: [0.28, 0.93], ...STRAIGHT, aBy: 0.9 },
};

/** How far along its track a sample is at a moment of the clearing: the index of its stage. */
function stageIndex(tr: Tracer, mig: number) {
  const { steps } = TRACKS[tr.kind];
  const s = scatterS(tr, mig);
  let at = 0;
  while (at < steps.length && s >= steps[at]!) at += 1;
  return at;
}

/** The bin a sample counts in: the last one it entered, so one gone counts where it left from. */
export function binOf(tr: Tracer, mig: number): Bin {
  const { stages } = TRACKS[tr.kind];
  const at = stageIndex(tr, mig);
  let bin = stages[0];
  for (let k = 1; k <= at; k += 1) {
    const stage = stages[k]!;
    if (stage !== "gone") bin = stage;
  }
  return bin;
}

export function tracerVisible(tr: Tracer, mig: number) {
  return TRACKS[tr.kind].stages[stageIndex(tr, mig)] !== "gone";
}

type Tally = Record<Bin, number>;
export function tallyAt(yearsAgo: number): Tally {
  const mig = migrationProgress(yearsAgo);
  const tally: Tally = { disk: 0, kuiper: 0, scattered: 0, oort: 0, ejected: 0 };
  for (const tr of TRACERS) tally[binOf(tr, mig)] += 1;
  return tally;
}

/** A mean anomaly `M` (degrees) carried `years` on along an orbit of semi-major axis `a` (au). */
export const alongOrbit = (M: number, a: number, years: number) =>
  wrap(M + (years / periodYears(a)) * 360, 360);

function withMotion(el: Elements, driftYears: number): Elements {
  return { ...el, M: alongOrbit(el.M, el.a, driftYears) };
}

/** A pumped eccentricity: up to its peak by `peakS`, holding the perihelion, then down to e₁. */
function pumpedE(tr: Tracer, a: number, s: number) {
  const { perihelionAu, floorAu, maxE, peakS } = TRACER_PUMP;
  const peak = clamp(1 - perihelionAu / Math.max(a, floorAu), tr.e1, maxE);
  return s < peakS ? lerp(tr.e0, peak, s / peakS) : lerp(peak, tr.e1, (s - peakS) / (1 - peakS));
}

/** A sample's elements at a moment of the clearing, `driftYears` along its orbit. */
export function tracerElements(tr: Tracer, mig: number, driftYears: number): Elements {
  const { aBy, iFrom, pumped } = TRACKS[tr.kind];
  const s = scatterS(tr, mig);
  const a = logLerp(tr.a0, tr.a1, Math.min(1, s / aBy));
  const e = pumped ? pumpedE(tr, a, s) : lerp(tr.e0, tr.e1, s);
  const i = lerp(tr.i0, tr.i1, clamp((s - iFrom) / (1 - iFrom), 0, 1));
  return withMotion({ a, e, i, omega: tr.omega, node: tr.node, M: tr.M }, driftYears);
}

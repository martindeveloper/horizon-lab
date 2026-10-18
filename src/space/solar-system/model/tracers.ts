/** The planetesimal sample: where each leftover of the disk starts and where the clearing sends it. */
import { periodYears, type Elements } from "@horizon/toolkit/bodies";
import { clamp, lerp, mulberry32, wrap } from "@horizon/toolkit/math";

import { tracerSemiMajorAxis } from "./equations";
import { migrationProgress } from "./moment";
import { COLD_CLASSICAL_AU, DISK_AU } from "./parameters";

export type Kind = "cold" | "hot" | "scattered" | "oort" | "ejected";
export type Bin = "disk" | "kuiper" | "scattered" | "oort" | "ejected";
export const BINS: readonly Bin[] = ["disk", "kuiper", "scattered", "oort", "ejected"];

export type Tracer = {
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
  const u = clamp((mig - tr.p0) / Math.max(1e-6, tr.p1 - tr.p0), 0, 1);
  return u * u * (3 - 2 * u);
}

/**
 * A seeded sample of planetesimals. The primordial disk spans about 16–34 AU
 * (Nice model); cold classicals form near 42–48 AU and stay. Shares are
 * illustrative: most leftovers are ejected, a minority ends in the belt, the
 * scattered disk and the Oort cloud.
 */
export function createTracers(count: number, seed = 20261014): Tracer[] {
  const rng = mulberry32(seed);
  const out: Tracer[] = [];
  for (let n = 0; n < count; n += 1) {
    const roll = rng();
    const kind: Kind =
      roll < 0.08
        ? "cold"
        : roll < 0.18
          ? "hot"
          : roll < 0.32
            ? "scattered"
            : roll < 0.46
              ? "oort"
              : "ejected";
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
    if (kind === "hot") {
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
    } else if (kind === "scattered") {
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
    } else if (kind === "oort") {
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
        i1: Math.acos(1 - 2 * rng()) * (180 / Math.PI),
        ...angles,
        p0,
        p1,
      });
    } else {
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
    }
  }
  return out;
}

export const TRACERS: readonly Tracer[] = createTracers(560);

export function binOf(tr: Tracer, mig: number): Bin {
  if (tr.kind === "cold") return "kuiper";
  const s = scatterS(tr, mig);
  if (tr.kind === "hot") return s < 0.28 ? "disk" : "kuiper";
  if (tr.kind === "scattered") return s < 0.22 ? "disk" : "scattered";
  if (tr.kind === "oort") return s < 0.3 ? "disk" : s < 0.62 ? "scattered" : "oort";
  return s < 0.28 ? "disk" : "ejected";
}

export function tracerVisible(tr: Tracer, mig: number) {
  return tr.kind !== "ejected" || scatterS(tr, mig) < 0.93;
}

export type Tally = Record<Bin, number>;
export function tallyAt(yearsAgo: number): Tally {
  const mig = migrationProgress(yearsAgo);
  const tally: Tally = { disk: 0, kuiper: 0, scattered: 0, oort: 0, ejected: 0 };
  for (const tr of TRACERS) tally[binOf(tr, mig)] += 1;
  return tally;
}

function withMotion(el: Elements, driftYears: number): Elements {
  return { ...el, M: wrap(el.M + (driftYears / periodYears(el.a)) * 360, 360) };
}

export function tracerElements(tr: Tracer, mig: number, driftYears: number): Elements {
  if (tr.kind === "cold")
    return withMotion(
      { a: tr.a0, e: tr.e0, i: tr.i0, omega: tr.omega, node: tr.node, M: tr.M },
      driftYears,
    );
  const s = scatterS(tr, mig);
  let a: number;
  let e: number;
  let i: number;
  if (tr.kind === "oort") {
    a = logLerp(tr.a0, tr.a1, s);
    const ePeak = clamp(1 - 40 / Math.max(a, 50), tr.e1, 0.96);
    e = s < 0.5 ? lerp(tr.e0, ePeak, s / 0.5) : lerp(ePeak, tr.e1, (s - 0.5) / 0.5);
    i = s < 0.55 ? tr.i0 : lerp(tr.i0, tr.i1, (s - 0.55) / 0.45);
  } else if (tr.kind === "ejected") {
    a = logLerp(tr.a0, tr.a1, Math.min(1, s / 0.9));
    e = lerp(tr.e0, tr.e1, s);
    i = lerp(tr.i0, tr.i1, s);
  } else {
    a = logLerp(tr.a0, tr.a1, s);
    e = lerp(tr.e0, tr.e1, s);
    i = lerp(tr.i0, tr.i1, s);
  }
  return withMotion({ a, e, i, omega: tr.omega, node: tr.node, M: tr.M }, driftYears);
}

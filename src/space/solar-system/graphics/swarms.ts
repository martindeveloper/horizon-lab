import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  NormalBlending,
  Points,
  ShaderMaterial,
} from "three";

import { jplElements } from "@horizon/toolkit/bodies";
import { gaussian, mulberry32 } from "@horizon/toolkit/math";
import { RAD_PER_DEG as RAD, resonanceSemiMajorAxis } from "@horizon/toolkit/science";

import { tracerSemiMajorAxis } from "../model/equations";
import { alongOrbit } from "../model/tracers";
import { createDriftEpoch } from "./drift-epoch";
import FRAG from "./shaders/swarm.frag.glsl";
/**
 * Swarms: thousands of small bodies on real orbit shapes, moved on the GPU.
 * Each point carries two sets of elements (start and end of the clearing
 * sketch) and the vertex shader solves Kepler's equation for the moment, so
 * the asteroid belt, the Trojans, the Kuiper belt and the Oort cloud orbit at
 * the same along-orbit speed-up as everything else, in one draw call each, the drift re-based
 * in time as it grows (drift-epoch.ts).
 */
import VERT from "./shaders/swarm.vert.glsl";

/** Where an orbit of `k` times the planet's period sits, by Kepler's third law. */
const resonance = (planet: "jupiter" | "neptune", k: number) =>
  resonanceSemiMajorAxis.compute({ ap: jplElements(planet, 0).a, k });

type SwarmBody = {
  a0: number;
  a1: number;
  e0: number;
  e1: number;
  i0: number;
  i1: number;
  node: number;
  omega: number;
  M: number;
  /** Clearing progress at which the body appears (0 = always there). */
  appears: number;
  /** +1 leads the anchor body by 60°, −1 trails it, 0 is a free orbit. */
  coorbital: -1 | 0 | 1;
  /** Libration offset around the Lagrange point, degrees. */
  offset: number;
  color: [number, number, number];
};

/** The bodies as points, and their drift epoch. */
function swarmGeometry(bodies: SwarmBody[]) {
  const n = bodies.length;
  const position = new Float32Array(n * 3);
  const orbitA = new Float32Array(n * 4);
  const orbitB = new Float32Array(n * 4);
  const orbitC = new Float32Array(n * 4);
  const color = new Float32Array(n * 3);
  for (let i = 0; i < n; i += 1) {
    const b = bodies[i]!;
    orbitA.set([b.a0, b.a1, b.e0, b.e1], i * 4);
    orbitB.set([b.i0 * RAD, b.i1 * RAD, b.node * RAD, b.omega * RAD], i * 4);
    orbitC.set([b.M * RAD, b.appears, b.coorbital, b.offset * RAD], i * 4);
    color.set(b.color, i * 3);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(position, 3));
  geometry.setAttribute("orbitA", new BufferAttribute(orbitA, 4));
  geometry.setAttribute("orbitB", new BufferAttribute(orbitB, 4));
  const phases = new BufferAttribute(orbitC, 4);
  geometry.setAttribute("orbitC", phases);
  geometry.setAttribute("color", new BufferAttribute(color, 3));
  /* Semi-major axes move with the clearing in log space, as the shader moves them. */
  const drift = createDriftEpoch(bodies, phases, (i, mig, years) => {
    const { a0, a1, M } = bodies[i]!;
    return alongOrbit(M, tracerSemiMajorAxis.compute({ a0, a1, s: mig }), years) * RAD;
  });
  return { geometry, drift };
}

/** `dpr` is the host's live pixel ratio, shared as the uniform so sizes follow the quality. */
function swarmMaterial(size: number, opacity: number, additive: boolean, dpr: { value: number }) {
  return new ShaderMaterial({
    uniforms: {
      mig: { value: 1 },
      drift: { value: 0 },
      anchorLon: { value: 0 },
      size: { value: size },
      dpr,
      near: { value: 0 },
      opacity: { value: opacity },
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    blending: additive ? AdditiveBlending : NormalBlending,
    toneMapped: false,
  });
}

type Swarm = {
  points: Points;
  material: ShaderMaterial;
  /** Draws these bodies instead, as a new quality asks for more or fewer. */
  refill: (bodies: SwarmBody[]) => void;
  /** The moment, `driftYears` along the orbits; `pixel` is a pixel's world size where it is seen. */
  set: (mig: number, driftYears: number, pixel: number, near: number, anchorLon?: number) => void;
  /** Shows the swarm at `presence` (0..1) of its opacity; returns whether it draws at all. */
  fade: (presence: number) => boolean;
  dispose: () => void;
};

export function createSwarm(
  bodies: SwarmBody[],
  size: number,
  opacity: number,
  additive: boolean,
  dpr: { value: number },
): Swarm {
  let { geometry, drift } = swarmGeometry(bodies);
  const material = swarmMaterial(size, opacity, additive, dpr);
  const points = new Points(geometry, material);
  points.frustumCulled = false;
  return {
    points,
    material,
    refill(next) {
      const old = geometry;
      ({ geometry, drift } = swarmGeometry(next));
      points.geometry = geometry;
      old.dispose();
    },
    set(mig, driftYears, pixel, near, anchorLon = 0) {
      material.uniforms.mig!.value = mig;
      material.uniforms.drift!.value = drift.since(mig, driftYears, pixel);
      material.uniforms.near!.value = near;
      material.uniforms.anchorLon!.value = anchorLon;
    },
    fade(presence) {
      points.visible = presence > 0.004;
      material.uniforms.opacity!.value = opacity * presence;
      return points.visible;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}

type Rgb = [number, number, number];
const shade = (base: Rgb, k: number): Rgb => [base[0] * k, base[1] * k, base[2] * k];
const ROCK: Rgb = [0.7, 0.65, 0.57];
const ROCK_LIGHT: Rgb = [0.88, 0.82, 0.72];
const ICE: Rgb = [0.68, 0.8, 0.88];
const ICE_RED: Rgb = [0.82, 0.66, 0.58];
const COMET: Rgb = [0.9, 0.94, 0.98];

/** Kirkwood gaps: the 4:1, 3:1, 5:2, 7:3 and 2:1 resonances with Jupiter are nearly empty. */
const KIRKWOOD: readonly [a: number, halfWidth: number][] = [
  [resonance("jupiter", 1 / 4), 0.02],
  [resonance("jupiter", 1 / 3), 0.03],
  [resonance("jupiter", 2 / 5), 0.025],
  [resonance("jupiter", 3 / 7), 0.015],
  [resonance("jupiter", 1 / 2), 0.04],
];

/** Neptune's 3:2 and 2:1 resonances: the plutinos (39.4 au) and twotinos (47.7 au). */
const PLUTINOS_AU = resonance("neptune", 3 / 2);
const TWOTINOS_AU = resonance("neptune", 2);

/**
 * The main belt: a seeded sample of 2.1–3.3 AU orbits with e < 0.3 and
 * i < 25°, denser in the middle and empty at the Kirkwood gaps.
 */
export function mainBelt(count: number): SwarmBody[] {
  const rnd = mulberry32(99);
  const out: SwarmBody[] = [];
  while (out.length < count) {
    const a = 2.1 + rnd() * 1.2 + gaussian(rnd) * 0.1;
    if (a < KIRKWOOD[0]![0] || a > 3.35) continue;
    if (KIRKWOOD.some(([c, w]) => Math.abs(a - c) < w)) continue;
    const e = Math.min(0.3, Math.abs(gaussian(rnd)) * 0.1 + rnd() * 0.08);
    const i = Math.min(25, Math.abs(gaussian(rnd)) * 7);
    const k = 0.55 + rnd() * 0.45;
    out.push({
      a0: a,
      a1: a,
      e0: e,
      e1: e,
      i0: i,
      i1: i,
      node: rnd() * 360,
      omega: rnd() * 360,
      M: rnd() * 360,
      appears: 0,
      coorbital: 0,
      offset: 0,
      color: shade(rnd() > 0.72 ? ROCK_LIGHT : ROCK, k),
    });
  }
  return out;
}

/**
 * Jupiter's Trojans at L4 and L5, librating about ±60° with inclinations up to
 * ~35°. They were most likely captured during the giant-planet instability,
 * so they appear during the clearing. The leading L4 cloud holds about 1.4–1.6× as
 * many as L5 (Grav et al. 2011; Szabó et al. 2007), so three in five dots lead (1.5×).
 */
export function trojans(count: number): SwarmBody[] {
  const rnd = mulberry32(2013);
  const out: SwarmBody[] = [];
  for (let n = 0; n < count; n += 1) {
    const sign = n % 5 < 3 ? 1 : -1;
    const e = Math.min(0.2, Math.abs(gaussian(rnd)) * 0.06);
    const i = Math.min(35, Math.abs(gaussian(rnd)) * 11);
    out.push({
      a0: 5.45,
      a1: 5.2,
      e0: e,
      e1: e,
      i0: i,
      i1: i,
      node: rnd() * 360,
      omega: rnd() * 360,
      M: 0,
      appears: 0.55 + rnd() * 0.3,
      coorbital: sign,
      offset: gaussian(rnd) * 11,
      color: shade(rnd() > 0.6 ? ROCK_LIGHT : ROCK, 0.7 + rnd() * 0.5),
    });
  }
  return out;
}

/**
 * The classical and resonant Kuiper belt. Cold classicals (42–48 AU, low e and
 * i) formed in place; hot classicals, plutinos (3:2, 39.4 AU) and twotinos (2:1,
 * 47.7 AU) were stirred or captured by Neptune's outward move, so they start
 * nearer in and appear as the clearing progresses. Nothing beyond ~50 AU: the
 * Kuiper cliff.
 */
export function kuiperBelt(count: number): SwarmBody[] {
  const rnd = mulberry32(1992);
  const out: SwarmBody[] = [];
  for (let n = 0; n < count; n += 1) {
    const roll = rnd();
    const k = 0.45 + rnd() * 0.55;
    const angles = { node: rnd() * 360, omega: rnd() * 360, M: rnd() * 360 };
    if (roll < 0.36) {
      const a = 42 + rnd() * 5.5;
      const e = Math.abs(gaussian(rnd)) * 0.04;
      const i = Math.abs(gaussian(rnd)) * 2.2;
      out.push({
        a0: a,
        a1: a,
        e0: e,
        e1: e,
        i0: i,
        i1: i,
        ...angles,
        appears: 0,
        coorbital: 0,
        offset: 0,
        color: shade(ICE_RED, k),
      });
    } else if (roll < 0.64) {
      const a1 = 38 + rnd() * 11;
      out.push({
        a0: 18 + rnd() * 14,
        a1,
        e0: 0.01 + rnd() * 0.03,
        e1: 0.05 + rnd() * 0.2,
        i0: rnd() * 2,
        i1: 5 + Math.abs(gaussian(rnd)) * 12,
        ...angles,
        appears: 0.15 + rnd() * 0.5,
        coorbital: 0,
        offset: 0,
        color: shade(ICE, k),
      });
    } else if (roll < 0.9) {
      const a1 = PLUTINOS_AU + gaussian(rnd) * 0.25;
      out.push({
        a0: 24 + rnd() * 8,
        a1,
        e0: 0.01 + rnd() * 0.03,
        e1: 0.1 + rnd() * 0.22,
        i0: rnd() * 2,
        i1: Math.abs(gaussian(rnd)) * 9,
        ...angles,
        appears: 0.2 + rnd() * 0.45,
        coorbital: 0,
        offset: 0,
        color: shade(ICE, k * 1.05),
      });
    } else {
      const a1 = TWOTINOS_AU + gaussian(rnd) * 0.25;
      out.push({
        a0: 26 + rnd() * 8,
        a1,
        e0: 0.01 + rnd() * 0.03,
        e1: 0.1 + rnd() * 0.25,
        i0: rnd() * 2,
        i1: Math.abs(gaussian(rnd)) * 8,
        ...angles,
        appears: 0.35 + rnd() * 0.4,
        coorbital: 0,
        offset: 0,
        color: shade(ICE, k),
      });
    }
  }
  return out;
}

/**
 * The Oort cloud as inferred: number density falling about as r⁻³·⁵ from an
 * inner, flatter cloud (2,000–20,000 AU) into an isotropic outer shell out to
 * 100,000 AU. Bodies come from the scattered disk, so they appear late.
 */
export function oortCloud(count: number): SwarmBody[] {
  const rnd = mulberry32(1950);
  const out: SwarmBody[] = [];
  const sample = (min: number, max: number) => {
    // inverse CDF of r² · r⁻³·⁵ = r⁻¹·⁵
    const p = -0.5;
    const u = rnd();
    return (min ** p + u * (max ** p - min ** p)) ** (1 / p);
  };
  for (let n = 0; n < count; n += 1) {
    const inner = rnd() < 0.42;
    const a1 = inner ? sample(2_000, 20_000) : sample(20_000, 100_000);
    const e = Math.sqrt(rnd()) * 0.9;
    const i = inner ? Math.min(89, Math.abs(gaussian(rnd)) * 28) : Math.acos(rnd() * 2 - 1) / RAD;
    const k = 0.4 + rnd() * 0.6;
    out.push({
      a0: 16 + rnd() * 18,
      a1,
      e0: 0.02,
      e1: e,
      i0: rnd() * 2,
      i1: i,
      node: rnd() * 360,
      omega: rnd() * 360,
      M: rnd() * 360,
      appears: 0.5 + rnd() * 0.45,
      coorbital: 0,
      offset: 0,
      color: shade(COMET, k),
    });
  }
  return out;
}

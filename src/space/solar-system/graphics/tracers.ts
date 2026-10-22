/**
 * The planetesimal sample on the GPU: every body's elements and track through the clearing as
 * instance attributes of one rock, so rock.vert.glsl moves the whole sample and a frame writes
 * only uniforms (and, now and then, the phases at a new drift epoch: drift-epoch.ts). The
 * model, and what a tap reads, stays model/tracers.ts.
 */
import { Color, InstancedBufferAttribute, InstancedBufferGeometry, SphereGeometry } from "three";

import { RAD_PER_DEG as RAD } from "@horizon/toolkit/science";

import { BINS, TRACERS, TRACKS, tracerElements, type Bin, type Stage } from "../model/tracers";
import { createDriftEpoch } from "./drift-epoch";

/** Population tints for the planetesimal lumps: icy grey in the disk, reddened in the belt, pale far out. */
export const BIN_COLOR: Record<Bin, Color> = {
  disk: new Color("#a8a39b"),
  kuiper: new Color("#c09a82"),
  scattered: new Color("#a9b6c0"),
  oort: new Color("#d6dee4"),
  ejected: new Color("#c4705a"),
};

/** Stages the shader follows: the first and up to two more. */
const STAGES = 3;
/** A stage as the shader reads it: its bin's index, or one past the bins once gone. */
const stageCode = (stage: Stage) => (stage === "gone" ? BINS.length : BINS.indexOf(stage));

/**
 * The sample as instances of a unit sphere with `width` × `height` segments, and its drift
 * epoch, whose phases are the model's (`tracerElements`).
 */
export function tracerGeometry(width: number, height: number) {
  const n = TRACERS.length;
  const orbitA = new Float32Array(n * 4);
  const orbitB = new Float32Array(n * 4);
  const orbitC = new Float32Array(n * 4);
  const track = new Float32Array(n * 3);
  const stages = new Float32Array(n * STAGES);
  const steps = new Float32Array(n * (STAGES - 1));
  for (let i = 0; i < n; i += 1) {
    const tr = TRACERS[i]!;
    const { stages: path, steps: at, aBy, iFrom, pumped } = TRACKS[tr.kind];
    if (path.length > STAGES) throw new Error(`a ${tr.kind} track has more than ${STAGES} stages`);
    orbitA.set([tr.a0, tr.a1, tr.e0, tr.e1], i * 4);
    orbitB.set([tr.i0 * RAD, tr.i1 * RAD, tr.node * RAD, tr.omega * RAD], i * 4);
    orbitC.set([tr.M * RAD, tr.p0, tr.p1, (i * 0.618034) % 1], i * 4);
    track.set([aBy, iFrom, pumped ? 1 : 0], i * 3);
    /* A shorter track repeats its last stage and step; a repeated stage never changes the bin. */
    for (let k = 0; k < STAGES; k += 1)
      stages[i * STAGES + k] = stageCode(path[Math.min(k, path.length - 1)]!);
    for (let k = 0; k < STAGES - 1; k += 1)
      steps[i * (STAGES - 1) + k] = at[Math.min(k, at.length - 1)] ?? 0;
  }
  const sphere = new SphereGeometry(1, width, height);
  const geometry = new InstancedBufferGeometry();
  geometry.setIndex(sphere.index);
  geometry.setAttribute("position", sphere.getAttribute("position"));
  geometry.setAttribute("orbitA", new InstancedBufferAttribute(orbitA, 4));
  geometry.setAttribute("orbitB", new InstancedBufferAttribute(orbitB, 4));
  const phases = new InstancedBufferAttribute(orbitC, 4);
  geometry.setAttribute("orbitC", phases);
  geometry.setAttribute("track", new InstancedBufferAttribute(track, 3));
  geometry.setAttribute("stages", new InstancedBufferAttribute(stages, STAGES));
  geometry.setAttribute("steps", new InstancedBufferAttribute(steps, STAGES - 1));
  geometry.instanceCount = n;
  const drift = createDriftEpoch(
    TRACERS,
    phases,
    (i, mig, years) => tracerElements(TRACERS[i]!, mig, years).M * RAD,
  );
  return { geometry, drift };
}

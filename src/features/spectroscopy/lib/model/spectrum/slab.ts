import { dopplerWavelengthRatio } from "@horizon/toolkit/science";

import { LINES, type ElementId, type Line } from "../atoms";
import { lineProfile, shapeAt, type Profile } from "../profile";
import { recentCache } from "../recent";
import { planck, slabIntensity } from "./radiance";
import {
  TAU_FLOOR,
  MAX_FINE,
  MODELS_KEPT,
  latticeFor,
  latticeSamples,
  restGrid,
  render,
  sweep,
  type Grid,
  type Lattices,
} from "./sampling";
import type { SlabObservation } from "./types";

/** Every line the slab's gas absorbs, with its profile at the source's velocity. */
export function slabProfiles(obs: SlabObservation) {
  const shift = dopplerWavelengthRatio(obs.velocity);
  const out: { line: Line; profile: Profile }[] = [];
  for (const line of LINES) {
    const profile = lineProfile(line, obs.gas, shift);
    if (profile && profile.peak * shapeAt(profile, 0) > TAU_FLOOR) out.push({ line, profile });
  }
  return out;
}

/** A slab's lines at rest and its optical depth on the lattice: they depend on the gas alone. */
type SlabModel = { lines: { line: Line; profile: Profile }[]; lattices: Lattices };

const slabModels = recentCache<string, SlabModel>(MODELS_KEPT);

const slabModel = (obs: SlabObservation) =>
  slabModels(JSON.stringify(obs.gas), () => ({
    lines: slabProfiles({ ...obs, velocity: 0 }),
    lattices: new Map(),
  }));

/** The optical depth of `lines` on a grid at rest. */
function slabDepth(lines: SlabModel["lines"], grid: Grid) {
  const tau = new Float64Array(grid.count);
  for (const { profile } of lines)
    /* A dense bench gas can keep its wings dark across the whole window: no cut-off. */
    sweep(
      profile,
      grid,
      (i, offset) => {
        tau[i]! += profile.peak * shapeAt(profile, offset / profile.doppler);
      },
      Infinity,
    );
  return tau;
}

/**
 * The nodes' spacing for Planck's law on the bench, nm: linear between them it stays within
 * 4 × 10⁻⁶ of itself even at 1,500 K and 380 nm, where it curves most.
 */
const PLANCK_STEP = 0.1;

/**
 * Planck's law for the lamp (0 when it is off) and for the gas, at nodes `PLANCK_STEP` apart,
 * each worked out the first time a wavelength near it is asked for, and linear between them.
 */
function planckTable(lamp: number | null, gas: number) {
  type Node = readonly [lamp: number, gas: number];
  const nodes = new Map<number, Node>();
  const node = (g: number): Node => {
    let known = nodes.get(g);
    if (!known) {
      const nm = g * PLANCK_STEP;
      known = [lamp === null ? 0 : planck(nm, lamp), planck(nm, gas)];
      nodes.set(g, known);
    }
    return known;
  };
  const out = { lamp: 0, gas: 0 };
  /* The nodes either side of the last wavelength: the first call always sets them. */
  let at = Number.NaN;
  let below: Node;
  let above: Node;
  return (nm: number) => {
    const x = nm / PLANCK_STEP;
    const g = Math.floor(x);
    const t = x - g;
    if (g !== at) {
      at = g;
      below = node(g);
      above = node(g + 1);
    }
    out.lamp = below[0] + t * (above[0] - below[0]);
    out.gas = below[1] + t * (above[1] - below[1]);
    return out;
  };
}

/** The slab's spectrum, or (`without`) the spectrum without one element's atoms. */
export function synthesizeSlab(
  obs: SlabObservation,
  from: number,
  to: number,
  samples: number,
  without?: ElementId,
) {
  const model = slabModel(obs);
  const grid = latticeFor(
    from,
    to,
    obs.resolution,
    dopplerWavelengthRatio(obs.velocity),
    MAX_FINE.slab,
  );
  const tau =
    without === undefined
      ? latticeSamples(model.lattices, grid, (chunk) => slabDepth(model.lines, chunk))
      : slabDepth(
          model.lines.filter(({ line }) => line.element !== without),
          restGrid(grid),
        );
  const light = planckTable(obs.background, obs.gas.temperature);
  return render(
    grid,
    obs,
    from,
    to,
    samples,
    (i, nm) => {
      const { lamp, gas } = light(nm);
      return slabIntensity(lamp, gas, tau[i]!);
    },
    (nm) => light(nm).lamp,
  );
}

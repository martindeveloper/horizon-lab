/**
 * Catalogue points and reconstruction guides. No generated galaxy is ever added
 * to a measured catalogue. Centre markers have a fixed screen size; physical-scale
 * uncertainty bars and size guides are separate, shown only when inspecting them.
 */
import { BufferAttribute, BufferGeometry, Color } from "three";

import type { Vec3 } from "@horizon/toolkit/bodies";
import { createPointWriter } from "@horizon/toolkit/scene";
import { convert } from "@horizon/toolkit/science";

import {
  type BASINS,
  CLASSIX_CLUSTERS,
  VELA,
  VOIDS,
  catalogueNumber,
  equivalentRadius,
  hMpcToMly,
  observedPosition,
  reconstructedPosition,
} from "../model/atlas";
import cf4 from "../model/data/cf4.json";
import desi from "../model/data/desi.json";

/** Cached in CPU memory across quality changes; the committed records never change. */
let catalogue: Vec3[] | undefined;
export function surveyPositions(): readonly Vec3[] {
  if (catalogue) return catalogue;
  const c = convert(1, "c", "km/s");
  catalogue = [];
  for (const row of cf4.rows) {
    const ra = catalogueNumber(row[1]),
      dec = catalogueNumber(row[2]),
      cz = catalogueNumber(row[3]);
    // Negative CMB redshifts in the nearby bound universe cannot be Hubble distances.
    // The existing Local Group/Sheet maps cover that regime; do not pile them at zero.
    if (cz <= 0) continue;
    catalogue.push(observedPosition(ra, dec, cz / c, "cmb"));
  }
  for (const row of desi.rows) {
    const ra = catalogueNumber(row[1]),
      dec = catalogueNumber(row[2]),
      z = catalogueNumber(row[3]);
    catalogue.push(observedPosition(ra, dec, z, "observer"));
  }
  return catalogue;
}

/** A nested deterministic sample: changing render quality does not move a single point. */
export function observedCloud(share: number) {
  const all = surveyPositions();
  const stride = Math.max(1, Math.round(1 / Math.max(0.01, share)));
  const writer = createPointWriter(Math.ceil(all.length / stride));
  const colour = new Color("#e2e6ec");
  for (let i = 0; i < all.length; i += stride) {
    const p = all[i]!;
    writer.put(p[0], p[1], p[2], colour, 1);
  }
  return writer.geometry();
}

export function classixCloud() {
  const writer = createPointWriter(CLASSIX_CLUSTERS.length);
  const quipu = new Color("#f3e6cf");
  const other = new Color("#e2e6ec");
  for (const { at, structure } of CLASSIX_CLUSTERS)
    writer.put(...at, structure === 1 ? quipu : other, 1);
  return writer.geometry();
}

const geometry = (positions: number[]) =>
  new BufferGeometry().setAttribute(
    "position",
    new BufferAttribute(new Float32Array(positions), 3),
  );

/** Solid cross-axis error bars in the published supergalactic frame. */
export function basinGeometry(basin: (typeof BASINS)[number]) {
  const vertices: number[] = [];
  for (let axis = 0; axis < 3; axis++) {
    const lo = [...basin.sg],
      hi = [...basin.sg];
    lo[axis] = lo[axis]! - basin.sigma[axis]!;
    hi[axis] = hi[axis]! + basin.sigma[axis]!;
    vertices.push(...reconstructedPosition(lo), ...reconstructedPosition(hi));
  }
  return geometry(vertices);
}

/** Positions only: the material supplies a small screen-space marker, never a 3D solid. */
export function centreCloud(centres: readonly { at: Vec3 }[]) {
  return geometry(centres.flatMap(({ at }) => [...at]));
}

/** Unit circle in separated strokes: a geometry dash stays dashed at every zoom. */
export function sizeGuideGeometry() {
  const vertices: number[] = [];
  const pieces = 40;
  for (let i = 0; i < pieces; i++) {
    for (const step of [i, i + 0.5]) {
      const angle = (step / pieces) * Math.PI * 2;
      vertices.push(Math.cos(angle), Math.sin(angle), 0);
    }
  }
  return geometry(vertices);
}

export const SIZE_GUIDES = [
  {
    at: VELA.at,
    radius: hMpcToMly(equivalentRadius(VELA.volume)),
    robust: null,
    layer: "cosmicBasins" as const,
  },
  ...VOIDS.map((v) => ({
    at: v.at,
    radius: v.radiusMly,
    robust: v.robustRadiusMly,
    layer: "cosmicVoids" as const,
  })),
];

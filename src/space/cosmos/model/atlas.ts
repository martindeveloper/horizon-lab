import { SUN_GALACTIC_RADIUS_LY, SUN_HEIGHT_LY } from "@/space/galaxy/model/parameters";
/**
 * The observed and reconstructed cosmic atlas. See data/README.md for provenance,
 * coordinate conventions, limitations and the repeatable update command.
 *
 * Only the small landmark tables live here. The large observed catalogues are
 * imported by graphics/atlas.ts, behind the world's client-only renderer.
 */
import type { Vec3 } from "@horizon/toolkit/bodies";
import {
  PLANCK_2018,
  comovingDistanceMpc,
  convert,
  equatorialToGalactic,
} from "@horizon/toolkit/science";

import { HUBBLE, cmbCz, fromSupergalactic } from "./cosmos";
import classix from "./data/classix.json";
import reconstruction from "./data/reconstructions.json";
import sources from "./data/sources.json";

export const ATLAS_SOURCES = sources;
export type AtlasSource = keyof typeof sources;
export const ATLAS_SUN: Vec3 = [SUN_GALACTIC_RADIUS_LY / 1e6, SUN_HEIGHT_LY / 1e6, 0];
/** h₁₀₀, NOT h₇₀: the papers' Cartesian lengths are in h⁻¹ Mpc. */
export const ATLAS_H = HUBBLE / 100;
export const hMpcToMly = (length: number) => convert(length / ATLAS_H, "Mpc", "Mly");
export const equivalentRadius = (volume: number) => Math.cbrt((3 * volume) / (4 * Math.PI));
/** Fail visibly if a refreshed JSON table changes its numeric column schema. */
export function catalogueNumber(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value))
    throw new Error("Invalid cosmic catalogue numeric column");
  return value;
}

/** Published supergalactic Cartesian coordinates → the renderer's galactocentric Mly. */
export function reconstructedPosition(sg: readonly number[]): Vec3 {
  const p = fromSupergalactic(hMpcToMly(sg[0]!), hMpcToMly(sg[1]!), hMpcToMly(sg[2]!));
  return [p[0] + ATLAS_SUN[0], p[1] + ATLAS_SUN[1], p[2] + ATLAS_SUN[2]];
}

/**
 * Measured angles + redshift, with a model-derived radial distance. CF4 already
 * supplies CMB-frame cz; applying the dipole twice would shift its structures.
 * CLASSIX and DESI observer-frame redshifts receive the same low-z correction as
 * the existing landmarks. Peculiar velocities still distort redshift space.
 */
export function observedPosition(
  ra: number,
  dec: number,
  z: number,
  frame: "cmb" | "observer",
): Vec3 {
  const { l, b } = equatorialToGalactic(ra, dec);
  const c = convert(1, "c", "km/s");
  const zCmb = frame === "cmb" ? z : cmbCz(l, b, z * c) / c;
  const radius = convert(comovingDistanceMpc(Math.max(0, zCmb), PLANCK_2018), "Mpc", "Mly");
  const rad = Math.PI / 180;
  const cb = Math.cos(b * rad);
  return [
    ATLAS_SUN[0] - radius * cb * Math.cos(l * rad),
    ATLAS_SUN[1] + radius * Math.sin(b * rad),
    ATLAS_SUN[2] + radius * cb * Math.sin(l * rad),
  ];
}

export const CLASSIX_CLUSTERS = classix.rows.map((row) => {
  const [name, structure, ra, dec, z] = row;
  if (typeof name !== "string") throw new Error("Invalid CLASSIX name");
  return {
    name,
    structure: catalogueNumber(structure),
    at: observedPosition(catalogueNumber(ra), catalogueNumber(dec), catalogueNumber(z), "observer"),
  };
});
export const QUIPU_CLUSTERS = CLASSIX_CLUSTERS.filter((c) => c.structure === 1);
const centroid = (points: readonly { at: Vec3 }[]): Vec3 => {
  const mean = (axis: 0 | 1 | 2) => points.reduce((sum, p) => sum + p.at[axis], 0) / points.length;
  return [mean(0), mean(1), mean(2)];
};

export const BASINS = reconstruction.basins.map((b) => ({ ...b, at: reconstructedPosition(b.sg) }));
export const VOIDS = reconstruction.voids.map((v) => ({
  ...v,
  at: reconstructedPosition(v.sg),
  radiusMly: hMpcToMly(v.radius),
  robustRadiusMly: hMpcToMly(v.robustRadius),
}));
export const KNOTS = reconstruction.knots.map((k) => ({ ...k, at: reconstructedPosition(k.sg) }));
export const VELA = { ...reconstruction.vela, at: reconstructedPosition(reconstruction.vela.sg) };
export const basinByName = (name: string) => BASINS.find((b) => b.name === name)!;
export const voidById = (id: number) => VOIDS.find((v) => v.id === id)!;

/** Measurement category is independent of publication status. */
export type AtlasLayer = "cosmicMeasured" | "cosmicBasins" | "cosmicVoids" | "cosmicKnots";
export const ATLAS_LANDMARKS = {
  quipu: { at: centroid(QUIPU_CLUSTERS), layer: "cosmicMeasured", source: "classix" },
  vela: { at: VELA.at, layer: "cosmicBasins", source: "vela" },
  // Pomarède 2020 §III: Chamaeleon+11.8, the peak at the celestial south pole.
  // This is a peak marker, NOT a digitised or reconstructed wall surface.
  southPoleWall: {
    at: observedPosition(0, -90, 11_800 / convert(1, "c", "km/s"), "cmb"),
    layer: "cosmicBasins",
    source: "south",
  },
  shapleyBasin: { at: basinByName("Shapley").at, layer: "cosmicBasins", source: "basins" },
  sloanBasin: { at: basinByName("Sloan Great Wall").at, layer: "cosmicBasins", source: "sloan" },
  ophiuchusBasin: { at: basinByName("Ophiuchus").at, layer: "cosmicBasins", source: "basins" },
  localVoid: { at: voidById(10).at, layer: "cosmicVoids", source: "voids" },
  northernLocalVoid: { at: voidById(13).at, layer: "cosmicVoids", source: "voids" },
  sculptorVoid: { at: voidById(28).at, layer: "cosmicVoids", source: "voids" },
} as const satisfies Record<string, { at: Vec3; layer: AtlasLayer; source: AtlasSource }>;
export type AtlasLandmarkId = keyof typeof ATLAS_LANDMARKS;
export const ATLAS_LABELS = Object.keys(ATLAS_LANDMARKS).filter(isAtlasLandmark);
export type AtlasId =
  | AtlasLandmarkId
  | "cosmicSurveys"
  | "cosmicBasins"
  | "cosmicVoids"
  | "cosmicKnots";

export const ATLAS_CARD_SOURCES: Record<AtlasId, readonly AtlasSource[]> = {
  quipu: ["classix"],
  vela: ["vela"],
  southPoleWall: ["south"],
  shapleyBasin: ["basins"],
  sloanBasin: ["sloan", "basins"],
  ophiuchusBasin: ["basins"],
  localVoid: ["voids"],
  northernLocalVoid: ["voids"],
  sculptorVoid: ["voids"],
  cosmicSurveys: ["cf4", "classix", "desi"],
  cosmicBasins: ["basins"],
  cosmicVoids: ["voids"],
  cosmicKnots: ["voids"],
};

export const isAtlasId = (id: string): id is AtlasId => Object.hasOwn(ATLAS_CARD_SOURCES, id);
export function isAtlasLandmark(id: string): id is AtlasLandmarkId {
  return Object.hasOwn(ATLAS_LANDMARKS, id);
}

/** Deep Field opts into the atlas; a host without these switches keeps its original drawing. */
export const ATLAS_DEFAULT_SHOW = {
  cosmicMeasured: true,
  cosmicBasins: true,
  cosmicVoids: true,
  cosmicKnots: true,
  // Physical-scale error bars and size circles overwhelm the overview. A selected
  // landmark reveals its own guide; the full diagnostic overlay is explicitly opt-in.
  cosmicGuides: false,
  cosmicIllustrations: false,
} as const;
export type AtlasShow = { [K in keyof typeof ATLAS_DEFAULT_SHOW]: boolean };
export const atlasVisibility = (show: Partial<AtlasShow>): AtlasShow =>
  show.cosmicMeasured === undefined
    ? {
        cosmicMeasured: false,
        cosmicBasins: false,
        cosmicVoids: false,
        cosmicKnots: false,
        cosmicGuides: false,
        cosmicIllustrations: true,
      }
    : { ...ATLAS_DEFAULT_SHOW, ...show };

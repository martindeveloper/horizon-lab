import { FEATURES } from "../config";
import { blackHoleManifest } from "../features/black-hole/manifest";
import { deepFieldManifest } from "../features/deep-field/manifest";
import { giantsManifest } from "../features/giants/manifest";
import { orreryManifest } from "../features/orrery/manifest";
import { spectroscopyManifest } from "../features/spectroscopy/manifest";
import { sunManifest } from "../features/sun/manifest";
import { voyageManifest } from "../features/voyage/manifest";
import type { SimulationManifest } from "./simulation-types";

/** Lightweight catalogue registry: never import renderers or stores here. */
export const registered = [
  blackHoleManifest,
  orreryManifest,
  deepFieldManifest,
  spectroscopyManifest,
  giantsManifest,
  sunManifest,
  voyageManifest,
] as const satisfies readonly SimulationManifest[];

export type RegisteredSimulation = (typeof registered)[number];

export const simulationOn = (manifest: RegisteredSimulation) =>
  !("feature" in manifest) || FEATURES[manifest.feature];

export const simulations: readonly RegisteredSimulation[] = registered.filter(simulationOn);

export const labs = simulations.filter((simulation) => simulation.kind === "lab");
export const experiences = simulations.filter((simulation) => simulation.kind === "experience");

export function simulationForPath(pathname: string) {
  return simulations.find(({ href }) => pathname === href || pathname.startsWith(`${href}/`));
}

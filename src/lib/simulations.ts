import { blackHoleManifest } from "@/features/black-hole/manifest";
import { orreryManifest } from "@/features/orrery/manifest";

import type { SimulationManifest } from "./simulation-types";

/** Lightweight catalogue registry: never import renderers or stores here. */
export const simulations = [
  blackHoleManifest,
  orreryManifest,
] as const satisfies readonly SimulationManifest[];
export function simulationForPath(pathname: string) {
  return simulations.find(({ href }) => pathname === href || pathname.startsWith(`${href}/`));
}

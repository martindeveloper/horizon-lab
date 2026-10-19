import { blackHoleManifest } from "@/features/black-hole/manifest";
import { deepFieldManifest } from "@/features/deep-field/manifest";
import { orreryManifest } from "@/features/orrery/manifest";
import { spectroscopyManifest } from "@/features/spectroscopy/manifest";

import type { SimulationManifest } from "./simulation-types";

/** Lightweight catalogue registry: never import renderers or stores here. */
export const simulations = [
  blackHoleManifest,
  orreryManifest,
  deepFieldManifest,
  spectroscopyManifest,
] as const satisfies readonly SimulationManifest[];
export function simulationForPath(pathname: string) {
  return simulations.find(({ href }) => pathname === href || pathname.startsWith(`${href}/`));
}

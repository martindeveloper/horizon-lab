import { FEATURES } from "../config";
import { slugRoutes, type RouteDefinition } from "./simulation-paths";
import type { SimulationManifest } from "./simulation-types";

/** One switch declaration governs catalogue visibility and every server entry point. */
export function simulationOn(manifest: Pick<SimulationManifest, "id" | "feature">) {
  return manifest.feature === undefined || FEATURES[manifest.feature];
}

/** App Router static parameters, omitted while the manifest's feature switch is off. */
export function simulationStaticParams<Id extends string, Param extends string>(
  manifest: Pick<SimulationManifest, "id" | "feature"> & { routes: RouteDefinition<Id, Param> },
) {
  const routes = slugRoutes(manifest.routes);
  return () => (simulationOn(manifest) ? routes.params() : []);
}

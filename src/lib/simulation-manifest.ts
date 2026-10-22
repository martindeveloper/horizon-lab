import { slugRoutes, type RouteDefinition } from "./simulation-paths";
import type { SimulationManifest } from "./simulation-types";
import { simulationAssets } from "./urls";

type Details = Omit<SimulationManifest, "href" | "routes" | "artwork" | "social" | "entryPoints">;
type DefinedSimulation<Info extends Details, Routes extends RouteDefinition> = Omit<
  Info,
  "href" | "routes" | "artwork" | "social" | "entryPoints"
> &
  Pick<SimulationManifest, "href" | "artwork" | "social" | "entryPoints"> & { routes: Routes };

/** Derive public addresses and assets once; entry points only name a declared view. */
export function defineSimulation<const Routes extends RouteDefinition, const Info extends Details>(
  definition: Info & {
    routes: Routes;
    entryPoints: readonly { id: string; view: NoInfer<Routes["entries"][number]["id"]> }[];
  },
): DefinedSimulation<Info, Routes> {
  const routes = slugRoutes(definition.routes);
  return {
    ...definition,
    href: definition.routes.base,
    ...simulationAssets(definition.id),
    entryPoints: definition.entryPoints.map(({ id, view }) => {
      if (!definition.routes.entries.some((entry) => entry.id === view))
        throw new Error(`Unknown entry point view "${view}" in ${definition.id}`);
      return { id, href: routes.pathFor(view) };
    }),
  };
}

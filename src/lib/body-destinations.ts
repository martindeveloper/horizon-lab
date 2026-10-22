import { bodyKey, type BodyRef } from "../space/body-reference";
import { slugRoutes } from "./simulation-paths";
import type { SimulationManifest } from "./simulation-types";
import { simulations } from "./simulations";

/** Discover declared close-ups among the enabled labs, in catalogue order. */
export function bodyDestinations(
  body: BodyRef,
  available: readonly SimulationManifest[] = simulations,
) {
  const key = bodyKey(body);
  return available.flatMap(({ id, routes }) => {
    const paths = slugRoutes(routes);
    return routes.entries.flatMap((entry) =>
      entry.closeUp && entry.body && bodyKey(entry.body) === key
        ? [{ simulationId: id, href: paths.pathFor(entry.id) }]
        : [],
    );
  });
}

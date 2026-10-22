import { slugRoutes } from "./simulation-paths";
import type { SimulationManifest } from "./simulation-types";
import { simulations } from "./simulations";
import { PAGE_URLS } from "./urls";

/** Canonical clean paths, including every enabled feature's declared static routes. */
export function sitePaths(available: readonly SimulationManifest[] = simulations): string[] {
  return [
    PAGE_URLS.home,
    PAGE_URLS.about,
    PAGE_URLS.credits,
    ...available.flatMap(({ routes }) => slugRoutes(routes).paths()),
  ];
}

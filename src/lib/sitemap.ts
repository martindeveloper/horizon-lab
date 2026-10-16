import { pathForHole, presetRouteParams } from "@/features/black-hole/routing";
import { pathForView, viewRouteParams } from "@/features/orrery/routing";

import { simulations } from "./simulations";

type SimulationId = (typeof simulations)[number]["id"];

/** Prerendered subpages per simulation; a newly registered manifest fails typecheck until listed. */
const subpages: Record<SimulationId, () => string[]> = {
  "black-hole": () => presetRouteParams().map(({ hole }) => pathForHole(hole)),
  orrery: () => viewRouteParams().map(({ view }) => pathForView(view)),
};

/** Canonical clean paths: no language prefix and no redirect sources. */
export function sitePaths(): string[] {
  return [
    "/",
    "/about",
    "/credits",
    ...simulations.flatMap(({ id, href }) => [href, ...subpages[id]()]),
  ];
}

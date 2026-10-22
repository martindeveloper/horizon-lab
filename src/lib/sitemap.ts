import { pathForHole, presetRouteParams } from "@/features/black-hole/routing";
import {
  pathForView as pathForDeepView,
  viewRouteParams as deepViewRouteParams,
} from "@/features/deep-field/routing";
import { pathForRung, rungRouteParams } from "@/features/giants/routing";
import { pathForView, viewRouteParams } from "@/features/orrery/routing";
import {
  pathForView as pathForSpectroscopyView,
  viewRouteParams as spectroscopyRouteParams,
} from "@/features/spectroscopy/routing";
import {
  pathForView as pathForVoyageView,
  viewRouteParams as voyageRouteParams,
} from "@/features/voyage/routing";

import { simulations } from "./simulations";
import { PAGE_URLS } from "./urls";

type SimulationId = (typeof simulations)[number]["id"];

/** Prerendered subpages per simulation; a newly registered manifest fails typecheck until listed. */
const subpages: Record<SimulationId, () => string[]> = {
  "black-hole": () => presetRouteParams().map(({ hole }) => pathForHole(hole)),
  orrery: () => viewRouteParams().map(({ view }) => pathForView(view)),
  "deep-field": () => deepViewRouteParams().map(({ view }) => pathForDeepView(view)),
  spectroscopy: () => spectroscopyRouteParams().map(({ view }) => pathForSpectroscopyView(view)),
  giants: () => rungRouteParams().map(({ star }) => pathForRung(star)),
  voyage: () => voyageRouteParams().map(({ view }) => pathForVoyageView(view)),
};

/** Canonical clean paths: no language prefix and no redirect sources. */
export function sitePaths(): string[] {
  return [
    PAGE_URLS.home,
    PAGE_URLS.about,
    PAGE_URLS.credits,
    ...simulations.flatMap(({ id, href }) => [href, ...subpages[id]()]),
  ];
}

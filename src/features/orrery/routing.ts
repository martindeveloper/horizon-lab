import { slugRoutes } from "../../lib/simulation-paths";
import { DEFAULT_VIEW, VIEWS, type ViewId } from "./lib/model/views";
import { ORRERY_PATH } from "./manifest";

const ALIASES: Record<string, ViewId> = {
  "inner-worlds": "inner",
  planets: "giants",
  "kuiper-belt": "kuiper",
  "scattered-disk": "scattered",
  "oort-cloud": "oort",
  proxima: "stars",
  "nearest-star": "stars",
  "milky-way": "galaxy",
  milkyway: "galaxy",
  localgroup: "local-group",
  localsheet: "local-sheet",
  "local-volume": "local-sheet",
  virgo: "virgo-cluster",
  "local-supercluster": "virgo-supercluster",
  "great-attractor": "laniakea",
  cosmicweb: "cosmic-web",
  "sloan-great-wall": "cosmic-web",
  "shapley-supercluster": "cosmic-web",
};

const routes = slugRoutes({
  base: ORRERY_PATH,
  ids: VIEWS.map((v) => v.id),
  defaultId: DEFAULT_VIEW,
  aliases: ALIASES,
});

export const resolveView = routes.resolve;
export const pathForView: (id: ViewId) => string = routes.pathFor;
export const viewFromPath = routes.fromPath;

export function viewRouteParams() {
  return routes.slugs().map((view) => ({ view }));
}

/** Every view name and alias with its canonical path, for native redirects. */
export const legacyViewRedirects = routes.redirects;

import { slugRoutes } from "../../lib/simulation-paths";
import { SOLAR_VIEWS, type SolarViewId } from "../../space/solar-system/model/views";
import { DEFAULT_VIEW } from "./lib/model/views";
import { ORRERY_PATH } from "./manifest";

const ALIASES: Record<string, SolarViewId> = {
  "inner-worlds": "inner",
  planets: "giants",
  "kuiper-belt": "kuiper",
  "scattered-disk": "scattered",
  "oort-cloud": "oort",
};

const routes = slugRoutes({
  base: ORRERY_PATH,
  ids: SOLAR_VIEWS.map((v) => v.id),
  defaultId: DEFAULT_VIEW,
  aliases: ALIASES,
});

export const resolveView = routes.resolve;
export const pathForView: (id: SolarViewId) => string = routes.pathFor;
export const viewFromPath = routes.fromPath;

export function viewRouteParams() {
  return routes.slugs().map((view) => ({ view }));
}

/** Every view name and alias with its canonical path, for native redirects. */
export const legacyViewRedirects = routes.redirects;

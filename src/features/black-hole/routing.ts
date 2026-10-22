import { slugRoutes } from "../../lib/simulation-paths";
import type { PresetId } from "./lib/holes/routes";
import { blackHoleManifest } from "./manifest";

const routes = slugRoutes(blackHoleManifest.routes);

export const resolveHole = routes.resolve;
export const pathForHole: (id: PresetId) => string = routes.pathFor;
/** The preset a pathname (the current one in the browser) names; the default otherwise. */
export const presetIdFromPath = routes.fromPath;

export const presetRouteParams = routes.params;

/** Public compatibility map for old bookmarks and non-canonical names. */
export const legacyPresetRedirects = routes.redirects;

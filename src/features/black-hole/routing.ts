import { slugRoutes } from "../../lib/simulation-paths";
import { DEFAULT_PRESET_ID, HOLE_ALIASES, PRESET_IDS, type PresetId } from "./lib/holes/routes";
import { BLACK_HOLE_PATH } from "./manifest";

const routes = slugRoutes({
  base: BLACK_HOLE_PATH,
  ids: PRESET_IDS,
  defaultId: DEFAULT_PRESET_ID,
  aliases: HOLE_ALIASES,
});

export const resolveHole = routes.resolve;
export const pathForHole: (id: PresetId) => string = routes.pathFor;
/** The preset a pathname (the current one in the browser) names; the default otherwise. */
export const presetIdFromPath = routes.fromPath;

export function presetRouteParams() {
  return routes.slugs().map((hole) => ({ hole }));
}

/** Public compatibility map for old bookmarks and non-canonical names. */
export const legacyPresetRedirects = routes.redirects;

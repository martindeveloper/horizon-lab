import { slugRoutes } from "../../lib/simulation-paths";
import { PRESETS, DEFAULT_PRESET, HOLE_ALIASES, type Preset } from "./lib/holes";
import { BLACK_HOLE_PATH } from "./manifest";

const routes = slugRoutes({
  base: BLACK_HOLE_PATH,
  ids: PRESETS.map((preset) => preset.id),
  defaultId: DEFAULT_PRESET.id,
  aliases: HOLE_ALIASES,
});

export const resolveHole = routes.resolve;
export const pathForHole = routes.pathFor;

export function presetFromPath(pathname?: string): Preset {
  const id = routes.fromPath(pathname);
  return PRESETS.find((p) => p.id === id) ?? DEFAULT_PRESET;
}

export function presetRouteParams() {
  return routes.slugs().map((hole) => ({ hole }));
}

/** Public compatibility map for old bookmarks and non-canonical names. */
export const legacyPresetRedirects = routes.redirects;

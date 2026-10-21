import { slugRoutes } from "../../lib/simulation-paths";
import { DEFAULT_RUNG, RUNG_IDS, type RungId } from "./lib/model/rungs";
import { GIANTS_PATH } from "./manifest";

const routes = slugRoutes({ base: GIANTS_PATH, ids: RUNG_IDS, defaultId: DEFAULT_RUNG });

export const resolveRung = routes.resolve;
export const pathForRung: (id: RungId) => string = routes.pathFor;
export const rungFromPath = routes.fromPath;

export function rungRouteParams() {
  return routes.slugs().map((star) => ({ star }));
}

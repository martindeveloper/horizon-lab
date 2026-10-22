import { slugRoutes } from "../../lib/simulation-paths";
import type { RungId } from "./lib/model/rungs";
import { giantsManifest } from "./manifest";

const routes = slugRoutes(giantsManifest.routes);

export const resolveRung = routes.resolve;
export const pathForRung: (id: RungId) => string = routes.pathFor;
export const rungFromPath = routes.fromPath;

export const rungRouteParams = routes.params;

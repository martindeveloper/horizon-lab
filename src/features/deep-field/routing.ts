import { slugRoutes } from "../../lib/simulation-paths";
import type { ViewId } from "./lib/model/view-definitions";
import { deepFieldManifest } from "./manifest";

const routes = slugRoutes(deepFieldManifest.routes);

export const resolveView = routes.resolve;
export const pathForView: (id: ViewId) => string = routes.pathFor;
export const viewFromPath = routes.fromPath;

export const viewRouteParams = routes.params;

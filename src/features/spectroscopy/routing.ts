import { slugRoutes } from "../../lib/simulation-paths";
import type { ViewId } from "./lib/model/view-ids";
import { spectroscopyManifest } from "./manifest";

const routes = slugRoutes(spectroscopyManifest.routes);

export const resolveView = routes.resolve;
export const pathForView: (id: ViewId) => string = routes.pathFor;
export const viewFromPath = routes.fromPath;

export const viewRouteParams = routes.params;

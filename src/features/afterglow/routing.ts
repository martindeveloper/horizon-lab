import { slugRoutes } from "../../lib/simulation-paths";
import type { ChapterId } from "./lib/model/chapter-ids";
import { afterglowManifest } from "./manifest";

const routes = slugRoutes(afterglowManifest.routes);

export const resolveView = routes.resolve;
export const pathForView: (id: ChapterId) => string = routes.pathFor;
export const viewFromPath = routes.fromPath;

export const viewRouteParams = routes.params;

import { slugRoutes } from "../../lib/simulation-paths";
import type { SolarViewId } from "../../space/solar-system/model/views";
import { orreryManifest } from "./manifest";

const routes = slugRoutes(orreryManifest.routes);

export const resolveView = routes.resolve;
export const pathForView: (id: SolarViewId) => string = routes.pathFor;
export const viewFromPath = routes.fromPath;

export const viewRouteParams = routes.params;

/** Every view name and alias with its canonical path, for native redirects. */
export const legacyViewRedirects = routes.redirects;

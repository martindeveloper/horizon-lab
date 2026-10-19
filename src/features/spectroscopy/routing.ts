import { slugRoutes } from "../../lib/simulation-paths";
import { DEFAULT_VIEW, VIEW_IDS, type ViewId } from "./lib/model/view-ids";
import { SPECTROSCOPY_PATH } from "./manifest";

const routes = slugRoutes({
  base: SPECTROSCOPY_PATH,
  ids: VIEW_IDS,
  defaultId: DEFAULT_VIEW,
});

export const resolveView = routes.resolve;
export const pathForView: (id: ViewId) => string = routes.pathFor;
export const viewFromPath = routes.fromPath;

export function viewRouteParams() {
  return routes.slugs().map((view) => ({ view }));
}

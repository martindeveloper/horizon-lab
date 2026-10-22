import { defineSimulation } from "../../lib/simulation-manifest";
import { defineRoutes, experiencePath } from "../../lib/simulation-paths";
import { DEFAULT_VIEW, PLACES } from "./lib/model/view-ids";

export const VOYAGE_PATH = experiencePath("voyage");
export const voyageManifest = defineSimulation({
  id: "voyage",
  kind: "experience",
  feature: "voyage",
  routes: defineRoutes({
    base: VOYAGE_PATH,
    param: "view",
    defaultId: DEFAULT_VIEW,
    entries: PLACES,
  }),
  socialSubtitle: "At true scale, on two clocks",
  artworkLayers: [
    { id: "sky", depth: -1 },
    { id: "earth", depth: 0 },
    { id: "bodies", depth: -0.55 },
    { id: "flight", depth: -0.25 },
  ],
  messageKey: "voyage",
  highlights: ["scale", "clocks", "horizon"],
  entryPoints: [
    { id: "moon", view: "moon" },
    { id: "saturn", view: "saturn" },
    { id: "pluto", view: "pluto" },
  ],
});

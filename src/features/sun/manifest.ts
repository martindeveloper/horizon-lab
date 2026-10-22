import { defineSimulation } from "../../lib/simulation-manifest";
import { defineRoutes, simulationPath } from "../../lib/simulation-paths";
import { DEFAULT_VIEW, VIEW_DEFINITIONS } from "./lib/model/views";

export const SUN_PATH = simulationPath("sun");
export const sunManifest = defineSimulation({
  id: "sun",
  kind: "lab",
  feature: "sun",
  routes: defineRoutes({
    base: SUN_PATH,
    param: "view",
    defaultId: DEFAULT_VIEW,
    entries: VIEW_DEFINITIONS,
  }),
  socialSubtitle: "Cut it open, watch it in any light",
  artworkLayers: [
    { id: "sky", depth: -1 },
    { id: "corona", depth: -0.55 },
    { id: "sun", depth: 0 },
  ],
  messageKey: "sun",
  highlights: ["cut", "light", "field"],
  entryPoints: [
    { id: "surface", view: DEFAULT_VIEW },
    { id: "inside", view: "inside" },
    { id: "eruption", view: "eruption" },
  ],
});

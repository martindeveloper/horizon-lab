import { defineSimulation } from "../../lib/simulation-manifest";
import { defineRoutes, simulationPath } from "../../lib/simulation-paths";
import { DEFAULT_VIEW, VIEW_DEFINITIONS } from "./lib/model/view-definitions";

export const DEEP_FIELD_PATH = simulationPath("deep-field");
export const deepFieldManifest = defineSimulation({
  id: "deep-field",
  kind: "lab",
  routes: defineRoutes({
    base: DEEP_FIELD_PATH,
    param: "view",
    defaultId: DEFAULT_VIEW,
    entries: VIEW_DEFINITIONS,
  }),
  socialSubtitle: "As far out as we can see",
  artworkLayers: [
    { id: "dome", depth: 0 },
    { id: "stars", depth: -0.6 },
    { id: "sun", depth: 0 },
  ],
  messageKey: "deepField",
  highlights: ["depth", "lookback", "edge"],
  entryPoints: [
    { id: "galaxy", view: DEFAULT_VIEW },
    { id: "laniakea", view: "laniakea" },
    { id: "universe", view: "observable-universe" },
  ],
  solarSystem: true,
});

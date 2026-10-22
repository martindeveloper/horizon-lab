import { defineSimulation } from "../../lib/simulation-manifest";
import { defineRoutes, simulationPath } from "../../lib/simulation-paths";
import { DEFAULT_RUNG, RUNGS } from "./lib/model/rungs";

export const GIANTS_PATH = simulationPath("giants");
export const giantsManifest = defineSimulation({
  id: "giants",
  kind: "lab",
  feature: "giants",
  routes: defineRoutes({
    base: GIANTS_PATH,
    param: "star",
    defaultId: DEFAULT_RUNG,
    entries: RUNGS,
  }),
  socialSubtitle: "How big stars get",
  artworkLayers: [
    { id: "sky", depth: -1 },
    { id: "surface", depth: -0.7 },
    { id: "dwarfs", depth: -0.45 },
    { id: "giants", depth: -0.25 },
    { id: "supergiant", depth: 0 },
  ],
  messageKey: "giants",
  highlights: ["ladder", "physics", "uncertainty"],
  entryPoints: [
    { id: "sun", view: DEFAULT_RUNG },
    { id: "pulsar", view: "neutron-star" },
    { id: "betelgeuse", view: "betelgeuse" },
  ],
});

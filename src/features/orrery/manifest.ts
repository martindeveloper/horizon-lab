import { defineSimulation } from "../../lib/simulation-manifest";
import { defineRoutes, simulationPath } from "../../lib/simulation-paths";
import { SOLAR_VIEWS, type SolarViewId } from "../../space/solar-system/model/views";

const DEFAULT_VIEW = "giants" satisfies SolarViewId;

export const ORRERY_PATH = simulationPath("orrery");

export const orreryManifest = defineSimulation({
  id: "orrery",
  kind: "lab",
  routes: defineRoutes({
    base: ORRERY_PATH,
    param: "view",
    defaultId: DEFAULT_VIEW,
    entries: SOLAR_VIEWS,
    aliases: {
      "inner-worlds": "inner",
      planets: "giants",
      "kuiper-belt": "kuiper",
      "scattered-disk": "scattered",
      "oort-cloud": "oort",
    },
    legacy: { bases: ["/orrery"] },
  }),
  socialSubtitle: "In motion, from its birth to tonight",
  artworkLayers: [
    { id: "sky", depth: -1 },
    { id: "system", depth: 0 },
  ],
  messageKey: "orrery",
  highlights: ["live", "timeline", "oort"],
  entryPoints: [
    { id: "giants", view: DEFAULT_VIEW },
    { id: "inner", view: "inner" },
    { id: "oort", view: "oort" },
  ],
  solarSystem: true,
});

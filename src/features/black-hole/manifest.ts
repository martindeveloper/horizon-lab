import { defineSimulation } from "../../lib/simulation-manifest";
import { defineRoutes, simulationPath } from "../../lib/simulation-paths";
import { DEFAULT_PRESET_ID, HOLE_ROUTES } from "./lib/holes/routes";

export const BLACK_HOLE_PATH = simulationPath("black-hole");
export const blackHoleManifest = defineSimulation({
  id: "black-hole",
  kind: "lab",
  routes: defineRoutes({
    base: BLACK_HOLE_PATH,
    param: "hole",
    defaultId: DEFAULT_PRESET_ID,
    entries: HOLE_ROUTES,
    legacy: { bases: ["/black-hole"], rootAliases: true },
  }),
  socialSubtitle: "Relativistic observatory",
  artworkLayers: [
    { id: "sky", depth: -1 },
    { id: "halo", depth: -0.6 },
    { id: "disk", depth: -0.3 },
    { id: "front", depth: 0 },
  ],
  messageKey: "blackHole",
  highlights: ["lensing", "orbits", "guides"],
  entryPoints: [
    { id: "light", view: DEFAULT_PRESET_ID },
    { id: "home", view: "sgr-a" },
    { id: "giant", view: "m87" },
  ],
});

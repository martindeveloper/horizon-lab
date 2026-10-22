import { defineSimulation } from "../../lib/simulation-manifest";
import { defineRoutes, simulationPath } from "../../lib/simulation-paths";
import { DEFAULT_VIEW, VIEW_IDS } from "./lib/model/view-ids";

export const SPECTROSCOPY_PATH = simulationPath("spectroscopy");

export const spectroscopyManifest = defineSimulation({
  id: "spectroscopy",
  kind: "lab",
  routes: defineRoutes({
    base: SPECTROSCOPY_PATH,
    param: "view",
    defaultId: DEFAULT_VIEW,
    entries: VIEW_IDS.map((id) => ({ id })),
  }),
  socialSubtitle: "Fingerprints in starlight",
  artworkLayers: [
    { id: "sky", depth: -1 },
    { id: "pool", depth: -0.7 },
    { id: "star", depth: -0.4 },
    { id: "instrument", depth: 0 },
  ],
  messageKey: "spectroscopy",
  highlights: ["fingerprints", "kirchhoff", "sequence"],
  entryPoints: [
    { id: "sun", view: DEFAULT_VIEW },
    { id: "kirchhoff", view: "kirchhoff" },
    { id: "mystery", view: "mystery" },
  ],
});

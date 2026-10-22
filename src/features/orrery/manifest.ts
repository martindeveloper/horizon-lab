import type { SimulationManifest } from "@/lib/simulation-types";

import { simulationPath, slugPath } from "../../lib/simulation-paths";
import { SIMULATION_ASSETS } from "../../lib/urls";
import type { SolarViewId } from "../../space/solar-system/model/views";

const DEFAULT_VIEW = "giants" satisfies SolarViewId;

export const ORRERY_PATH = simulationPath("orrery");

export const orreryManifest = {
  id: "orrery",
  kind: "lab",
  href: ORRERY_PATH,
  artwork: SIMULATION_ASSETS.orrery.artwork,
  artworkLayers: [
    { id: "sky", depth: -1 },
    { id: "system", depth: 0 },
  ],
  messageKey: "orrery",
  highlights: ["live", "timeline", "oort"],
  entryPoints: [
    { id: "giants", href: ORRERY_PATH },
    { id: "inner", href: slugPath(ORRERY_PATH, DEFAULT_VIEW, "inner" satisfies SolarViewId) },
    { id: "oort", href: slugPath(ORRERY_PATH, DEFAULT_VIEW, "oort" satisfies SolarViewId) },
  ],
  solarSystem: { defaultView: DEFAULT_VIEW },
} as const satisfies SimulationManifest;

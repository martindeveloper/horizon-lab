import type { SimulationManifest } from "@/lib/simulation-types";

import { simulationPath, slugPath } from "../../lib/simulation-paths";
import { SIMULATION_ASSETS } from "../../lib/urls";
import { DEFAULT_RUNG, type RungId } from "./lib/model/rungs";

export const GIANTS_PATH = simulationPath("giants");
export const giantsManifest = {
  id: "giants",
  kind: "lab",
  feature: "giants",
  href: GIANTS_PATH,
  artwork: SIMULATION_ASSETS.giants.artwork,
  messageKey: "giants",
  highlights: ["ladder", "physics", "uncertainty"],
  entryPoints: [
    { id: "sun", href: GIANTS_PATH },
    { id: "pulsar", href: slugPath(GIANTS_PATH, DEFAULT_RUNG, "neutron-star" satisfies RungId) },
    { id: "betelgeuse", href: slugPath(GIANTS_PATH, DEFAULT_RUNG, "betelgeuse" satisfies RungId) },
  ],
} as const satisfies SimulationManifest;

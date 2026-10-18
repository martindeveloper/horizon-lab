import type { SimulationManifest } from "@/lib/simulation-types";

import { simulationPath } from "../../lib/simulation-paths";

export const ORRERY_PATH = simulationPath("orrery");

export const orreryManifest = {
  id: "orrery",
  href: ORRERY_PATH,
  artwork: "/simulations/orrery.svg",
  messageKey: "orrery",
  highlights: ["live", "timeline", "oort"],
  entryPoints: [
    { id: "giants", href: ORRERY_PATH },
    { id: "inner", href: `${ORRERY_PATH}/inner` },
    { id: "oort", href: `${ORRERY_PATH}/oort` },
  ],
} as const satisfies SimulationManifest;

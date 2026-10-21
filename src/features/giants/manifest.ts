import type { SimulationManifest } from "@/lib/simulation-types";

import { simulationPath } from "../../lib/simulation-paths";

export const GIANTS_PATH = simulationPath("giants");
export const giantsManifest = {
  id: "giants",
  kind: "lab",
  feature: "giants",
  href: GIANTS_PATH,
  artwork: "/simulations/giants.svg",
  messageKey: "giants",
  highlights: ["ladder", "physics", "uncertainty"],
  entryPoints: [
    { id: "sun", href: GIANTS_PATH },
    { id: "pulsar", href: `${GIANTS_PATH}/neutron-star` },
    { id: "betelgeuse", href: `${GIANTS_PATH}/betelgeuse` },
  ],
} as const satisfies SimulationManifest;

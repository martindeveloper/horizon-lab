import type { SimulationManifest } from "@/lib/simulation-types";

import { simulationPath } from "../../lib/simulation-paths";

export const SPECTROSCOPY_PATH = simulationPath("spectroscopy");

export const spectroscopyManifest = {
  id: "spectroscopy",
  href: SPECTROSCOPY_PATH,
  artwork: "/simulations/spectroscopy.svg",
  messageKey: "spectroscopy",
  highlights: ["fingerprints", "kirchhoff", "sequence"],
  entryPoints: [
    { id: "sun", href: SPECTROSCOPY_PATH },
    { id: "kirchhoff", href: `${SPECTROSCOPY_PATH}/kirchhoff` },
    { id: "mystery", href: `${SPECTROSCOPY_PATH}/mystery` },
  ],
} as const satisfies SimulationManifest;

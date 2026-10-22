import type { SimulationManifest } from "@/lib/simulation-types";

import { simulationPath, slugPath } from "../../lib/simulation-paths";
import { SIMULATION_ASSETS } from "../../lib/urls";
import { DEFAULT_VIEW, type ViewId } from "./lib/model/view-ids";

export const SPECTROSCOPY_PATH = simulationPath("spectroscopy");

export const spectroscopyManifest = {
  id: "spectroscopy",
  kind: "lab",
  href: SPECTROSCOPY_PATH,
  artwork: SIMULATION_ASSETS.spectroscopy.artwork,
  messageKey: "spectroscopy",
  highlights: ["fingerprints", "kirchhoff", "sequence"],
  entryPoints: [
    { id: "sun", href: SPECTROSCOPY_PATH },
    {
      id: "kirchhoff",
      href: slugPath(SPECTROSCOPY_PATH, DEFAULT_VIEW, "kirchhoff" satisfies ViewId),
    },
    { id: "mystery", href: slugPath(SPECTROSCOPY_PATH, DEFAULT_VIEW, "mystery" satisfies ViewId) },
  ],
} as const satisfies SimulationManifest;

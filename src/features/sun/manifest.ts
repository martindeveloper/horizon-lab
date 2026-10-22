import type { SimulationManifest } from "@/lib/simulation-types";

import { simulationPath, slugPath } from "../../lib/simulation-paths";
import { SIMULATION_ASSETS } from "../../lib/urls";
import { DEFAULT_VIEW, type ViewId } from "./lib/model/views";

export const SUN_PATH = simulationPath("sun");
export const sunManifest = {
  id: "sun",
  kind: "lab",
  feature: "sun",
  href: SUN_PATH,
  artwork: SIMULATION_ASSETS.sun.artwork,
  artworkLayers: [
    { id: "sky", depth: -1 },
    { id: "corona", depth: -0.55 },
    { id: "sun", depth: 0 },
  ],
  messageKey: "sun",
  highlights: ["cut", "light", "field"],
  entryPoints: [
    { id: "surface", href: SUN_PATH },
    { id: "inside", href: slugPath(SUN_PATH, DEFAULT_VIEW, "inside" satisfies ViewId) },
    { id: "eruption", href: slugPath(SUN_PATH, DEFAULT_VIEW, "eruption" satisfies ViewId) },
  ],
} as const satisfies SimulationManifest;

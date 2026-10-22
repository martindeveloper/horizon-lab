import type { SimulationManifest } from "@/lib/simulation-types";

import { simulationPath, slugPath } from "../../lib/simulation-paths";
import { SIMULATION_ASSETS } from "../../lib/urls";
import { DEFAULT_PRESET_ID, type PresetId } from "./lib/holes/routes";

export const BLACK_HOLE_PATH = simulationPath("black-hole");
export const blackHoleManifest = {
  id: "black-hole",
  kind: "lab",
  href: BLACK_HOLE_PATH,
  artwork: SIMULATION_ASSETS["black-hole"].artwork,
  artworkLayers: [
    { id: "sky", depth: -1 },
    { id: "halo", depth: -0.6 },
    { id: "disk", depth: -0.3 },
    { id: "front", depth: 0 },
  ],
  messageKey: "blackHole",
  highlights: ["lensing", "orbits", "guides"],
  entryPoints: [
    { id: "light", href: BLACK_HOLE_PATH },
    { id: "home", href: slugPath(BLACK_HOLE_PATH, DEFAULT_PRESET_ID, "sgr-a" satisfies PresetId) },
    { id: "giant", href: slugPath(BLACK_HOLE_PATH, DEFAULT_PRESET_ID, "m87" satisfies PresetId) },
  ],
} as const satisfies SimulationManifest;

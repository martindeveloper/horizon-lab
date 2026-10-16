import type { SimulationManifest } from "@/lib/simulation-types";

import { simulationPath } from "../../lib/simulation-paths";

export const BLACK_HOLE_PATH = simulationPath("black-hole");
export const blackHoleManifest = {
  id: "black-hole",
  href: BLACK_HOLE_PATH,
  artwork: "/simulations/black-hole.svg",
  messageKey: "blackHole",
  highlights: ["lensing", "orbits", "guides"],
  entryPoints: [
    { id: "light", href: BLACK_HOLE_PATH },
    { id: "home", href: `${BLACK_HOLE_PATH}/sgr-a` },
    { id: "giant", href: `${BLACK_HOLE_PATH}/m87` },
  ],
} as const satisfies SimulationManifest;

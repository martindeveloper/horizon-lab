import type { SimulationManifest } from "@/lib/simulation-types";

import { experiencePath } from "../../lib/simulation-paths";

export const VOYAGE_PATH = experiencePath("voyage");
export const voyageManifest = {
  id: "voyage",
  kind: "experience",
  feature: "voyage",
  href: VOYAGE_PATH,
  artwork: "/simulations/voyage.svg",
  messageKey: "voyage",
  highlights: ["scale", "clocks", "horizon"],
  entryPoints: [
    { id: "moon", href: `${VOYAGE_PATH}/moon` },
    { id: "saturn", href: `${VOYAGE_PATH}/saturn` },
    { id: "pluto", href: `${VOYAGE_PATH}/pluto` },
  ],
} as const satisfies SimulationManifest;

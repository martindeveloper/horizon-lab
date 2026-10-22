import type { SimulationManifest } from "@/lib/simulation-types";

import { experiencePath, slugPath } from "../../lib/simulation-paths";
import { SIMULATION_ASSETS } from "../../lib/urls";
import { DEFAULT_VIEW, type ViewId } from "./lib/model/view-ids";

export const VOYAGE_PATH = experiencePath("voyage");
export const voyageManifest = {
  id: "voyage",
  kind: "experience",
  feature: "voyage",
  href: VOYAGE_PATH,
  artwork: SIMULATION_ASSETS.voyage.artwork,
  artworkLayers: [
    { id: "sky", depth: -1 },
    { id: "earth", depth: 0 },
    { id: "bodies", depth: -0.55 },
    { id: "flight", depth: -0.25 },
  ],
  messageKey: "voyage",
  highlights: ["scale", "clocks", "horizon"],
  entryPoints: [
    { id: "moon", href: slugPath(VOYAGE_PATH, DEFAULT_VIEW, "moon" satisfies ViewId) },
    { id: "saturn", href: slugPath(VOYAGE_PATH, DEFAULT_VIEW, "saturn" satisfies ViewId) },
    { id: "pluto", href: slugPath(VOYAGE_PATH, DEFAULT_VIEW, "pluto" satisfies ViewId) },
  ],
} as const satisfies SimulationManifest;

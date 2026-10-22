import type { SimulationManifest } from "@/lib/simulation-types";

import { simulationPath, slugPath } from "../../lib/simulation-paths";
import { SIMULATION_ASSETS } from "../../lib/urls";
import type { ViewId } from "./lib/model/view-ids";

const DEFAULT_VIEW = "galaxy" satisfies ViewId;

export const DEEP_FIELD_PATH = simulationPath("deep-field");
export const deepFieldManifest = {
  id: "deep-field",
  kind: "lab",
  href: DEEP_FIELD_PATH,
  artwork: SIMULATION_ASSETS["deep-field"].artwork,
  artworkLayers: [
    { id: "dome", depth: 0 },
    { id: "stars", depth: -0.6 },
    { id: "sun", depth: 0 },
  ],
  messageKey: "deepField",
  highlights: ["depth", "lookback", "edge"],
  entryPoints: [
    { id: "galaxy", href: DEEP_FIELD_PATH },
    { id: "laniakea", href: slugPath(DEEP_FIELD_PATH, DEFAULT_VIEW, "laniakea" satisfies ViewId) },
    {
      id: "universe",
      href: slugPath(DEEP_FIELD_PATH, DEFAULT_VIEW, "observable-universe" satisfies ViewId),
    },
  ],
  solarSystem: { defaultView: DEFAULT_VIEW },
} as const satisfies SimulationManifest;

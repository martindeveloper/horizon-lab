import type { SimulationManifest } from "@/lib/simulation-types";

import { simulationPath } from "../../lib/simulation-paths";

export const DEEP_FIELD_PATH = simulationPath("deep-field");
export const deepFieldManifest = {
  id: "deep-field",
  kind: "lab",
  href: DEEP_FIELD_PATH,
  artwork: "/simulations/deep-field.svg",
  messageKey: "deepField",
  highlights: ["depth", "lookback", "edge"],
  entryPoints: [
    { id: "galaxy", href: DEEP_FIELD_PATH },
    { id: "laniakea", href: `${DEEP_FIELD_PATH}/laniakea` },
    { id: "universe", href: `${DEEP_FIELD_PATH}/observable-universe` },
  ],
} as const satisfies SimulationManifest;

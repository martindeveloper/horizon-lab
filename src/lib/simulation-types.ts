import type { FeatureId } from "@/config";

import type { SimulationPath } from "./simulation-paths";

/** Serializable catalogue contract. No runtime/renderer imports belong here. */
export type SimulationManifest = {
  id: string;
  /** The feature switch (`FEATURES` in `src/config.ts`) the simulation is behind, if any. */
  feature?: FeatureId;
  href: SimulationPath;
  artwork: string;
  messageKey: string;
  highlights: readonly string[];
  entryPoints: readonly { id: string; href: SimulationPath }[];
};

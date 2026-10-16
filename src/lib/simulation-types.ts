import type { SimulationPath } from "./simulation-paths";

/** Serializable catalogue contract. No runtime/renderer imports belong here. */
export type SimulationManifest = {
  id: string;
  href: SimulationPath;
  artwork: string;
  messageKey: string;
  highlights: readonly string[];
  entryPoints: readonly { id: string; href: SimulationPath }[];
};

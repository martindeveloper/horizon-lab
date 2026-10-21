import type { FeatureId } from "@/config";

import type { SimulationPath } from "./simulation-paths";

/** Serializable catalogue contract. No runtime/renderer imports belong here. */
export type SimulationManifest = {
  id: string;
  /**
   * A lab (the catalogue's primary shelf, under `/lab`) or an experience (its quieter second
   * shelf, under `/experience`): less to learn, more to sit back in.
   */
  kind: "lab" | "experience";
  /** The feature switch (`FEATURES` in `src/config.ts`) the simulation is behind, if any. */
  feature?: FeatureId;
  href: SimulationPath;
  artwork: string;
  messageKey: string;
  highlights: readonly string[];
  entryPoints: readonly { id: string; href: SimulationPath }[];
  /**
   * Set when the simulation shows the shared solar system's views (`src/space/solar-system`),
   * each at `href/<view>`: a visitor may cross to the same view in another that does, which
   * opens at the same camera pose (`src/lib/handoff.ts`). `defaultView` is its own default,
   * which lives at `href`.
   */
  solarSystem?: { defaultView: string };
};

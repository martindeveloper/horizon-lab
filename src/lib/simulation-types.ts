import type { FeatureId } from "@/config";

import type { RouteDefinition, SimulationPath } from "./simulation-paths";

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
  /** Addresses and exposed bodies; no store, measurements or scene imports. */
  routes: RouteDefinition;
  artwork: string;
  social: string;
  /** English subtitle for the generated share image. */
  socialSubtitle: string;
  /**
   * The artwork's parallax layers in paint order: each names a `<g class="layer" id="layer-<id>">`
   * of the SVG and how deep it sits when the tile tilts, from −1 (the far sky, which drifts most)
   * to 0 (at the frame). Without them the picture moves as one far layer.
   */
  artworkLayers?: readonly { id: string; depth: number }[];
  messageKey: string;
  highlights: readonly string[];
  entryPoints: readonly { id: string; href: SimulationPath }[];
  /**
   * Set when the simulation shows the shared solar system's views (`src/space/solar-system`),
   * a visitor may cross to the same view in another that does, which opens at the same
   * camera pose (`src/lib/handoff.ts`). The routes descriptor supplies its address.
   */
  solarSystem?: true;
};

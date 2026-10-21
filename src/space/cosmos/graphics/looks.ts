/**
 * The cosmic map's materials: one soft-point material per population, so each fades on its own
 * scale, warm glows for galaxies seen whole and clusters, pale lines for Laniakea's flows and
 * the lookback rings. Painted on the host's brush; disposed with its looks.
 */
import { AdditiveBlending, LineBasicMaterial } from "three";

import type { Brush } from "@/space/brush";

export type CosmosLooks = ReturnType<typeof createCosmosLooks>;

export function createCosmosLooks({ points, sprite, ghost }: Brush) {
  const populations = {
    dwarfs: points(1.6, 0.85, true),
    /* Far galaxies behind the nearby ones, so the dark between them still has depth. */
    field: points(1.3, 0.6, true),
    sheet: points(1.5, 0.7, true),
    near: points(1.5, 0.75, true),
    supercluster: points(1.4, 0.6, true),
    far: points(1.4, 0.7, true),
    laniakea: points(1.3, 0.55, true),
    /* The web beyond Laniakea: thousands of groups, each a faint point. */
    web: points(1.2, 0.5, true),
    /* The microwave background and the galaxies beyond the web, seen from outside. */
    cmb: points(1.5, 0.55, true),
    deep: points(1.4, 0.6, true),
  };
  const materials = {
    /* Galaxies seen whole: a warm, soft glow. */
    cosmosGalaxy: sprite("#f3e6cf", 0.95, true),
    cosmosCluster: sprite("#ffe7c2", 0.7, true),
    /* Laniakea's flow lines, pale like the halo. */
    cosmosFlow: new LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.32,
      depthWrite: false,
      toneMapped: false,
      blending: AdditiveBlending,
    }),
    /* Lookback rings on the observable universe: thin and quiet. */
    cosmosRing: new LineBasicMaterial({
      color: "#8ea4ba",
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
      toneMapped: false,
    }),
  };
  return {
    cosmos: populations,
    ...materials,
    ghost,
    dispose() {
      for (const material of Object.values(populations)) material.dispose();
      for (const material of Object.values(materials)) material.dispose();
    },
  };
}

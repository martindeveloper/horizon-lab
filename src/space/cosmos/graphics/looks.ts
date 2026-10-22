/**
 * The cosmic map's materials: one soft-point material per population, so each fades on its own
 * scale, warm glows for galaxies seen whole and clusters, pale lines for Laniakea's flows and
 * the lookback rings. Painted on the host's brush; disposed with its looks.
 */
import {
  AdditiveBlending,
  DataTexture,
  LinearFilter,
  LineBasicMaterial,
  PointsMaterial,
} from "three";

import type { Brush } from "@/space/brush";

export type CosmosLooks = ReturnType<typeof createCosmosLooks>;

export function createCosmosLooks({ points, sprite, ghost }: Brush) {
  // Hollow markers stay distinct from measured galaxy points. Their screen size
  // does not change with zoom: no symbolic size can be mistaken for a physical edge.
  const ring = markerTexture("ring");
  const diamond = markerTexture("diamond");
  const marker = (map: DataTexture, color: string, size: number, opacity: number) =>
    new PointsMaterial({
      map,
      color,
      size,
      sizeAttenuation: false,
      opacity,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    });
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
    observed: points(1.35, 0.62, true),
    classix: points(2.8, 0.9, true),
    /* The microwave background and the galaxies beyond the web, seen from outside. */
    cmb: points(1.5, 0.55, true),
    deep: points(1.4, 0.6, true),
  };
  const line = (colour: string, opacity: number) =>
    new LineBasicMaterial({
      color: colour,
      opacity,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    });
  const materials = {
    atlasBasin: line("#a5bfd3", 0.5),
    atlasVoid: line("#8ea4ba", 0.18),
    atlasRobust: line("#8ea4ba", 0.3),
    atlasCentre: marker(ring, "#a5bfd3", 6, 0.55),
    atlasVoidCentre: marker(ring, "#8ea4ba", 5, 0.4),
    atlasKnot: marker(diamond, "#d8c8ad", 5, 0.45),
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
      ring.dispose();
      diamond.dispose();
    },
  };
}

/** Antialiased hollow symbols, generated without a DOM canvas. */
function markerTexture(shape: "ring" | "diamond") {
  const size = 32;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const u = (2 * (x + 0.5)) / size - 1;
      const v = (2 * (y + 0.5)) / size - 1;
      const distance = shape === "ring" ? Math.hypot(u, v) : Math.abs(u) + Math.abs(v);
      const alpha = Math.max(0, Math.min(1, (0.2 - Math.abs(distance - 0.7)) * size));
      data.set([255, 255, 255, Math.round(255 * alpha)], (y * size + x) * 4);
    }
  const texture = new DataTexture(data, size, size);
  texture.magFilter = texture.minFilter = LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

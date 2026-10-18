/**
 * Deep Field's materials and textures, painted once at startup: soft points for stars and
 * galaxies, warm glows for things seen whole, pale lines for flows and rings. Everything here
 * is disposed with the engine.
 */
import { AdditiveBlending, LineBasicMaterial, MeshBasicMaterial } from "three";

import { glowSprite, pointsMaterial, softCircle, spriteMaterial } from "@horizon/toolkit/scene";

export type Looks = ReturnType<typeof createLooks>;

export function createLooks() {
  const glow = glowSprite();
  const softStar = softCircle();
  const points = (size: number, opacity: number, additive: boolean) =>
    pointsMaterial(softStar, size, opacity, additive);
  const materials = {
    /* The bright stars of our own sky, round the Sun's neighbourhood. */
    sky: points(2.2, 0.95, true),
    galaxyCore: spriteMaterial(glow, "#e7c48a", 0.62, true),
    galaxyHeart: spriteMaterial(glow, "#fff6e4", 0.75, true),
    galaxySun: spriteMaterial(glow, "#ffe2a8", 0.9, true),
    galaxySunBody: new MeshBasicMaterial({ color: "#ffe2a8" }),
    galaxyToday: points(1.7, 0.9, true),
    galaxyDust: points(2.6, 0.38, false),
    /* Beyond the Galaxy: one material per population, so each fades on its own scale. */
    cosmos: {
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
    },
    /* Galaxies seen whole: a warm, soft glow. */
    cosmosGalaxy: spriteMaterial(glow, "#f3e6cf", 0.95, true),
    cosmosCluster: spriteMaterial(glow, "#ffe7c2", 0.7, true),
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
    /* Our reach: the probes leaving the solar system, and the Sun's wind bubble they crossed. */
    probe: spriteMaterial(glow, "#dbe8f2", 0.95, true),
    heliopause: new MeshBasicMaterial({
      color: "#e2c99a",
      transparent: true,
      opacity: 0.035,
      depthWrite: false,
      toneMapped: false,
    }),
    /* Touch targets: raycast, never drawn. */
    ghost: new MeshBasicMaterial({ visible: false }),
    proxima: new MeshBasicMaterial({
      color: "#9ebccc",
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
    }),
    halo: new MeshBasicMaterial({
      color: "#9ebccc",
      wireframe: true,
      transparent: true,
      opacity: 0.08,
      depthWrite: false,
    }),
  };
  return {
    ...materials,
    /** A nearby star's body; disposed by the caller. */
    neighbour: (color: string) => new MeshBasicMaterial({ color, toneMapped: false }),
    /** Its halo; disposed by the caller. */
    neighbourGlow: (color: string) => spriteMaterial(glow, color, 0.9, true),
    dispose() {
      glow.dispose();
      softStar.dispose();
      for (const material of Object.values(materials)) {
        if ("dispose" in material) material.dispose();
        else for (const inner of Object.values(material)) inner.dispose();
      }
    },
  };
}

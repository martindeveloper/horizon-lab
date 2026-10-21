/**
 * The Galaxy map's and the nearest stars' materials: soft points for the disk and its dust, warm
 * glows for the core and the Sun, pale lines and wire for Proxima's ring and the halo. Painted
 * on the host's brush; disposed with its looks.
 */
import { MeshBasicMaterial } from "three";

import type { Brush } from "@/space/brush";

export type GalaxyLooks = ReturnType<typeof createGalaxyLooks>;

export function createGalaxyLooks({ points, sprite, ghost }: Brush) {
  const materials = {
    galaxyCore: sprite("#e7c48a", 0.62, true),
    galaxyHeart: sprite("#fff6e4", 0.75, true),
    galaxySun: sprite("#ffe2a8", 0.9, true),
    galaxySunBody: new MeshBasicMaterial({ color: "#ffe2a8" }),
    galaxyToday: points(1.7, 0.9, true),
    galaxyDust: points(2.6, 0.38, false),
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
    ghost,
    /** A nearby star's body; disposed by the caller. */
    neighbour: (color: string) => new MeshBasicMaterial({ color, toneMapped: false }),
    /** Its halo; disposed by the caller. */
    neighbourGlow: (color: string) => sprite(color, 0.9, true),
    dispose() {
      for (const material of Object.values(materials)) material.dispose();
    },
  };
}

/**
 * Our reach's materials: the probes' glow and the Sun's wind bubble they crossed. Painted on the
 * host's brush (`@/space/brush`); disposed with its looks.
 */
import { MeshBasicMaterial } from "three";

import type { Brush } from "@/space/brush";

export type ReachLooks = ReturnType<typeof createReachLooks>;

export function createReachLooks({ sprite, ghost }: Brush) {
  const materials = {
    probe: sprite("#dbe8f2", 0.95, true),
    heliopause: new MeshBasicMaterial({
      color: "#e2c99a",
      transparent: true,
      opacity: 0.035,
      depthWrite: false,
      toneMapped: false,
    }),
  };
  return {
    ...materials,
    ghost,
    dispose() {
      for (const material of Object.values(materials)) material.dispose();
    },
  };
}

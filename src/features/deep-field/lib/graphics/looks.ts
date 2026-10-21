/**
 * Deep Field's materials and textures, painted once at startup: the bright-star sky's points,
 * then the shared worlds' looks (the Galaxy and the nearest stars, the cosmic map, our reach) on
 * one brush. Everything here is disposed with the engine.
 */
import { createBrush } from "@/space/brush";
import { createCosmosLooks } from "@/space/cosmos/graphics/looks";
import { createGalaxyLooks } from "@/space/galaxy/graphics/looks";
import { createReachLooks } from "@/space/solar-system/graphics/reach-looks";

export type Looks = ReturnType<typeof createLooks>;

export function createLooks() {
  const brush = createBrush();
  /* The bright stars of our own sky, round the Sun's neighbourhood. */
  const sky = brush.points(2.2, 0.95, true);
  const galaxy = createGalaxyLooks(brush);
  const cosmos = createCosmosLooks(brush);
  const reach = createReachLooks(brush);
  return {
    sky,
    ...galaxy,
    ...cosmos,
    ...reach,
    dispose() {
      sky.dispose();
      galaxy.dispose();
      cosmos.dispose();
      reach.dispose();
      brush.dispose();
    },
  };
}

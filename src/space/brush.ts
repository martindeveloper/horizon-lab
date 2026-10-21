/**
 * What the space worlds' looks paint with, once per engine: one soft glow for sprites, one soft
 * point for clouds, and the invisible material every touch target shares. Each world's looks
 * (`galaxy/graphics/looks.ts`, `cosmos/graphics/looks.ts`, the reach's) draw on one brush, so a
 * host paints every texture once and disposes it with the engine.
 */
import { MeshBasicMaterial } from "three";

import { glowSprite, pointsMaterial, softCircle, spriteMaterial } from "@horizon/toolkit/scene";

export type Brush = ReturnType<typeof createBrush>;

export function createBrush() {
  const glow = glowSprite();
  const softStar = softCircle();
  /* Touch targets: raycast, never drawn. */
  const ghost = new MeshBasicMaterial({ visible: false });
  return {
    /** Soft points of `size` px; disposed by the caller. */
    points: (size: number, opacity: number, additive: boolean) =>
      pointsMaterial(softStar, size, opacity, additive),
    /** A soft glow in `color`; disposed by the caller. */
    sprite: (color: string, opacity: number, additive: boolean) =>
      spriteMaterial(glow, color, opacity, additive),
    ghost,
    dispose() {
      glow.dispose();
      softStar.dispose();
      ghost.dispose();
    },
  };
}

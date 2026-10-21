/**
 * The unit spheres every globe and star is drawn on, once per engine: coarse while a body is
 * small, finer as it fills the view, the quality's finest close up.
 */
import { SphereGeometry, type BufferGeometry, type Mesh } from "three";

import type { DisposalScope } from "@horizon/toolkit/rendering";
import { pickLevel } from "@horizon/toolkit/scene";

import type { GlobeDetail } from "../quality";

/** Globe levels by on-screen radius (CSS px): fine, close, then the quality's finest. */
const SPHERE_PX = [36, 360, 1400] as const;
/** Below this on-screen radius a body is not drawn (it would be a flickering sub-pixel). */
export const DRAW_PX = 0.3;
/** A body's name reads once it is this large on screen (eased over the span). */
export const NAME_PX = [1.5, 3] as const;
/** How far a star's glow reaches, in its radii. */
export const GLOW_RADII = 2.8;

export type Globes = ReturnType<typeof createGlobes>;

export function createGlobes(scope: DisposalScope, finest: GlobeDetail) {
  const levels: BufferGeometry[] = [
    new SphereGeometry(1, 24, 16),
    new SphereGeometry(1, 72, 48),
    new SphereGeometry(1, 128, 80),
    new SphereGeometry(1, finest.segments, finest.rings),
  ];
  scope.defer(() => {
    for (const level of levels) level.dispose();
  });
  return {
    /** The coarsest level: what a mesh starts on. */
    coarse: levels[0]!,
    /** Gives a mesh the level its on-screen radius (CSS px) needs. */
    fit(mesh: Mesh, rPx: number) {
      const current = Math.max(0, levels.indexOf(mesh.geometry));
      mesh.geometry = levels[pickLevel(current, rPx, SPHERE_PX)]!;
    },
    /** The quality's finest level changed: meshes on the old one move to the new. */
    setFinest(detail: GlobeDetail, meshes: Iterable<Mesh>) {
      const old = levels[3]!;
      const next = new SphereGeometry(1, detail.segments, detail.rings);
      for (const mesh of meshes) if (mesh.geometry === old) mesh.geometry = next;
      old.dispose();
      levels[3] = next;
    },
  };
}

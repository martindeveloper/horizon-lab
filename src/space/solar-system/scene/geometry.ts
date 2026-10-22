/** Orbit, grid and globe geometry shared by the solar system layers. */
import {
  BufferGeometry,
  Float32BufferAttribute,
  SphereGeometry,
  type Mesh,
  type Vector3,
} from "three";

import { orbitShape, orbitShapeOf, type Elements } from "@horizon/toolkit/bodies";
import type { DisposalScope } from "@horizon/toolkit/rendering";
import { ownedOrbitLine, pickLevel } from "@horizon/toolkit/scene";

import type { SolarKit } from "./kit";

export const SEG = 96;
/** Globe levels by on-screen radius (px): fine past the first, close-up past the second. */
const SPHERE_PX = [36, 360] as const;

/** An orbit line the GPU draws from the elements' ellipse: `update` each frame it is shown. */
export function orbitOf(scope: DisposalScope, color: number, opacity: number) {
  const orbit = ownedOrbitLine(scope, color, opacity, SEG);
  const shape = orbitShapeOf();
  return {
    ...orbit,
    update(el: Elements, elliptical: boolean) {
      orbit.set(orbitShape(el, elliptical, shape));
    },
  };
}

export function polarGrid() {
  const positions: number[] = [];
  for (let r = 1; r <= 4; r += 1) {
    const rad = r / 4;
    for (let i = 0; i < 72; i += 1) {
      const a0 = (i / 72) * Math.PI * 2;
      const a1 = ((i + 1) / 72) * Math.PI * 2;
      positions.push(
        Math.cos(a0) * rad,
        0,
        Math.sin(a0) * rad,
        Math.cos(a1) * rad,
        0,
        Math.sin(a1) * rad,
      );
    }
  }
  for (let s = 0; s < 4; s += 1) {
    const a = (s / 4) * Math.PI;
    positions.push(Math.cos(a), 0, Math.sin(a), -Math.cos(a), 0, -Math.sin(a));
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  return geometry;
}

export type Globes = ReturnType<typeof createGlobes>;

/* Globes: a coarse sphere while a body is a dot, a fine one when it fills the view. */
export function createGlobes({ scope, lod }: SolarKit) {
  const sphere = scope.own(new SphereGeometry(1, 24, 16));
  const small = scope.own(new SphereGeometry(1, 16, 14));
  const fine = scope.own(new SphereGeometry(1, 72, 48));
  const close = scope.own(new SphereGeometry(1, 128, 80));
  const hit = scope.own(new SphereGeometry(1, 10, 10));
  return {
    sphere,
    small,
    hit,
    /**
     * Gives `mesh` the coarse, fine or close-up sphere for its on-screen radius, with
     * hysteresis from the level it has, so a globe on a threshold does not flicker.
     */
    fit(mesh: Mesh, position: Vector3, radius: number, coarse: BufferGeometry = sphere) {
      const levels = [coarse, fine, close];
      const current = Math.max(0, levels.indexOf(mesh.geometry));
      mesh.geometry = levels[pickLevel(current, lod.px(radius, position), SPHERE_PX)]!;
    },
  };
}

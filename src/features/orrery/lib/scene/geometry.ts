/** Line, grid, cloud and globe geometry shared by the orrery layers. */
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Line,
  LineBasicMaterial,
  LineDashedMaterial,
  SphereGeometry,
  type Vector3,
} from "three";

import { createOrbitWriter, type Elements } from "@horizon/toolkit/bodies";
import { lcg } from "@horizon/toolkit/math";
import type { DisposalScope } from "@horizon/toolkit/rendering";

import { GOLD, type SceneKit } from "./kit";

export const SEG = 96;
/** Globe LOD: the fine sphere past this on-screen radius in pixels, the close-up sphere past the next. */
const FINE_SPHERE_PX = 36;
const CLOSE_SPHERE_PX = 360;

export type LineSlot = ReturnType<typeof lineOf>;

export function lineOf(color: number, opacity: number, segments = SEG) {
  const positions = new Float32Array((segments + 1) * 3);
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  const material = new LineBasicMaterial({ color, transparent: true, opacity });
  const line = new Line(geometry, material);
  line.frustumCulled = false;
  return { line, positions, geometry, material };
}

/** A line whose geometry and material the scope disposes. */
export function ownedLine(scope: DisposalScope, color: number, opacity: number, segments = SEG) {
  const slot = lineOf(color, opacity, segments);
  scope.own(slot.geometry);
  scope.own(slot.material);
  return slot;
}

export type OrbitSlot = ReturnType<typeof orbitOf>;

/** Reuse orbit buffers until the orbital shape or plane changes. */
export function orbitOf(scope: DisposalScope, color: number, opacity: number) {
  const slot = ownedLine(scope, color, opacity);
  const write = createOrbitWriter(slot.positions);
  return {
    ...slot,
    update(el: Elements, elliptical: boolean) {
      if (write(el, elliptical)) slot.geometry.getAttribute("position").needsUpdate = true;
    },
  };
}

/** A dashed gold ruler between two points; dash lengths are set per frame. */
export function rulerOf(scope: DisposalScope) {
  const positions = new Float32Array(6);
  const geometry = scope.own(new BufferGeometry());
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  const material = scope.own(
    new LineDashedMaterial({
      color: GOLD,
      transparent: true,
      opacity: 0.6,
      depthTest: false,
      dashSize: 1,
      gapSize: 1,
    }),
  );
  const line = new Line(geometry, material);
  line.frustumCulled = false;
  line.renderOrder = 6;
  line.visible = false;
  return { line, positions, geometry, material };
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

/**
 * A presolar molecular cloud: a few clumpy filaments of cold gas, seeded, drawn
 * at the camera's scale so the view is never empty before the Sun exists.
 */
export function molecularCloud(count: number) {
  const rnd = lcg(71);
  const gauss = () => {
    const u = Math.max(1e-6, rnd());
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(Math.PI * 2 * rnd());
  };
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const cold = new Color("#4f78c8");
  const dust = new Color("#8a6a4a");
  const warm = new Color("#c9a978");
  const tint = new Color();
  const filaments = 5;
  for (let i = 0; i < count; i += 1) {
    const f = Math.floor(rnd() * filaments);
    const phase = (f / filaments) * Math.PI * 2 + 0.7;
    const t = rnd() * 2 - 1;
    const r = 0.25 + Math.abs(t) * 0.75;
    const ang = phase + t * 1.6 + gauss() * 0.08;
    const x = r * Math.cos(ang) + gauss() * 0.06;
    const z = r * Math.sin(ang) + gauss() * 0.06;
    const y = gauss() * 0.18 * (0.4 + r);
    pos[i * 3] = x;
    pos[i * 3 + 1] = y;
    pos[i * 3 + 2] = z;
    const pick = rnd();
    tint.copy(pick < 0.12 ? dust : pick < 0.2 ? warm : cold);
    const fade = (0.25 + 0.75 * Math.exp(-r * 1.2)) * (0.35 + rnd() * 0.65);
    col[i * 3] = tint.r * fade;
    col[i * 3 + 1] = tint.g * fade;
    col[i * 3 + 2] = tint.b * fade;
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(pos, 3));
  geometry.setAttribute("color", new BufferAttribute(col, 3));
  return geometry;
}

export type Globes = ReturnType<typeof createGlobes>;

/* Globes: a coarse sphere while a body is a dot, a fine one when it fills the view. */
export function createGlobes({ scope, camera, pxWorld }: SceneKit) {
  const sphere = scope.own(new SphereGeometry(1, 24, 16));
  const small = scope.own(new SphereGeometry(1, 16, 14));
  const fine = scope.own(new SphereGeometry(1, 72, 48));
  const close = scope.own(new SphereGeometry(1, 128, 80));
  const hit = scope.own(new SphereGeometry(1, 10, 10));
  return {
    sphere,
    small,
    hit,
    /** Coarse, fine or close-up sphere by the globe's on-screen radius. */
    globeFor(position: Vector3, radius: number, coarse = sphere) {
      const px = radius / pxWorld(camera.position.distanceTo(position), 1);
      return px > CLOSE_SPHERE_PX ? close : px > FINE_SPHERE_PX ? fine : coarse;
    },
  };
}

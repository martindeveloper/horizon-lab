/** Reusable line buffers: a polyline written in place, and a dashed ruler between two points. */
import {
  BufferAttribute,
  BufferGeometry,
  Line,
  LineBasicMaterial,
  LineDashedMaterial,
  Material,
  type Object3D,
} from "three";

import { smootherstep } from "../math";
import type { DisposalScope } from "../rendering/disposal";

export type LineSlot = ReturnType<typeof lineOf>;

/** A polyline of `segments` segments; write `positions` and flag the attribute. */
export function lineOf(color: number, opacity: number, segments = 96) {
  const positions = new Float32Array((segments + 1) * 3);
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  const material = new LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
  const line = new Line(geometry, material);
  line.frustumCulled = false;
  return { line, positions, geometry, material };
}

/** A line whose geometry and material the scope disposes. */
export function ownedLine(scope: DisposalScope, color: number, opacity: number, segments = 96) {
  const slot = lineOf(color, opacity, segments);
  scope.own(slot.geometry);
  scope.own(slot.material);
  return slot;
}

/** A dashed ruler between two points, drawn over everything; dash lengths are set per frame. */
export function rulerOf(scope: DisposalScope, color: number) {
  const positions = new Float32Array(6);
  const geometry = scope.own(new BufferGeometry());
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  const material = scope.own(
    new LineDashedMaterial({
      color,
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

/** Seconds the veil takes to fall or lift. */
const VEIL_SECONDS = 0.8;

export type LineVeil = ReturnType<typeof createLineVeil>;

/**
 * A veil over a scene's line art (orbits, grids, rings, rulers, trails): while it is down, every
 * `Line` fades out together and the picture is left to the bodies and the sky. Lines that are
 * content, not annotation (a web's filaments), opt out with `userData.content = true`; any other
 * object that is annotation (a boundary drawn as a surface, such as a translucent shell) opts in
 * with `userData.annotation = true`. Call `step` each frame, then `cover` just before rendering
 * and `uncover` right after, so the layers' own visibility and opacity are never disturbed
 * between frames.
 */
export function createLineVeil(seconds = VEIL_SECONDS) {
  /** 1 with the lines fully shown, 0 with them gone. */
  let presence = 1;
  let target = 1;
  const hidden: Object3D[] = [];
  const dimmed = new Map<Material, { opacity: number; transparent: boolean }>();

  return {
    get presence() {
      return presence;
    },
    /** The veil is on its way down or up. */
    get busy() {
      return presence !== target;
    },
    /** Eases toward showing the lines or not. */
    step(dt: number, shown: boolean) {
      target = shown ? 1 : 0;
      if (presence === target) return;
      const rate = dt / Math.max(0.05, seconds);
      presence =
        target > presence ? Math.min(target, presence + rate) : Math.max(target, presence - rate);
    },
    /** Dims or hides every line, and every object marked annotation, under `root` for this render. */
    cover(root: Object3D) {
      if (presence >= 1) return;
      const k = smootherstep(presence);
      root.traverse((object) => {
        const annotation =
          object.userData.annotation === true ||
          (object instanceof Line && object.userData.content !== true);
        if (!annotation || !object.visible) return;
        if (k <= 0.002) {
          object.visible = false;
          hidden.push(object);
          return;
        }
        const material: unknown = "material" in object ? object.material : null;
        if (!(material instanceof Material) || dimmed.has(material)) return;
        dimmed.set(material, { opacity: material.opacity, transparent: material.transparent });
        material.transparent = true;
        material.opacity *= k;
      });
    },
    /** Gives every line back what `cover` took. */
    uncover() {
      for (const object of hidden) object.visible = true;
      hidden.length = 0;
      for (const [material, was] of dimmed) {
        material.opacity = was.opacity;
        material.transparent = was.transparent;
      }
      dimmed.clear();
    },
  };
}

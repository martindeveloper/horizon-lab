/** Reusable line buffers: a polyline written in place, and a dashed ruler between two points. */
import {
  BufferAttribute,
  BufferGeometry,
  Line,
  LineBasicMaterial,
  LineDashedMaterial,
} from "three";

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

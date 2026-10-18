/** Rulers: from the selected body (or the Sun) to every other body on screen. */
import type { Object3D } from "three";

import { NAMED, PLANET_IDS } from "@horizon/toolkit/bodies";
import { formatDistance, type DistanceChoice } from "@horizon/toolkit/science";

import { NEIGHBOURS } from "../model/neighbours";
import type { Selection } from "../store";
import { rulerOf } from "./geometry";
import type { Labels, SceneKit } from "./kit";
import type { PlaceLabel } from "./labels";

export type Anchor = { key: string; x: number; y: number; z: number; on: boolean };
type Point = readonly [number, number, number];

export type DistanceText = (au: number, fixed?: boolean) => string;

/**
 * Shared readout in the visitor's unit: "5.37 au · light-time 45 min" (cards match). Beyond
 * the Galaxy, millions and billions read as a word: "53.8 million ly".
 */
export function createDistanceText(labels: Labels, unit: () => DistanceChoice): DistanceText {
  return (au, fixed = false) => {
    const L = labels();
    return formatDistance(au, {
      unit: unit(),
      locale: document.documentElement.lang || "en",
      symbols: { au: L.au ?? "au", ly: L.lightYears ?? "ly", pc: L.parsecs ?? "pc" },
      lightTimeLabel: L.lightTime ?? "light-time",
      millionWord: L.million ?? "million",
      billionWord: L.billion ?? "billion",
      fixed,
    });
  };
}

export type Rulers = ReturnType<typeof createRulers>;

export function createRulers(
  { scope, pxWorld }: SceneKit,
  parent: Object3D,
  place: PlaceLabel,
  distanceText: DistanceText,
) {
  const keys = ["sun", ...PLANET_IDS, ...NAMED.map((b) => b.id), ...NEIGHBOURS.map((n) => n.id)];
  const anchors: Anchor[] = keys.map((key) => ({ key, x: 0, y: 0, z: 0, on: false }));
  const byKey = new Map(anchors.map((anchor) => [anchor.key, anchor]));
  const rulers = anchors.map(() => {
    const slot = rulerOf(scope);
    parent.add(slot.line);
    return slot;
  });
  let drawn = 0;

  const draw = (
    ax: number,
    ay: number,
    az: number,
    bx: number,
    by: number,
    bz: number,
    text: string,
    minLength: number,
    dash: number,
  ) => {
    const slot = rulers[drawn];
    if (!slot) return;
    const length = Math.hypot(bx - ax, by - ay, bz - az);
    if (length < minLength) return;
    drawn += 1;
    slot.positions.set([ax, ay, az, bx, by, bz]);
    slot.geometry.getAttribute("position").needsUpdate = true;
    slot.line.computeLineDistances();
    slot.material.dashSize = dash;
    slot.material.gapSize = dash * 0.7;
    slot.line.visible = true;
    place(`ruler${drawn - 1}`, (ax + bx) / 2, (ay + by) / 2, (az + bz) / 2, true, {
      text,
      kind: "distance",
    });
  };

  return {
    /** Where a body is this frame, and whether a ruler may end there. */
    anchor(key: string) {
      return byKey.get(key)!;
    },
    draw,
    /** Rulers from the selection (or the Sun) to every anchor that is on. */
    drawFrom(sel: Selection | null, focus: Point | null, dist: number) {
      const origin = anchors[0]!;
      origin.on = true;
      let from: Anchor | Point = origin;
      if (sel?.kind === "planet" || sel?.kind === "named" || sel?.kind === "star")
        from = byKey.get(sel.id)!;
      else if (sel?.kind === "tracer" && focus) from = focus;
      const fx = "key" in from ? from.x : from[0];
      const fy = "key" in from ? from.y : from[1];
      const fz = "key" in from ? from.z : from[2];
      const minLength = pxWorld(dist, 44);
      const dash = pxWorld(dist, 5);
      for (const a of anchors) {
        if (!a.on || a === from) continue;
        const length = Math.hypot(a.x - fx, a.y - fy, a.z - fz);
        draw(fx, fy, fz, a.x, a.y, a.z, distanceText(length, true), minLength, dash);
      }
    },
    /** Hides the rulers not drawn this frame. */
    finish() {
      for (let i = drawn; i < rulers.length; i += 1) {
        rulers[i]!.line.visible = false;
        place(`ruler${i}`, 0, 0, 0, false, { text: "", kind: "distance" });
      }
      drawn = 0;
    },
  };
}

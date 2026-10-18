/** Rulers: dashed lines between scene points, each with its length as a label at the middle. */
import type { Object3D } from "three";

import type { DisposalScope } from "../rendering/disposal";
import {
  convertDistance,
  formatDistance,
  type DistanceChoice,
  type DistanceUnit,
} from "../science";
import type { LabelText } from "./kit";
import type { PlaceLabel } from "./labels";
import { rulerOf } from "./lines";

export type DistanceText = (au: number, fixed?: boolean) => string;

/** The label keys `createDistanceText` words its readouts with. */
export const DISTANCE_WORDS = [
  "au",
  "lightYears",
  "parsecs",
  "lightTime",
  "million",
  "billion",
] as const;

/**
 * A distance in the visitor's unit and language: "5.37 au · light-time 45 min". Millions and
 * billions read as a word: "53.8 million ly". Words come from the label keys `DISTANCE_WORDS`.
 */
export function createDistanceText(
  labels: LabelText,
  unit: () => DistanceChoice,
  locale: () => string,
): DistanceText {
  return (au, fixed = false) => {
    const L = labels();
    return formatDistance(au, {
      unit: unit(),
      locale: locale(),
      symbols: { au: L.au ?? "au", ly: L.lightYears ?? "ly", pc: L.parsecs ?? "pc" },
      lightTimeLabel: L.lightTime ?? "light-time",
      millionWord: L.million ?? "million",
      billionWord: L.billion ?? "billion",
      fixed,
    });
  };
}

/**
 * Up to `count` rulers under `parent`, labelled `${prefix}0`, `${prefix}1`, …. Each frame,
 * `draw` the ones wanted, then `finish` hides the rest.
 */
function createRulerSet(
  scope: DisposalScope,
  parent: Object3D,
  place: PlaceLabel,
  { count, color, prefix }: { count: number; color: number; prefix: string },
) {
  const rulers = Array.from({ length: count }, () => {
    const slot = rulerOf(scope, color);
    parent.add(slot.line);
    return slot;
  });
  let drawn = 0;

  return {
    /** A ruler from a to b, unless shorter than `minLength`; `dash` is the dash length. */
    draw: (
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
      place(`${prefix}${drawn - 1}`, (ax + bx) / 2, (ay + by) / 2, (az + bz) / 2, true, {
        text,
        kind: "distance",
      });
    },
    /** Hides the rulers not drawn this frame. */
    finish: () => {
      for (let i = drawn; i < rulers.length; i += 1) {
        rulers[i]!.line.visible = false;
        place(`${prefix}${i}`, 0, 0, 0, false, { text: "", kind: "distance" });
      }
      drawn = 0;
    },
  };
}

/** A scene point a ruler may end at, written by its layer each frame. */
export type Anchor = { key: string; x: number; y: number; z: number; on: boolean };
type Point = readonly [number, number, number];

export type AnchoredRulers = ReturnType<typeof createAnchoredRulers>;

/**
 * Rulers among named points. Layers write each anchor's position and whether it is on screen
 * (`anchor(key)`); `drawFrom` then runs a ruler from one anchor (or any point) to every other
 * that is on. The first key is home: it is always on, and rulers start there by default.
 * Lengths are in `world` units (au by default); their labels are keyed `${prefix}0`, … (by
 * default `ruler0`, …), so two sets can share one label layer.
 */
export function createAnchoredRulers(
  scope: DisposalScope,
  parent: Object3D,
  place: PlaceLabel,
  options: {
    keys: readonly string[];
    color: number;
    /** World size of `px` CSS pixels at distance `dist` from the camera. */
    pxWorld: (dist: number, px: number) => number;
    distanceText: DistanceText;
    world?: DistanceUnit;
    prefix?: string;
  },
) {
  const { pxWorld, distanceText, world = "au", prefix = "ruler" } = options;
  const anchors: Anchor[] = options.keys.map((key) => ({ key, x: 0, y: 0, z: 0, on: false }));
  const byKey = new Map(anchors.map((anchor) => [anchor.key, anchor]));
  const { draw, finish } = createRulerSet(scope, parent, place, {
    count: anchors.length,
    color: options.color,
    prefix,
  });

  return {
    /** Where a point is this frame, and whether a ruler may end there. */
    anchor(key: string) {
      const anchor = byKey.get(key);
      if (!anchor) throw new Error(`Unknown ruler anchor "${key}"`);
      return anchor;
    },
    draw,
    /** Rulers from an anchor (by key), a point, or home (null) to every anchor that is on. */
    drawFrom(from: string | Point | null, dist: number) {
      const home = anchors[0]!;
      home.on = true;
      const start = typeof from === "string" ? (byKey.get(from) ?? home) : from;
      const at = start ?? home;
      const fx = "key" in at ? at.x : at[0];
      const fy = "key" in at ? at.y : at[1];
      const fz = "key" in at ? at.z : at[2];
      const minLength = pxWorld(dist, 44);
      const dash = pxWorld(dist, 5);
      for (const a of anchors) {
        if (!a.on || a === at) continue;
        const length = Math.hypot(a.x - fx, a.y - fy, a.z - fz);
        draw(
          fx,
          fy,
          fz,
          a.x,
          a.y,
          a.z,
          distanceText(convertDistance(length, world, "au"), true),
          minLength,
          dash,
        );
      }
    },
    /** Hides the rulers not drawn this frame. */
    finish,
  };
}

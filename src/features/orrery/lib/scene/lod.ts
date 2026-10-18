/**
 * Level of detail for every orrery layer, in one place:
 *
 * - size: how many CSS pixels a world length covers at a distance (`pxWorld`, `px`);
 * - presence: soft log-distance bands (`fade`) and one framing rule (`framed`) instead of
 *   hard thresholds, so nothing pops while the zoom glides;
 * - switches: faders that ease a layer in and out over time when a toggle or an era flips;
 * - levels: discrete choices (globe meshes) with hysteresis (`pickLevel`);
 * - need: each frame, layers report how large each body is now and where the zoom is
 *   heading (`see`), and the map budget loads and releases surfaces from that;
 * - realms: the solar map, the Galaxy and the cosmic map beyond it are one world in au and
 *   blend over two bands.
 *
 * The Galaxy model stays in light-years; its group is turned by `GALAXY_FRAME` (the galactic
 * frame of the sky's J2000 pole and centre) and scaled by one light-year, with the Sun at the
 * origin. The sky's Milky Way band and the Galaxy's disk then line up as the camera pulls out.
 * The cosmic map is in millions of light-years in the same axes, around the galactic centre.
 */
import { Matrix4, Quaternion, Vector3, type PerspectiveCamera } from "three";

import type { BodyId, Elements } from "@horizon/toolkit/bodies";
import { clamp01, smootherstep } from "@horizon/toolkit/math";
import { LIGHT_YEAR_AU } from "@horizon/toolkit/science";

import { GALACTIC_CENTRE, GALACTIC_EAST, GALACTIC_POLE } from "../graphics/coordinates";
import { SUPERGALACTIC } from "../model/cosmos";
import { sunGalactic } from "../model/galactic-orbit";
import { SUN_BIRTH } from "../model/parameters";
import type { Realm } from "../model/views";

export const LY = LIGHT_YEAR_AU;

/** The handoff from the solar map to the Galaxy, au: past the nearest stars, into the local disk. */
export const HANDOFF = { from: 7 * LY, to: 950 * LY } as const;
/** The handoff from the Galaxy to the cosmic map, au: past the halo, the Galaxy becomes one of many. */
export const COSMIC_HANDOFF = { from: 350_000 * LY, to: 3_000_000 * LY } as const;
/** One million light-years in au: the cosmic map's unit. */
export const MLY = 1e6 * LY;

/** The Galaxy's own render pass (drawn first, with a depth range of its own). */
export const GALAXY_LAYER = 2;

/**
 * Galaxy-model axes → scene: +X points from the centre to the Sun, +Y is the north galactic
 * pole, +Z the direction of rotation (galactic longitude 90°). Constant: the sky turns with
 * the Sun's orbit exactly as the view from the Galaxy model does.
 */
export const GALAXY_FRAME = new Quaternion().setFromRotationMatrix(
  new Matrix4().makeBasis(GALACTIC_CENTRE.clone().negate(), GALACTIC_POLE, GALACTIC_EAST),
);

/**
 * Supergalactic axes → scene, as `GALAXY_FRAME` does for galactic ones: +Y the supergalactic
 * pole, +X toward SGL = 0. The nearby galaxies lie flat in this plane, so far out the camera
 * orbits in it.
 */
export const SUPERGALACTIC_FRAME = (() => {
  const { x, y, z } = SUPERGALACTIC;
  const basis = new Quaternion().setFromRotationMatrix(
    new Matrix4().makeBasis(new Vector3(...x), new Vector3(...z), new Vector3(-y[0], -y[1], -y[2])),
  );
  return GALAXY_FRAME.clone().multiply(basis);
})();

/** Where the solar map sits in the Galaxy model (ly): the Sun, or its birthplace before it. */
export function galacticAnchor(
  yearsAgo: number,
  wobble: boolean,
  out: [number, number, number] = [0, 0, 0],
) {
  return sunGalactic(Math.min(yearsAgo, SUN_BIRTH), wobble, out)!;
}

/** A Galaxy-model point (ly) in the scene (au), with `anchor` at the origin. */
export function galaxyToWorld(
  x: number,
  y: number,
  z: number,
  anchor: readonly [number, number, number],
  out: Vector3,
) {
  return out
    .set(x - anchor[0], y - anchor[1], z - anchor[2])
    .applyQuaternion(GALAXY_FRAME)
    .multiplyScalar(LY);
}

const logFraction = (x: number, from: number, to: number) =>
  clamp01(Math.log(x / from) / Math.log(to / from));

/** A cosmic-map point (Mly from the galactic centre) in the scene (au), with `anchor` at the origin. */
export function cosmicToWorld(
  v: readonly [number, number, number],
  anchor: readonly [number, number, number],
  out: Vector3,
) {
  return galaxyToWorld(v[0] * 1e6, v[1] * 1e6, v[2] * 1e6, anchor, out);
}

/** 0 on the solar map, 1 in the Galaxy (and beyond), for a camera distance in au. */
export function galaxyMix(dist: number) {
  return smootherstep(logFraction(dist, HANDOFF.from, HANDOFF.to));
}

/** 0 up to the Galaxy, 1 on the cosmic map, for a camera distance in au. */
export function cosmosMix(dist: number) {
  return smootherstep(logFraction(dist, COSMIC_HANDOFF.from, COSMIC_HANDOFF.to));
}

/** The map that dominates at a blend: what readouts, drift and cards follow. */
export const realmOf = (galaxy: number, cosmos = 0): Realm =>
  cosmos >= 0.5 ? "cosmos" : galaxy >= 0.5 ? "galaxy" : "solar";

const ease = (t: number) => t * t * (3 - 2 * t);
/** 0 below `from`, 1 above `to`, eased in log space. */
export const rising = (x: number, from: number, to: number) =>
  x <= from ? 0 : x >= to ? 1 : ease(logFraction(x, from, to));

/**
 * A presence band over camera distance (au): eases in from `inFrom` to `inTo`, out from
 * `outFrom` to `outTo`, in log space. Omit a side (0 / Infinity) to leave it open.
 */
export function fade(inFrom: number, inTo: number, outFrom = Infinity, outTo = Infinity) {
  return (d: number) =>
    (inTo > 0 ? rising(d, inFrom, inTo) : 1) *
    (Number.isFinite(outFrom) ? 1 - rising(d, outFrom, outTo) : 1);
}

/**
 * The framing rule every marker, label and orbit shares, as fractions of the camera
 * distance `d`: something reaching `far` from the aim reads once it spans a few per cent of
 * the view, and gives way as its near side `near` leaves the frame or as it wraps the camera.
 */
export function framed(near: number, far: number, d: number) {
  return (
    rising(far / d, 0.025, 0.045) * (1 - rising(near / d, 0.8, 1.1)) * (1 - rising(far / d, 2.2, 3))
  );
}

/** How much of an orbit to draw at camera distance `d`: the framing rule from peri- to apoapsis. */
export function orbitShown(el: Elements, elliptical: boolean, d: number) {
  const e = elliptical ? Math.min(0.995, el.e) : 0;
  return framed(el.a * (1 - e), el.a * (1 + e), d);
}

/** Steps a level up past each threshold and back down only below `1 − gap` of it. */
export function pickLevel(current: number, value: number, up: readonly number[], gap = 0.18) {
  let level = current;
  while (level < up.length && value > up[level]!) level += 1;
  while (level > 0 && value < up[level - 1]! * (1 - gap)) level -= 1;
  return level;
}

/** A switch that eases between off (0) and on (1) over `seconds`, smooth at both ends. */
export type Fader = { readonly value: number; to: (on: boolean) => number };

export type Lod = ReturnType<typeof createLod>;

/** One per engine: call `begin` each frame once the camera is placed. */
export function createLod(camera: PerspectiveCamera, viewport: { height: number }) {
  const tan = 2 * Math.tan((camera.fov * Math.PI) / 360);
  const need = new Map<BodyId, number>();
  /** Faders still moving this frame. */
  let unsettled = 0;
  let dt = 0;
  const pxWorld = (distance: number, px: number) =>
    ((tan * distance) / Math.max(480, viewport.height)) * px;

  const lod = {
    /** Camera distance from its aim, au. */
    dist: 1,
    /** How much larger things near the aim will be once the zoom arrives (≥ 1). */
    lead: 1,
    /** 0 on the solar map … 1 in the Galaxy and beyond. */
    galaxy: 0,
    solar: 1,
    /** 0 up to the Galaxy … 1 on the cosmic map. */
    cosmos: 0,
    realm: "solar" as Realm,
    /** World size of `px` CSS pixels at `distance` from the camera. */
    pxWorld,
    /** On-screen radius in CSS pixels of a sphere of world radius `r` centred at `at`. */
    px(r: number, at: Vector3) {
      return r / pxWorld(Math.max(1e-12, camera.position.distanceTo(at)), 1);
    },
    /** A body is `px` across now; the map budget loads for the larger of now and arrival. */
    see(id: BodyId, px: number) {
      const ahead = px * lod.lead;
      if (ahead > (need.get(id) ?? 0)) need.set(id, ahead);
    },
    /** The largest size each body was reported at this frame, toward the zoom's destination. */
    get need(): ReadonlyMap<BodyId, number> {
      return need;
    },
    /** A fader moved this frame and has further to go: keep frames coming. */
    get busy() {
      return unsettled > 0;
    },
    /** A fader's first call shows the switch as it is; only later changes ease. */
    fader(seconds = 0.45): Fader {
      let t = 0;
      let value = 0;
      let fresh = true;
      return {
        get value() {
          return value;
        },
        to(next: boolean) {
          const goal = next ? 1 : 0;
          if (fresh) {
            fresh = false;
            t = value = goal;
          }
          if (t !== goal) {
            t = goal > t ? Math.min(1, t + dt / seconds) : Math.max(0, t - dt / seconds);
            value = ease(t);
            if (t !== goal) unsettled += 1;
          }
          return value;
        },
      };
    },
    /** A new frame: camera distance and where the zoom is heading, both au. */
    begin(frameDt: number, dist: number, target: number) {
      dt = frameDt;
      unsettled = 0;
      need.clear();
      lod.dist = dist;
      lod.lead = Math.min(64, Math.max(1, dist / Math.max(1e-12, target)));
      lod.galaxy = galaxyMix(dist);
      lod.solar = 1 - lod.galaxy;
      lod.cosmos = cosmosMix(dist);
      lod.realm = realmOf(lod.galaxy, lod.cosmos);
    },
  };
  return lod;
}

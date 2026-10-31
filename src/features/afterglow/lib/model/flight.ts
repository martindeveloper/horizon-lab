/**
 * Where the camera stands over a world, and a flight from one world to the next. Places are in
 * au: x along the line from the Sun (outward), y the orbit's north, z across them (x × y), so a
 * camera on the +z side sees the world to the right of the Sun. The view faces the Sun from
 * every place, so the Sun keeps its place in the frame and only the worlds move in it.
 *
 * A flight is a ship's: it backs off the world it leaves, which rounds into a globe and shrinks
 * towards a point beside the Sun until it is smaller than a pixel; it crosses with the Sun and
 * the stars alone; and it closes on the next world, a point on the Sun's other side that grows
 * into a globe and settles under the camera as the limb at rest. It moves as one dolly: easing
 * out of the orbit, then backing off and closing in at one steady pace in the logarithm of the
 * distance, easing only into the orbit at the end, so it never slows or turns sharply between.
 */
import { clamp01, lerp, smootherstep } from "@horizon/toolkit/math";

import { FLIGHT_TEMPO, ORBIT_RADII } from "./parameters";

/** A world as a flight sees it: its distance from the Sun and its radius, au. */
export type FlightEnd = { distance: number; radius: number };
/** A place in the Sun's frame, au. */
export type FlightPlace = { x: number; y: number; z: number };
/**
 * A place in the view, seen from the Sun: `apart` radians from it, `roll` radians round from
 * straight below it (positive to the right).
 */
export type SeenPlace = { apart: number; roll: number };
/**
 * The view a flight keeps: the Sun's height over the limb at rest (radians), the distance in a
 * world's radii at which its globe is too small to see, and where the world left shrinks away
 * and where the next one first shows.
 */
export type FlightView = { lift: number; far: number; leave: SeenPlace; arrive: SeenPlace };

/**
 * The share of the flight's way (`along`) eased into and out of: the camera gathers speed over
 * this first share of the flight's time, holds it, and comes to rest over the last.
 */
const EASE = 0.25;
/**
 * The way to where the world left is gone (`VANISH_PX`) and, from the end, back to where the
 * next one shows; between, the camera crosses from the one's line to the other's, begun and
 * ended where the world in view is a pixel across, so the crossing turns nothing that is seen.
 */
const GONE_AT = 0.42;
const CROSSING = { from: GONE_AT, until: 1 - GONE_AT } as const;
/** The globes change halfway across, the world left and the next both under a pixel. */
export const FLIGHT_SWAP = 0.5;

/**
 * The camera `d` from a world whose globe's nearest point is `top` radians from the Sun,
 * `roll` round from below it. The world's centre stands `top` plus its angular radius from the
 * Sun, which fixes the camera's bearing from the world's centre in the plane through the line
 * from the Sun turned `roll` from north. At an orbit's height (`ORBIT_RADII`), with the Sun's
 * height over the limb for `top` and no roll, this is the resting orbit.
 */
export function standingPlace(end: FlightEnd, d: number, top: number, roll = 0): FlightPlace {
  /* The angle the camera sees between the Sun and the world's centre, then the angle at the Sun (sine rule). */
  const seen = Math.asin(Math.min(1, end.radius / d)) + top;
  const atSun = Math.asin(Math.min(1, (d * Math.sin(seen)) / end.distance));
  const bearing = seen + atSun;
  const off = d * Math.sin(bearing);
  return {
    x: end.distance + d * Math.cos(bearing),
    y: off * Math.cos(roll),
    z: off * Math.sin(roll),
  };
}

/** A smooth step of `x` from `from` to `until`: zero speed and acceleration at both ends, so windows that overlap join without a jolt. */
const span = (x: number, from: number, until: number) => smootherstep((x - from) / (until - from));

/**
 * The flight's way at progress `t`, 0–1: its speed rises from rest as a smooth step over the
 * first `EASE` of the time, holds, and falls back to rest over the last, so the camera starts
 * and stops only at the ends. The rise is the smooth step's integral, `x³ − x⁴/2`.
 */
function along(t: number) {
  const run = (u: number) =>
    u < EASE ? EASE * ((u / EASE) ** 3 - (u / EASE) ** 4 / 2) : u - EASE / 2;
  const u = clamp01(t);
  const whole = 1 - EASE;
  return u <= 0.5 ? run(u) / whole : 1 - run(1 - u) / whole;
}

/**
 * Off a world or onto it, `out` its far place's share of the way (past 1 on beyond it). The
 * distance moves evenly in its logarithm, so the globe shrinks or grows by a steady factor; its
 * nearest point slides from the limb's place to `place` slowly while the globe is large and
 * still moving as it reaches it (`f²(2 − f)`), so it never settles before it is gone.
 */
function backedOff(end: FlightEnd, out: number, lift: number, far: number, place: SeenPlace) {
  const radii = ORBIT_RADII * (far / ORBIT_RADII) ** out;
  const f = Math.min(1, out);
  const slid = f * f * (2 - f);
  return standingPlace(end, end.radius * radii, lerp(lift, place.apart, slid), place.roll * slid);
}

/** Where the camera is at a flight's progress `t` (0–1). */
export function flightPlace(
  t: number,
  from: FlightEnd,
  to: FlightEnd,
  view: FlightView,
): FlightPlace {
  const way = along(t);
  const across = span(way, CROSSING.from, CROSSING.until);
  /* Off the crossing only one line holds the camera: the other has run far past its world. */
  const leaving = () => backedOff(from, way / GONE_AT, view.lift, view.far, view.leave);
  const arriving = () => backedOff(to, (1 - way) / GONE_AT, view.lift, view.far, view.arrive);
  if (across === 0) return leaving();
  if (across === 1) return arriving();
  const a = leaving();
  const b = arriving();
  return { x: lerp(a.x, b.x, across), y: lerp(a.y, b.y, across), z: lerp(a.z, b.z, across) };
}

/**
 * The clock's tempo through a flight at progress `t`: it eases down with the camera as it
 * backs off, is slowest in the crossing (`FLIGHT_TEMPO`) and eases back up as the next world
 * nears, so the Sun never stops.
 */
export const flightHush = (t: number) =>
  1 - (1 - FLIGHT_TEMPO) * Math.sin(Math.PI * clamp01(t)) ** 2;

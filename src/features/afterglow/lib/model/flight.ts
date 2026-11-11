/**
 * Where the camera stands over a world, and a flight from one world to the next. Places are in
 * au: x along the line from the Sun (outward), y the orbit's north, z across them (x × y), so a
 * camera on the +z side sees the world to the right of the Sun. The view's frame faces the Sun
 * from every place; through a flight the scene turns the camera a little within it
 * (`flightTurn`).
 *
 * A flight is a ship's, in two halves that mirror each other. It lifts off the world it leaves,
 * slowly, so the limb curves into a whole globe, and backs away at a steady, gentle pace until
 * the globe is a small one beside the Sun (`FLIGHT_FAR_RADII`); from there it gathers speed
 * and the world flies away where it stands, dwindling to a point and gone. The camera follows
 * it a little as it goes, then turns across the Sun and the stars to meet the next world: a
 * point on the Sun's other side that rushes up into a small globe, slows, and is closed on as
 * gently until it settles under the camera as the limb at rest. Between the two, with neither
 * in sight, the camera crosses on one curve from where the one was lost to where the other
 * shows (`crossing`). Nothing fades and nothing stops: every pace joins the next without a
 * jolt, and the camera's place never steps, so the Sun, seen from it, never turns at once.
 */
import { clamp01, lerp, smootherstep } from "@horizon/toolkit/math";

import { FLIGHT_FAR_RADII, FLIGHT_TEMPO, ORBIT_RADII } from "./parameters";

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
 * world's radii at which its globe is too small to see, and where the world left and the next
 * one stand once they are small.
 */
export type FlightView = { lift: number; gone: number; leave: SeenPlace; arrive: SeenPlace };

/**
 * The share of the flight's way (`along`) eased into and out of: the camera gathers speed over
 * this first share of the flight's time, holds it, and comes to rest over the last.
 */
const EASE = 0.25;
/**
 * The way to where the world left is gone and, from the end, back to where the next one shows;
 * between, the camera crosses with the Sun and the stars alone.
 */
const GONE_AT = 0.46;
/** The share of that way flown gently, to the far place (`FLIGHT_FAR_RADII`); over the rest the world flies away. */
const NEAR = 0.72;

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

/** The gentle pace: what the distance's logarithm gains over the whole way out, were it held. */
const GENTLE = Math.log(FLIGHT_FAR_RADII / ORBIT_RADII) / NEAR;
/** What the rush adds to that logarithm by the place where a world is gone, `gone` radii off. */
const rushTo = (gone: number) => Math.max(0, Math.log(gone / ORBIT_RADII) - GENTLE);

/**
 * How far off a world the camera is, in its radii, `out` of the way to where it is gone (1). Up
 * to `NEAR` the distance moves evenly in its logarithm to the far place, so the globe shrinks
 * by a steady, gentle factor; past it the pace gathers as the square of the way on, joining
 * without a jolt, so the small globe flies away to nothing.
 */
function radiiAt(out: number, gone: number) {
  const past = Math.max(0, (out - NEAR) / (1 - NEAR));
  return ORBIT_RADII * Math.exp(GENTLE * out + rushTo(gone) * past * past);
}

/** The pace of that distance's logarithm, per share of the way out, where the world is gone. */
const paceGone = (gone: number) => GENTLE + (2 * rushTo(gone)) / (1 - NEAR);

/**
 * Off a world or onto it, `out` of the way to where it is gone. Its nearest point slides from
 * the limb's place to `place` over the gentle part of the way, leaving and arriving at rest (a
 * smooth step), and holds there as the world flies away: it dwindles where it stands.
 */
function backedOff(end: FlightEnd, out: number, view: FlightView, place: SeenPlace) {
  const f = Math.min(1, out / NEAR);
  const slid = f * f * (3 - 2 * f);
  return standingPlace(
    end,
    end.radius * radiiAt(out, view.gone),
    lerp(view.lift, place.apart, slid),
    place.roll * slid,
  );
}

/** A size or a distance `f` of the way from `a` to `b`, evenly in its logarithm. */
const scaled = (a: number, b: number, f: number) => a * (b / a) ** f;

/**
 * Between the worlds, `across` (0–1) of the way from where the one left is gone to where the
 * next shows. The camera stands off a point that slides from the one world to the other, at
 * rest at both ends (a smooth step): its distance from the Sun and its size, evenly in their
 * logarithms, and its far place in the view, straight across under the Sun. The camera's
 * distance from that point, in its radii, carries the rush on as a cubic: it leaves at the
 * pace the world was lost at, turns over and comes back at the pace the next is met at. So the
 * camera's place and pace join both halves of the flight, and the Sun's face and the stars turn
 * a little over the whole crossing, never at one moment.
 */
function crossing(across: number, from: FlightEnd, to: FlightEnd, view: FlightView): FlightPlace {
  const slid = smootherstep(across);
  const end = {
    distance: scaled(from.distance, to.distance, slid),
    radius: scaled(from.radius, to.radius, slid),
  };
  const beside = lerp(
    view.leave.apart * Math.sin(view.leave.roll),
    view.arrive.apart * Math.sin(view.arrive.roll),
    slid,
  );
  const below = lerp(
    view.leave.apart * Math.cos(view.leave.roll),
    view.arrive.apart * Math.cos(view.arrive.roll),
    slid,
  );
  /* The distance's pace as the crossing begins, per share of the crossing, as a share of the distance. */
  const pace = (paceGone(view.gone) * (1 - 2 * GONE_AT)) / GONE_AT;
  return standingPlace(
    end,
    end.radius * radiiAt(1, view.gone) * (1 + pace * across * (1 - across)),
    Math.hypot(beside, below),
    Math.atan2(beside, below),
  );
}

/**
 * Where the camera is at a flight's progress `t` (0–1): off the world left, across to the next
 * and onto it, on one curve whose place and pace never step.
 */
export function flightPlace(
  t: number,
  from: FlightEnd,
  to: FlightEnd,
  view: FlightView,
): FlightPlace {
  const way = along(t);
  if (way <= GONE_AT) {
    return backedOff(from, way / GONE_AT, view, view.leave);
  }
  if (way >= 1 - GONE_AT) {
    return backedOff(to, (1 - way) / GONE_AT, view, view.arrive);
  }
  return crossing((way - GONE_AT) / (1 - 2 * GONE_AT), from, to, view);
}

/**
 * Whether the next world is the one drawn at a flight's progress `t`. The globes change at an
 * edge of the crossing, so that the inner of the two is the one drawn through it: the camera,
 * always beyond the world it watches, passes the outer one's place on the way across, too near
 * for it to stay out of sight. Flying outward the next world is drawn as the crossing ends,
 * flying inward as it begins.
 */
export function flightShowsNext(t: number, from: FlightEnd, to: FlightEnd) {
  const way = along(t);
  return to.distance > from.distance ? way >= 1 - GONE_AT : way > GONE_AT;
}

/**
 * The camera's turn through a flight at progress `t`, −1 to 1 of its reach: towards the world
 * left as it goes (positive), across the Sun at the middle, towards the next as it comes, and
 * back to rest; eased at both ends so it starts and stops without a jolt.
 */
export function flightTurn(t: number) {
  const u = clamp01(t);
  return Math.sin(2 * Math.PI * u) * smootherstep(Math.min(u, 1 - u) / TURN_EASE);
}
/** The share of the flight the turn eases in and out over. */
const TURN_EASE = 0.25;

/**
 * The clock's tempo through a flight at progress `t`: it eases down with the camera as it
 * backs off, is slowest at the flight's middle (`FLIGHT_TEMPO`) and eases back up as the next
 * world nears, so the Sun never stops.
 */
export const flightHush = (t: number) =>
  1 - (1 - FLIGHT_TEMPO) * Math.sin(Math.PI * clamp01(t)) ** 2;

import { sampleOrbitFlight, type OrbitFlight, type OrbitPose } from "@horizon/toolkit/camera";
/**
 * The guided tour: one concept per step, each with a camera pose, a view, a time
 * and the display switches it needs. Copy lives in `tour.steps.<id>`.
 */
import { keplerThirdLaw, type Formula } from "@horizon/toolkit/science";

import type { Selection, Show } from "../store";
import { MODEL_START, SUN_BIRTH } from "./parameters";
import { type ViewId } from "./views";

export type TourStepId =
  | "today"
  | "periods"
  | "ellipses"
  | "scale"
  | "disk"
  | "snowLine"
  | "clearing"
  | "oort"
  | "galaxy";

/** A drawing laid into the scene once a step lands (see `tour-sketch.ts`). */
export type TourSketchId = "year" | "areas" | "sense";

export type TourStep = OrbitPose & {
  id: TourStepId;
  view: ViewId;
  yearsAgo: number;
  playing?: boolean;
  show?: Partial<Show>;
  focus?: Selection;
  /** Steps whose copy carries a one-line relation under the body. */
  eq?: boolean;
  /** A shared formula the relation prints as `{equation}`. */
  equation?: Formula;
  /** Flight shaping (see `sampleOrbitFlight`) and its length in seconds. */
  flight?: Pick<OrbitFlight, "lift" | "swing" | "lead"> & { duration?: number };
  /** Slow orbit while the card is read, rad/s; + turns with the planets. */
  drift?: number;
  sketch?: TourSketchId;
};

export const TOUR: readonly TourStep[] = [
  {
    id: "today",
    view: "inner",
    azimuth: 0.6,
    inclination: 0.95,
    distance: 6.5,
    yearsAgo: 0,
    focus: { kind: "planet", id: "earth" },
    flight: { duration: 6, lift: 0.15, lead: 0.3 },
    drift: 0.012,
  },
  {
    id: "periods",
    view: "giants",
    azimuth: 0.9,
    inclination: 0.82,
    distance: 78,
    yearsAgo: 0,
    focus: { kind: "planet", id: "jupiter" },
    eq: true,
    equation: keplerThirdLaw,
    // Pull back first, turn late: the inner orbits shrink away before the giants swing in.
    flight: { duration: 7, lift: 0.1, lead: -0.4 },
    drift: 0.008,
    sketch: "year",
  },
  {
    id: "ellipses",
    view: "giants",
    azimuth: 1.6,
    inclination: 1.1,
    distance: 92,
    yearsAgo: 0,
    focus: { kind: "named", id: "halley" },
    eq: true,
    flight: { duration: 6.5, lift: 0.12, lead: 0.4 },
    drift: 0.006,
    sketch: "areas",
  },
  {
    id: "scale",
    view: "giants",
    azimuth: 1.2,
    inclination: 0.5,
    distance: 64,
    yearsAgo: 0,
    show: { trueSize: true },
    focus: { kind: "planet", id: "jupiter" },
    flight: { duration: 6, swing: 0.15, lead: -0.2 },
    drift: -0.01,
  },
  {
    id: "disk",
    view: "giants",
    azimuth: 0.7,
    inclination: 0.42,
    distance: 70,
    yearsAgo: SUN_BIRTH - 3e5,
    // Dip toward the plane, then ride round with the disk.
    flight: { duration: 7, lift: -0.1, lead: 0.3 },
    drift: 0.014,
    sketch: "sense",
  },
  {
    id: "snowLine",
    view: "inner",
    azimuth: 0.5,
    inclination: 1.0,
    distance: 13,
    yearsAgo: SUN_BIRTH - 2.5e6,
    flight: { duration: 7.5, lift: 0.15, lead: -0.5 },
    drift: 0.012,
  },
  {
    id: "clearing",
    view: "giants",
    azimuth: 0.6,
    inclination: 0.62,
    distance: 96,
    yearsAgo: MODEL_START,
    playing: true,
    flight: { duration: 7, swing: 0.1, lead: 0.3 },
    drift: 0.006,
  },
  {
    id: "oort",
    view: "oort",
    azimuth: 0.8,
    inclination: 0.4,
    distance: 170_000,
    yearsAgo: 0,
    flight: { duration: 9, lift: 0.2, lead: -0.5 },
    drift: 0.01,
  },
  {
    id: "galaxy",
    view: "galaxy",
    azimuth: 0.6,
    inclination: 0.58,
    distance: 92_000,
    yearsAgo: 0,
    flight: { duration: 8, lift: 0.1 },
    drift: 0.006,
  },
];

/** Seconds a flight to this step takes. */
export const tourFlightSeconds = (step: TourStep) => step.flight?.duration ?? 6;

/**
 * Camera pose `t` of the way from `from` to a step: the shorter way round in
 * azimuth and log-linear in distance, so a jump from 6 AU to 170,000 AU reads as
 * one steady pull-back instead of a lurch at the end. The step may arc, swing
 * and lead the turn on the way.
 */
export function sampleTourFlight(t: number, from: OrbitPose, to: TourStep | OrbitPose): OrbitPose {
  return sampleOrbitFlight(t, from, {
    yaw: shortestTurn(from.azimuth, to.azimuth),
    inclination: to.inclination,
    distance: to.distance,
    ...("flight" in to ? to.flight : undefined),
  });
}

/** Signed turn in (−π, π] from one azimuth to another. */
export function shortestTurn(from: number, to: number) {
  const tau = Math.PI * 2;
  return ((((to - from + Math.PI) % tau) + tau) % tau) - Math.PI;
}

/**
 * The guided tour: one concept per step, each with a camera pose, a view, a time
 * and the display switches it needs. Copy lives in `tour.steps.<id>`.
 */
import { MODEL_START, SUN_BIRTH } from "@/space/solar-system/model/parameters";
import type { SolarSelection } from "@/space/solar-system/model/selection";
import { type SolarViewId } from "@/space/solar-system/model/views";
import type { TourShot } from "@horizon/toolkit/scene";
import { keplerThirdLaw, type Formula } from "@horizon/toolkit/science";

import type { Show } from "../store";

export type TourStepId =
  | "today"
  | "periods"
  | "ellipses"
  | "scale"
  | "disk"
  | "snowLine"
  | "clearing"
  | "oort";

/** A drawing laid into the scene once a step lands (see `tour-sketch.ts`). */
export type TourSketchId = "year" | "areas" | "sense";

/** A step: its shot (pose, flight shaping and hold drift; see `createTourCamera`) and the rest. */
export type TourStep = TourShot & {
  id: TourStepId;
  view: SolarViewId;
  yearsAgo: number;
  playing?: boolean;
  show?: Partial<Show>;
  focus?: SolarSelection;
  /** Steps whose copy carries a one-line relation under the body. */
  eq?: boolean;
  /** A shared formula the relation prints as `{equation}`. */
  equation?: Formula;
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
];

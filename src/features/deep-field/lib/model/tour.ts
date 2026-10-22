/**
 * The guided journey: from the planets out to the microwave background. Each
 * frames a view as the ladder does, lights what it is about (a selection, the rulers) and
 * holds while its caption is read, then the journey moves on; on the way the sightline reads
 * how far the camera looks and how old that light is. Copy lives in `tour.steps.<id>`.
 */
import { HALO_FRAME_LY } from "@/space/galaxy/model/dark-halo";
import type { OrbitPose } from "@horizon/toolkit/camera";
import type { TourShot } from "@horizon/toolkit/scene";
import { convert } from "@horizon/toolkit/science";

import type { Selection, Show } from "../store";
import type { DarkView } from "./dark-universe";
import type { ViewId } from "./view-ids";

type TourStepId =
  | "sunlight"
  | "giants"
  | "voyager"
  | "oort"
  | "stars"
  | "galaxy"
  | "darkHalo"
  | "andromeda"
  | "virgo"
  | "laniakea"
  | "web"
  | "firstLight";

type TourStep = Pick<TourShot, "flight" | "drift"> & {
  id: TourStepId;
  /** The view the shot frames, as the ladder frames it. */
  view: ViewId;
  /** Nudges to that framing. */
  pose?: Partial<OrbitPose>;
  focus?: Selection;
  show?: Partial<Show>;
  /** Seconds the caption holds once the shot lands, before the journey moves on. */
  dwell?: number;
  /** A scientific detail, shown only while its explanatory stop is active. */
  dark?: DarkView;
};

/** Seconds a landed shot holds by default. */
export const TOUR_DWELL = 9;

export const TOUR: readonly TourStep[] = [
  {
    id: "sunlight",
    view: "inner",
    focus: { kind: "planet", id: "earth" },
    show: { distances: true },
    /* Whatever the camera was looking at, a long, slow dive home. */
    flight: { duration: 9, lift: 0.15, lead: 0.3 },
    drift: 0.012,
  },
  {
    id: "giants",
    view: "giants",
    focus: { kind: "planet", id: "earth" },
    show: { distances: true },
    // Pull back first, turn late: the inner orbits shrink away before the giants swing in.
    flight: { duration: 7, lift: 0.1, lead: -0.4 },
    drift: 0.008,
  },
  {
    id: "voyager",
    view: "heliosphere",
    focus: { kind: "reach", id: "voyager1" },
    show: { lightTime: true },
    /* Out past the planets' plane and up, so the probes' paths open out from the Sun. */
    flight: { duration: 7, lift: 0.2, lead: 0.2 },
    drift: 0.01,
    dwell: 10,
  },
  {
    id: "oort",
    view: "oort",
    flight: { duration: 8, lift: 0.2, lead: -0.3 },
    drift: 0.01,
  },
  {
    id: "stars",
    view: "stars",
    show: { distances: true },
    flight: { duration: 7, swing: 0.1, lead: 0.2 },
    drift: 0.008,
  },
  {
    id: "galaxy",
    view: "galaxy",
    focus: { kind: "galaxy", id: "sun" },
    /* The longest pull: the ecliptic gives way to the galactic plane on the way out. */
    flight: { duration: 10, lift: 0.15, lead: -0.3 },
    drift: 0.006,
    dwell: 10,
  },
  {
    id: "darkHalo",
    view: "galaxy",
    focus: { kind: "galaxy", id: "halo" },
    pose: { distance: convert(HALO_FRAME_LY, "ly", "au") },
    show: { halo: true, haloBoundary: false },
    dark: "halo",
    flight: { duration: 7 },
    drift: 0.004,
    dwell: 18,
  },
  {
    id: "andromeda",
    view: "local-group",
    focus: { kind: "cosmos", id: "andromeda" },
    flight: { duration: 9, lift: 0.1, lead: 0.2 },
    drift: 0.008,
  },
  {
    id: "virgo",
    view: "virgo-cluster",
    focus: { kind: "cosmos", id: "virgo" },
    flight: { duration: 8, swing: 0.1, lead: -0.2 },
    drift: 0.008,
  },
  {
    id: "laniakea",
    view: "laniakea",
    focus: { kind: "cosmos", id: "laniakea" },
    flight: { duration: 8, lift: 0.1, lead: 0.3 },
    drift: 0.006,
  },
  {
    id: "web",
    view: "cosmic-web",
    dark: "lensing",
    dwell: 22,
    flight: { duration: 8, lift: 0.12, lead: -0.2 },
    drift: 0.006,
  },
  {
    id: "firstLight",
    view: "observable-universe",
    focus: { kind: "cosmos", id: "observableUniverse" },
    dark: "expansion",
    flight: { duration: 11, lift: 0.1, lead: -0.3 },
    drift: 0.004,
    dwell: 14,
  },
];

import type { CuedShot, DriftProgramme } from "@/lib/drift";
/**
 * The Sun's drift, timed to "Low Drone Rises" (242.8 s a loop after the player's crossfade):
 * a long low drone that rises at 36 s, breathes at 73 s, surges at 200 s to a peak at 211 s and
 * fades from 228 s. The camera meets it by the track's map: the limb in Hα `at` the start,
 * spicules and a prominence against the dark; the dive through the cut `at` the rise, the
 * shells turning; out through the corona in 171 Å on the breath; the eruption begins on the
 * surge and the rope breaks loose on the `peak`; the eclipse on the fade, the ejection leaving
 * through the streamers as the loop closes. The holds written here are the timing without a
 * map and add up to the period; `timeShots` sets them so the cued shots meet their cues.
 */
import type { DriftPoseShot, OrbitPose } from "@horizon/toolkit/camera";

import type { LightId } from "./model/lights";
import type { ViewId } from "./model/views";

export type SunDriftShot = Omit<DriftPoseShot, keyof OrbitPose> &
  CuedShot & {
    /** The view the shot frames, as the scene frames it. */
    view: ViewId;
    /** Nudges to that framing. */
    pose?: Partial<OrbitPose>;
    light: LightId;
    /** The cut to open, 0–1, over the shot. */
    cut?: number;
    /** Where the eruption stands as the shot lands and as it leaves, 0–1: it plays between. */
    eruption?: readonly [number, number];
  };

export const DRIFT: DriftProgramme<SunDriftShot> = {
  music: { track: "Low Drone Rises", period: 242.8 },
  camera: {
    flight: 20,
    hold: 10,
    variance: 0.2,
    timeVariance: 0,
    drift: 0.015,
    creep: 0.05,
    order: "sequence",
  },
  shots: [
    /* The limb in Hα as the drone opens: spicules, a prominence standing against the dark. */
    {
      at: "start",
      view: "chromosphere",
      light: "halpha",
      pose: { inclination: 0.2 },
      flight: { duration: 16, lift: 0.1 },
      hold: 20,
      drift: 0.02,
    },
    /* The rise: the wedge opens as the camera swings round, the shells turning inside. */
    {
      at: "rise",
      view: "inside",
      light: "white",
      cut: 1,
      flight: { duration: 18, lead: 0.3 },
      hold: 19,
      creep: 0.08,
    },
    /* The breath: out through the corona, the loops lit in 171 Å. */
    {
      at: "breath-2",
      view: "corona",
      light: "fe171",
      flight: { duration: 18, lift: 0.15 },
      hold: 40,
    },
    /* The surface in white light, the spots drifting by, held through the long drone. */
    { view: "surface", light: "white", flight: { duration: 22, lead: -0.3 }, hold: 34.8 },
    /* The surge: the eruption begins; the rope breaks loose as the peak lands. */
    {
      land: "peak",
      view: "eruption",
      light: "fe171",
      eruption: [0.3, 0.75],
      flight: { duration: 16, lift: 0.1 },
      hold: 17,
      creep: 0.03,
    },
    /* The fade: the eclipse, the ejection leaving through the streamers as the loop closes. */
    {
      land: "fade",
      view: "corona",
      light: "eclipse",
      eruption: [0.75, 1],
      flight: { duration: 12, lead: 0.2 },
      hold: 10,
    },
  ],
};

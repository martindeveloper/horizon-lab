import type { CuedShot, DriftProgramme } from "@/lib/drift";
/**
 * The Sun's drift: a directed passage, flown in order, timed to "The Star Rings" (284 s, a loop
 * of 276 s after the player's crossfade): a golden hum that enters at once and breathes, a
 * crackle like boiling plasma cresting at 114 s and again at 153 s, a swell at 190 s, a hush at
 * 259 s and its loudest bloom at 271 s as it closes.
 *
 *   Arrival  — the eclipse's ring of corona among the stars, far out; then one long push-in to
 *              the golden Sun in 171 Å, its loops standing off the limb.
 *   Passage  — close over the surface, the camera changing angle and light but hardly distance:
 *              down to the granules boiling round a spot group in white light on the first
 *              crackle, along the limb in Hα on the second, then over an active region in 171 Å
 *              as the swell comes, where the field breaks loose.
 *   Release  — the only pull-back, on the hush: out with the Sun cut open, its shells shown on
 *              the bloom (the star rings), carried on outward into the eclipse that opens the loop.
 *
 * Every shot is a pose about the Sun's centre, in a frame that turns with the Sun, with a
 * `look` that sets its subject on a third of the frame (about 0.27 rad off the line of sight;
 * less where the disc fills much of the view, so it stays whole): `driftPose` writes the feature
 * views about the centre. Close over the surface any turn about the centre slides the camera
 * across the feature it frames, so the camera runs no orbit of its own through the flights and
 * no sway; each hold turns at its own rate, sized to its distance (a slow pan of a few degrees
 * over a feature, a full drift round the whole Sun), and variance is kept very low. The holds
 * written here are the timing without a map and add up to the period; `timeShots` sets them so
 * the cued shots meet their cues.
 */
import type { DriftPoseShot, OrbitPose } from "@horizon/toolkit/camera";

import type { LightId } from "./model/lights";
import type { ViewId } from "./model/views";

export type SunDriftShot = Omit<DriftPoseShot, keyof OrbitPose> &
  CuedShot & {
    /** The view the shot frames, as the scene frames it. */
    view: ViewId;
    /** Nudges to that framing, in the view's own orbit (about a feature, for the feature views). */
    pose?: Partial<OrbitPose>;
    light: LightId;
    /** The cut to open, 0–1, over the shot. */
    cut?: number;
    /** Where the eruption stands as the shot lands and as it leaves, 0–1: it plays between. */
    eruption?: readonly [number, number];
  };

export const DRIFT: DriftProgramme<SunDriftShot> = {
  music: { track: "The Star Rings", period: 276 },
  camera: {
    flight: 20,
    hold: 12,
    variance: 0.02,
    timeVariance: 0,
    drift: 0,
    sway: 0,
    creep: 0.02,
    order: "sequence",
  },
  shots: [
    /* The hum enters: the eclipse's ring among the stars, far out, the Sun on the right third. */
    {
      at: "start",
      view: "corona",
      light: "eclipse",
      pose: { distance: 7, inclination: 0.12 },
      look: { yaw: 0.27, pitch: 0.04 },
      flight: { duration: 14, lift: 0.1 },
      hold: 32,
      drift: 0.02,
      creep: 0.03,
    },
    /* The push-in: the golden Sun in 171 Å on the left, its loops off the limb in the dark. */
    {
      view: "surface",
      light: "fe171",
      pose: { distance: 2.4, inclination: 0.28 },
      look: { yaw: -0.2, pitch: 0.06 },
      flight: { duration: 34, lead: 0.3 },
      hold: 34,
      drift: 0.004,
      creep: 0.06,
    },
    /* The first crackle: down to the granules boiling round a spot group, in white light. */
    {
      at: "bright-1",
      view: "sunspot",
      light: "white",
      pose: { distance: 0.14, inclination: 1, azimuth: 0.6 },
      look: { yaw: 0.27, pitch: 0.08 },
      flight: { duration: 24, lead: 0.2 },
      hold: 15,
      drift: 0.0003,
      creep: 0.02,
    },
    /* The second crackle: along the limb in Hα, spicules and a prominence against the dark. */
    {
      at: "bright-2",
      view: "chromosphere",
      light: "halpha",
      pose: { distance: 0.4, inclination: 0.12, azimuth: 0.3 },
      look: { yaw: -0.27, pitch: 0.04 },
      flight: { duration: 18 },
      hold: 17,
      drift: 0.001,
      creep: 0.02,
    },
    /* The swell: over an active region in 171 Å; the rope rises and breaks loose. */
    {
      view: "eruption",
      light: "fe171",
      eruption: [0.2, 0.95],
      look: { yaw: 0.27, pitch: 0.05 },
      flight: { duration: 16, lift: 0.05 },
      hold: 41,
      drift: 0.0015,
      creep: 0.02,
    },
    /* The hush and the bloom: out with the Sun cut open, its shells shown as the music peaks. */
    {
      land: "peak",
      view: "inside",
      light: "white",
      cut: 1,
      pose: { distance: 3.2, inclination: 0.35 },
      look: { yaw: -0.24, pitch: 0.04 },
      flight: { duration: 26, lead: 0.2, lift: 0.15 },
      hold: 5,
      drift: 0.02,
      creep: 0,
    },
  ],
};

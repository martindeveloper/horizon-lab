import type { CuedShot, DriftProgramme } from "@/lib/drift";
/**
 * The observatory's drift: a directed passage, flown in order, that arrives, stays close and
 * leaves once. Shots are camera poses in M about the hole with a `look` off it, so the hole
 * sits on a third of the frame and every hold's orbit slides it across the sky instead of
 * spinning the disk under a fixed centre.
 *
 *   Arrival   — far and low, the hole off to one side; one deliberate push-in.
 *   Passage   — everything between 9 and 24 M: over the top, down to the plane looking up at
 *               the lensed far side, then riding with the gas looking down the flow and
 *               turning back to face the shadow mid-ride.
 *   Release   — the only pull-back, letting go of the gas on the way, which wraps into the
 *               arrival at a like distance.
 *
 * Both programmes are timed to their track (see `music.period`) and open on the shot whose cue
 * the music is nearest (`openingFor`). Variance is kept low so the arc holds. Distances stay
 * above every spin's floor
 * (`clampDistance`), which the engine applies as it moves the camera; a riding shot's hold
 * turns at the gas's rate for the hole's spin (the engine's `holdDrift`).
 */
import type { DriftShot } from "@horizon/toolkit/camera";

/** A black-hole drift shot: a toolkit shot that may begin or land on a cue of the track's map. */
export type HoleShot = DriftShot & CuedShot;

export const DRIFT: DriftProgramme<HoleShot> = {
  /*
   * Timed to "Low Drone Rises" (250.8 s, looping every 242.8 s after the player's 8 s
   * crossfade): its intro sinks to its quietest at 40 s, rises at 44 s, plateaus with swells
   * near 84 s and 108 s, holds its breath at 196–204 s, peaks at 208–230 s and fades. The
   * camera meets it by the track's map: the overture `at` its start, the push-in `at` the
   * rise, the head turning back to `land` the shadow on the peak, the release on the fade. The
   * holds written here are the timing without a map and add up to the period; with one,
   * `timeShots` sets them so the cued shots meet their cues. Lengths never vary between loops;
   * angles and distances still vary a little.
   */
  music: { track: "Low Drone Rises", period: 242.8 },
  camera: {
    flight: 22,
    hold: 12,
    variance: 0.25,
    timeVariance: 0,
    drift: 0.02,
    sway: 0.05,
    creep: 0.04,
    order: "sequence",
  },
  shots: [
    /* The intro sinking: out to the overture, far and low, the hole on the right third. */
    {
      at: "start",
      azimuth: 0.4,
      inclination: 0.12,
      distance: 60,
      roll: 0.03,
      look: { yaw: -0.3, pitch: 0.04 },
      flight: { duration: 24, lift: 0.1 },
      hold: 19,
      creep: 0,
    },
    /* The rise: the push-in, the hole sliding to centre as the music enters. */
    {
      at: "rise",
      azimuth: 1.6,
      inclination: 0.35,
      distance: 44,
      flight: { duration: 26, lead: 0.4 },
      hold: 14,
    },
    /* 83 s, the first swell: over the top, looking down into the shadow, the disk turning. */
    {
      azimuth: 2.6,
      inclination: 1.0,
      distance: 24,
      roll: -0.05,
      look: { yaw: 0.2, pitch: 0 },
      flight: { duration: 20, lift: 0.1 },
      hold: 14,
      drift: 0.035,
    },
    /* 117 s: down to the plane, dipping under on the way, looking up at the far side overhead. */
    {
      azimuth: 3.4,
      inclination: 0.1,
      distance: 16,
      look: { yaw: 0, pitch: 0.32 },
      flight: { duration: 22, lift: -0.15, lead: -0.3 },
      hold: 12,
      creep: 0,
    },
    /* 151 s, the plateau's high layer: the ride, low and with the gas, looking down the flow,
       the hole hard on the left edge; the gas holds still, the sky and lensed hole wheel past. */
    {
      azimuth: 4.2,
      inclination: 0.09,
      distance: 9,
      look: { yaw: 1.15, pitch: -0.03 },
      ride: 1,
      flight: { duration: 20, lift: 0.06 },
      hold: 24,
      creep: 0,
    },
    /* The breath: still riding, the head turns back, and the shadow lands in frame on the
       peak; held there through it, the hold running to the release. */
    {
      land: "peak",
      azimuth: 5.4,
      inclination: 0.11,
      distance: 9.5,
      roll: -0.03,
      look: { yaw: 0.28, pitch: -0.02 },
      ride: 1,
      flight: { duration: 13 },
      hold: 14,
      creep: 0,
    },
    /* The fade: letting go of the gas and pulling away in one move, the hole sliding to a
       third; the loop's intro then carries the camera on to the overture. */
    {
      azimuth: 6.4,
      inclination: 0.42,
      distance: 85,
      look: { yaw: 0.22, pitch: 0.03 },
      flight: { duration: 20, lift: 0.25, lead: -0.3 },
      hold: 1,
      creep: 0,
    },
  ],
};

/**
 * The drift of a dormant hole (no disk light): the invisible made visible. It opens on plain
 * sky with nothing there, pans until the warp slides into frame, approaches along the thinning
 * Einstein ring, rides the edge where starlight smears along the limb, then falls into motion:
 * riding at half of c the whole sky collapses into a bright beam ahead, swings off as the head
 * turns, and relaxes as the camera lets go. The release shrinks the ring back to an eye in the
 * star field and the wrap pans away again. Holds stay at 7 M or more: closer, the shadow fills
 * the frame.
 */
export const DORMANT_DRIFT: DriftProgramme<HoleShot> = {
  /*
   * Timed to "Aeolian Static" (253.8 s, looping every 245.8 s): a level bed with two breaths,
   * at 92 s and 156–160 s, its brightest timbre near 70 s and 200 s, and a darkening in its
   * last seconds. By the track's map the dive into motion lands on `quiet`, the second breath,
   * so the beam forms as the music drops, and the head turning back lands on `peak`; the holds
   * written here are the timing without a map.
   */
  music: { track: "Aeolian Static", period: 245.8 },
  camera: {
    flight: 22,
    hold: 12,
    variance: 0.2,
    timeVariance: 0,
    drift: 0.02,
    sway: 0.05,
    creep: 0.03,
    order: "sequence",
  },
  shots: [
    /* 0 s: nothing there, a plain patch of stars above the galactic band, the hole behind. */
    {
      azimuth: 0.6,
      inclination: 0.2,
      distance: 48,
      look: { yaw: -2.4, pitch: 0.45 },
      flight: { duration: 22 },
      hold: 10,
      creep: 0,
    },
    /* 32 s: the pan, at the same distance the head turns and the warp slides into frame. */
    {
      azimuth: 0.9,
      inclination: 0.22,
      distance: 48,
      roll: 0.02,
      look: { yaw: -0.25, pitch: 0.05 },
      flight: { duration: 22 },
      hold: 12,
      creep: 0,
    },
    /* 66 s: approach along the ring, the black disc growing, the ring thinning to a razor. */
    {
      azimuth: 1.8,
      inclination: 0.3,
      distance: 22,
      look: { yaw: 0.35, pitch: 0.08 },
      flight: { duration: 24, lead: 0.4 },
      hold: 10,
    },
    /* 100 s: the edge, the shadow filling half the frame, starlight smeared along the limb. */
    {
      azimuth: 2.7,
      inclination: 0.25,
      distance: 9,
      roll: 0.04,
      look: { yaw: 0.6, pitch: 0.05 },
      flight: { duration: 18, lift: 0.08 },
      hold: 18,
      drift: 0.03,
      creep: 0,
    },
    /* Into motion, landing on the track's quietest moment: riding a circular orbit at half of
       c, the sky collapses into a beam ahead as the music drops. */
    {
      land: "quiet",
      azimuth: 3.6,
      inclination: 0.1,
      distance: 7,
      look: { yaw: 1.05, pitch: 0 },
      ride: 1,
      flight: { duration: 18 },
      hold: 22,
      creep: 0,
    },
    /* Still riding, the head turns back and lands on the peak; the beam swings off, the limb
       against the squeezed sky. */
    {
      land: "peak",
      azimuth: 4.6,
      inclination: 0.12,
      distance: 7.5,
      roll: -0.03,
      look: { yaw: 0.25, pitch: 0 },
      ride: 1,
      flight: { duration: 14 },
      hold: 21,
      creep: 0,
    },
    /* Letting go, the shadow at the frame's edge, the sky relaxing back as the camera slows to
       hovering and creeps. */
    {
      azimuth: 5.3,
      inclination: 0.3,
      distance: 14,
      look: { yaw: -0.5, pitch: 0.06 },
      flight: { duration: 10 },
      hold: 6,
      creep: 0.06,
    },
    /* The darkening: release, the ring shrinking back to an eye in the star field; the wrap
       pans away again. */
    {
      azimuth: 6.2,
      inclination: 0.35,
      distance: 60,
      look: { yaw: 0.3, pitch: 0.05 },
      flight: { duration: 18, lift: 0.25 },
      hold: 1,
      creep: 0,
    },
  ],
};

/** The drift for a hole as it is lit: a dark disk (dormant, or turned down) flies the dormant one. */
export const driftFor = (diskBrightness: number) => (diskBrightness > 0 ? DRIFT : DORMANT_DRIFT);

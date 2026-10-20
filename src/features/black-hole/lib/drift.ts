import type { DriftProgramme } from "@/lib/drift";
/**
 * The observatory's drift: the lean-back orbit of the hole. Shots are camera poses in M about
 * the hole, low and wide, over the disk, edge-on and close by the photon ring, each with a
 * little Dutch tilt; the camera (`createDriftCamera`) shuffles them and spreads angles,
 * distance and timing, so the orbit never repeats. Distances stay above every spin's floor
 * (`clampDistance`), which the engine applies as it moves the camera.
 */
import type { DriftShot } from "@horizon/toolkit/camera";

export const DRIFT: DriftProgramme<DriftShot> = {
  music: { track: "Low Drone Rises" },
  camera: { flight: 24, hold: 12, variance: 0.4, drift: 0.008, creep: 0.06, order: "shuffle" },
  shots: [
    /* Wide and low: the whole disk against the sky. */
    {
      azimuth: 0.4,
      inclination: 0.18,
      distance: 120,
      roll: 0.03,
      flight: { lift: 0.15, lead: -0.4 },
    },
    /* A sweeping dolly that dips in on the way. */
    { azimuth: 2.2, inclination: 0.55, distance: 48, flight: { swing: -0.12, lead: 0.5 } },
    /* Over the disk, looking down into the shadow. */
    { azimuth: 3.6, inclination: 1.05, distance: 28, roll: -0.04, flight: { lift: 0.1 }, hold: 14 },
    /* Edge-on and close: the disk's far side lensed over the top. */
    {
      azimuth: 5.0,
      inclination: 0.04,
      distance: 22,
      flight: { duration: 28, lead: 0.3 },
      hold: 16,
    },
    /* From above, far off: the orbit's own slow turn. */
    { azimuth: 1.4, inclination: 1.35, distance: 70, flight: { duration: 26, lift: -0.1 } },
    /* Near the photon ring, creeping closer through the hold. */
    {
      azimuth: 4.3,
      inclination: 0.3,
      distance: 14,
      roll: 0.05,
      flight: { duration: 30, swing: 0.1 },
      hold: 10,
      creep: 0.1,
    },
  ],
};

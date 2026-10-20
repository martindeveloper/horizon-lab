/**
 * Schwarzschild  —  theory, static vacuum (a = 0, Q = 0).
 *
 * Line element (geometric units):
 *   ds² = −(1 − 2M/r) dt² + (1 − 2M/r)⁻¹ dr² + r² dΩ²
 *
 * Three radii to lock:
 *   horizon      r₊   = 2M
 *   photon orbit r_ph = 3M     (unstable)
 *   ISCO         r_I  = 6M
 *
 * No Lense–Thirring twist. Deflection depends only on impact parameter,
 * but orbiting gas still produces Doppler contrast at nonzero inclination.
 *
 * Mass on the dial (1e8 M☉) is a ruler only. Sky: lab (weather = lab).
 */
import type { HoleSpec } from "./types";

export const schwarzschild: HoleSpec = {
  id: "schwarzschild",
  name: "Schwarzschild",
  kind: "theory",
  massSolar: 1e8,
  spin: 0,
  inclination: 0.38,
  distance: 26,
  exposure: 1,
  diskBrightness: 1.05,
  starIntensity: 1,
  tempScale: 0.9,
  sky: "lab",
  jet: 0,
  aliases: ["schwarzschild"],
  tour: [
    // Symmetric geometry, symmetric camera: straight dollies, level horizon.
    {
      phase: "wide",
      duration: 9,
      yaw: 0.6,
      inclination: 0.22,
      distance: 120,
      drift: 0.006,
      eq: "ds² = −(1 − 2M/r) dt² + (1 − 2M/r)⁻¹ dr² + r² dΩ²",
    },
    {
      phase: "dolly",
      duration: 9,
      yaw: 0.5,
      inclination: 0.88,
      distance: 46,
      lead: -0.3,
      creep: 0.06,
      sketch: [{ kind: "rings", rings: ["horizon", "photon", "isco"] }],
      eq: "r₊ = 2M    ·    r_ph = 3M    ·    r_ISCO = 6M",
    },
    {
      phase: "detail",
      duration: 8,
      yaw: 0.3,
      inclination: 1.18,
      distance: 30,
      sketch: [{ kind: "shadow" }, { kind: "rings", rings: ["horizon"] }],
      eq: "r₊ = 2M    (a = 0)",
    },
    // A slow 135° sweep low around the disk: every side looks alike but one.
    {
      phase: "hold",
      duration: 10,
      yaw: -2.36,
      inclination: 0.32,
      distance: 27,
      lift: 0.2,
      drift: -0.006,
      sketch: [{ kind: "flow" }],
    },
    { phase: "wide", duration: 9, yaw: 1, inclination: 0.72, distance: 128 },
  ],
};

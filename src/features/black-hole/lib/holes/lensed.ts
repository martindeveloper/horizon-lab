/**
 * Lensed disk  —  theory / optical effect, not a named object.
 *
 * Default teaching view: a thin Novikov–Thorne disk at a/M ≈ 0.82,
 * seen from just above the equator so the far side folds over the hole.
 *
 * Geometric units: the silhouette depends only on a/M.
 *   M = GM/c²     Rs = 2M
 *   capture impact (Schwarzschild)  b_c = 3√3 M ≈ 5.196 M
 *
 * Intensity on the disk (special-relativistic beaming + gravity):
 *   δ = 1 / (γ (1 − β μ))
 *   Iν,obs = g³ Iν,em(ν_obs/g); I_bol,obs = g⁴ I_bol,em
 *
 * Sky: generic lab field (weather = lensed).
 */
import type { HoleSpec } from "./types";

export const lensed: HoleSpec = {
  id: "lensed",
  name: "Lensed disk",
  kind: "theory",
  massSolar: 1e7,
  spin: 0.82,
  inclination: 0.18,
  distance: 26,
  exposure: 1.12,
  diskBrightness: 1.2,
  starIntensity: 1,
  tempScale: 1.05,
  sky: "lensed",
  jet: 0,
  tour: [
    // Crane up and out, the turn leading the pull-back.
    {
      phase: "wide",
      duration: 8.4,
      yaw: 0.9,
      inclination: 0.58,
      distance: 118,
      lift: 0.35,
      lead: 0.3,
      roll: 0.03,
      eq: "M = GM/c²   ·   Rs = 2M",
    },
    // A long, even push-in that sinks toward the disk plane before it turns.
    {
      phase: "dolly",
      duration: 8.6,
      yaw: 0.6,
      inclination: 0.16,
      distance: 40,
      lead: -0.4,
      roll: -0.02,
      creep: 0.08,
      sketch: [{ kind: "shadow" }, { kind: "rings", rings: ["horizon"] }],
      eq: "b_c = 3√3 M ≈ 5.196 M   (a = 0)",
    },
    // Hop over and skim back along the plane, tilted.
    {
      phase: "detail",
      duration: 8,
      yaw: -0.9,
      inclination: 0.1,
      distance: 28,
      lift: 0.25,
      roll: 0.05,
      sketch: [{ kind: "photon" }],
      eq: "r_ph / M = 2 (1 + cos(⅔ arccos(∓a/M)))",
    },
    // Breathe out mid-flight, then settle high over the crescent.
    {
      phase: "hold",
      duration: 8.2,
      yaw: 0.5,
      inclination: 0.82,
      distance: 32,
      swing: 0.3,
      lead: 0.5,
      sketch: [{ kind: "flow" }],
      eq: "g = ν_obs / ν_em    ·    I_bol,obs = g⁴ I_bol,em",
    },
    {
      phase: "wide",
      duration: 9.5,
      yaw: 1.4,
      inclination: 0.5,
      distance: 128,
      lift: 0.3,
      lead: -0.3,
    },
  ],
};

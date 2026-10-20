/**
 * Sandbox  —  inherited preset mass and user-selected spin.
 * Not a catalog object. Uses the lensed sky and the same geodesic sketch.
 *
 *   1 M☉ ≡ 1.48 km ≡ 4.9 μs
 * Silhouette depends only on a/M. Mass names the HUD kilometres.
 */
import type { HoleSpec } from "./types";

export const custom: HoleSpec = {
  id: "custom",
  name: "Custom",
  kind: "theory",
  massSolar: 1e7,
  spin: 0.82,
  inclination: 0.18,
  distance: 26,
  exposure: 1,
  diskBrightness: 1,
  starIntensity: 1,
  tempScale: 1,
  sky: "lensed",
  jet: 0,
  aliases: ["custom"],
  tour: [
    {
      phase: "wide",
      duration: 8.5,
      yaw: 0.85,
      inclination: 0.55,
      distance: 118,
      lift: 0.25,
      lead: 0.3,
    },
    {
      phase: "dolly",
      duration: 8.5,
      yaw: 0.7,
      inclination: 0.18,
      distance: 46,
      lead: -0.3,
      sketch: [{ kind: "ruler", length: 10 }],
      eq: "GM☉/c² ≈ 1.48 km    ·    GM☉/c³ ≈ 4.93 μs",
    },
    {
      phase: "detail",
      duration: 8,
      yaw: 0.55,
      inclination: 1.05,
      distance: 32,
      lift: 0.1,
      sketch: [{ kind: "rings", rings: ["horizon", "photon", "isco"] }],
    },
    {
      phase: "hold",
      duration: 7.5,
      yaw: -0.6,
      inclination: 0.22,
      distance: 26,
      swing: 0.2,
      sketch: [{ kind: "shadow" }],
    },
    { phase: "wide", duration: 9.5, yaw: 1.2, inclination: 0.5, distance: 128, lift: 0.25 },
  ],
};

/**
 * Messier 87*  —  catalog hole, Virgo cluster.
 *
 *   M ≈ 6.5e9 M☉     (EHT 2019)
 *   D = 16.8 Mpc
 *   a/M ≈ 0.9        not measured: EHT polarimetry favours magnetically arrested flows with
 *                   nonzero spin; ring asymmetry disfavours |a| ≲ 0.2 (arXiv:2601.00394);
 *                   a 2025 estimate gives a ≳ 0.8. A Blandford–Znajek jet needs spin.
 *   i_jet ≈ 17°      so this view is nearly face-on
 *
 * Shadow diameter on the sky (Schwarzschild estimate):
 *   d ≈ 10.4 GM / (c² D)  →  ≈ 40 μas; the observed ring (42–44 μas) sits ~5–10 % outside it
 * Coincidence with Sgr A*: M87* is ~1500× heavier and ~2000× farther.
 *
 * Jet (shader uJet): Blandford–Znajek sketch, P_BZ ∝ Ω_H² Φ².
 * Sky: old elliptical stellar halo (weather = m87).
 */
import type { HoleSpec } from "./types";

/** Elevation of the home view above the disk: the jet sits 90° − 1.27 rad ≈ 17° off our line of sight. */
const HOME_INCLINATION = 1.27;

export const m87: HoleSpec = {
  id: "m87",
  name: "Messier 87*",
  kind: "catalog",
  massSolar: 6.5e9,
  illustrativeFlow: true,
  spin: 0.9,
  inclination: HOME_INCLINATION,
  distance: 32,
  exposure: 0.95,
  diskBrightness: 0.9,
  starIntensity: 0.85,
  tempScale: 0.72,
  sky: "m87",
  jet: 1,
  aliases: ["m87", "m87-star", "messier-87", "powehi", "pōwehi"],
  tour: [
    {
      phase: "wide",
      duration: 9,
      yaw: 0.8,
      inclination: 0.4,
      distance: 134,
      lift: -0.15,
      lead: 0.4,
      eq: "M ≈ 6.5 × 10⁹ M☉    ·    D = 16.8 Mpc",
    },
    // A slow helix up along the jet.
    {
      phase: "dolly",
      duration: 11,
      yaw: 2,
      inclination: 0.92,
      distance: 60,
      lift: 0.1,
      lead: 0.2,
      roll: 0.035,
      drift: 0.012,
      sketch: [{ kind: "jet", angle: Math.PI / 2 - HOME_INCLINATION }],
      eq: "i_jet ≈ 17°    ·    P_BZ ∝ Ω_H² Φ²",
    },
    {
      phase: "detail",
      duration: 8.5,
      yaw: 0.6,
      inclination: 1.22,
      distance: 34,
      lead: -0.3,
      sketch: [{ kind: "shadow", assumed: true }],
      eq: "θ_crit = 6√3 GM / (c² D) ≈ 40 μas (a = 0)    ·    observed ring 42–44 μas",
    },
    {
      phase: "hold",
      duration: 7.5,
      yaw: -0.5,
      inclination: 1.3,
      distance: 30,
      swing: 0.2,
      roll: -0.03,
      eq: "θ_res ~ λ / D_Earth    at    λ = 1.3 mm",
    },
    {
      phase: "wide",
      duration: 10,
      yaw: 1.5,
      inclination: 0.48,
      distance: 150,
      lift: 0.2,
      lead: 0.3,
    },
  ],
};

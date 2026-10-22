/**
 * Messier 87*  —  catalog hole, Virgo cluster.
 *
 *   M ≈ 6.5e9 M☉     (EHT 2019; `BLACK_HOLES` in src/space/stellar.ts)
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
import { BLACK_HOLES } from "@/space/stellar";
import { RAD_PER_DEG } from "@horizon/toolkit/science";

import { OBSERVATORY } from "../catalogue";
import { figureArgs } from "../figures";
import { quote } from "../quote";
import type { HoleSpec } from "./types";

/** Elevation of the home view above the disk: 90° less the jet's angle to our line of sight. */
const HOME_INCLINATION = (90 - OBSERVATORY.m87.jetAngle.value) * RAD_PER_DEG;
/** The catalogue figures the equation lines quote, in their English. */
const EN = figureArgs("en");

export const m87: HoleSpec = {
  id: "m87",
  name: "Messier 87*",
  kind: "catalog",
  massSolar: BLACK_HOLES.m87.mass.value,
  illustrativeFlow: true,
  spin: BLACK_HOLES.m87.spin.value,
  inclination: HOME_INCLINATION,
  distance: 32,
  exposure: 0.95,
  diskBrightness: 0.9,
  starIntensity: 0.85,
  tempScale: 0.72,
  sky: "m87",
  jet: 1,
  tour: [
    {
      phase: "wide",
      duration: 9,
      yaw: 0.8,
      inclination: 0.4,
      distance: 134,
      lift: -0.15,
      lead: 0.4,
      eq: `M ≈ ${quote(BLACK_HOLES.m87.mass)}    ·    D = ${quote(BLACK_HOLES.m87.distance)}`,
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
      eq: `i_jet ≈ ${EN.m87JetDeg}°    ·    P_BZ ∝ Ω_H² Φ²`,
    },
    {
      phase: "detail",
      duration: 8.5,
      yaw: 0.6,
      inclination: 1.22,
      distance: 34,
      lead: -0.3,
      sketch: [{ kind: "shadow", assumed: true }],
      eq: `θ_crit = 6√3 GM / (c² D) ≈ ${EN.m87ShadowUas} μas (a = 0)    ·    observed ring ${EN.m87Ring2019Round}–${EN.m87RingRound} μas`,
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

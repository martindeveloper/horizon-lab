/**
 * Sagittarius A*  —  catalog hole, Galactic Centre.
 *
 * Geometric units G = c = 1. Lengths on screen are in M = GM/c².
 *   M = 4.297e6 M☉  (GRAVITY Collaboration, A&A 657 L12, 2022; `BLACK_HOLES` in src/space/stellar.ts)
 *   D = 8.277 kpc
 *   a/M ≈ 0.94      not measured: the only EHT model passing every test (EHT 2022 Paper V;
 *                   2024 Paper VIII, a = 0.94, i = 150°). Later work is split (arXiv:2509.22639
 *                   disfavours high spin; arXiv:2601.16267 finds it unconstrained).
 *   i ≈ 30°         adopted, model-dependent: EHT 2024 conditional fit (150° ≡ 30° from the axis), GRAVITY flares,
 *                   arXiv:2601.16267
 *
 * Shared radii (see physics.ts):
 *   r₊/M     = 1 + √(1 − a²)
 *   r_ph/M   = 2 (1 + cos(⅔ arccos(−a)))     prograde photon orbit
 *   r_ISCO/M = Bardeen, Press & Teukolsky 1972
 *
 * Angular size of the shadow on Earth:
 *   θ_shadow ≈ 6√3 GM / (c² D) ≈ 53 μas (Schwarzschild estimate)
 *
 * Sky: Milky Way nuclear cluster (shader weather = sgr). The star field is procedural;
 * S2 is not drawn at this near-horizon scale.
 */
import { BLACK_HOLES } from "@/space/stellar";

import { figureArgs } from "../figures";
import { quote } from "../quote";
import type { HoleSpec } from "./types";

const SGR_A = BLACK_HOLES["sgr-a"];
/** The catalogue figures the equation lines quote, in their English. */
const EN = figureArgs("en");

export const sgrA: HoleSpec = {
  id: "sgr-a",
  name: "Sagittarius A*",
  kind: "catalog",
  massSolar: SGR_A.mass.value,
  illustrativeFlow: true,
  spin: SGR_A.spin.value,
  inclination: 1.05,
  distance: 28,
  exposure: 1,
  diskBrightness: 1,
  starIntensity: 1.15,
  tempScale: 1,
  sky: "sgr",
  jet: 0,
  tour: [
    // Back away low through the cluster, turning against the usual direction and looking up
    // into the crowded sky: the hole sits off to one side of the nuclear star cluster.
    {
      phase: "wide",
      duration: 9.5,
      yaw: -1.1,
      inclination: 0.22,
      distance: 140,
      lift: 0.2,
      lead: -0.5,
      look: { yaw: 0.4, pitch: 0.12 },
      drift: -0.01,
      eq: `D = ${quote(SGR_A.distance)}    ·    M = ${quote(SGR_A.mass)}`,
    },
    // A long sweeping orbit that dips inward mid-way, like a star at pericentre.
    {
      phase: "dolly",
      duration: 10,
      yaw: 1.6,
      inclination: 0.62,
      distance: 56,
      swing: -0.15,
      lead: 0.6,
      roll: 0.04,
      sketch: [{ kind: "orbit", eccentricity: 0.88, periapsis: 7, tilt: 0.95, name: "S2" }],
      eq: `P² = 4π² a_S2³ / GM    ·    P = ${quote(SGR_A.companionPeriod)}`,
    },
    {
      phase: "detail",
      duration: 8,
      yaw: 0.4,
      inclination: 1.08,
      distance: 30,
      lift: 0.15,
      roll: -0.03,
      sketch: [{ kind: "shadow", assumed: true }],
      eq: `θ_crit = 6√3 GM / (c² D) ≈ ${EN.sgrShadowUas} μas (a = 0)    ·    ring ${EN.sgrRingPrecise} μas`,
    },
    {
      phase: "hold",
      duration: 8,
      yaw: -0.7,
      inclination: 0.3,
      distance: 27,
      swing: 0.25,
      lead: -0.3,
      eq: "L_Edd ≈ 1.3 × 10³⁸ (M/M☉) erg s⁻¹",
    },
    {
      phase: "wide",
      duration: 10,
      yaw: 1.3,
      inclination: 0.7,
      distance: 150,
      lift: 0.25,
      lead: 0.4,
    },
  ],
};

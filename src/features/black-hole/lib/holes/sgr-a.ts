/**
 * Sagittarius A*  —  catalog hole, Galactic Centre.
 *
 * Geometric units G = c = 1. Lengths on screen are in M = GM/c².
 *   M = 4.297e6 M☉  (GRAVITY Collaboration, A&A 657 L12, 2022)
 *   D = 8.277 kpc
 *   a/M ≈ 0.94      not measured: the only EHT model passing every test (EHT 2022 Paper V;
 *                   2024 Paper VIII, a = 0.94, i = 150°). Later work is split (arXiv:2509.22639
 *                   disfavours high spin; arXiv:2601.16267 finds it unconstrained).
 *   i ≈ 30°         near face-on: EHT 2024 (150° ≡ 30° from the axis), GRAVITY flares,
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
import type { HoleSpec } from "./types";

export const sgrA: HoleSpec = {
  id: "sgr-a",
  name: "Sagittarius A*",
  kind: "catalog",
  catalog: "ℓ ≈ 0°, b ≈ 0°",
  blurb:
    "Galactic Centre, 27,000 ly. You sit inside the nuclear star cluster; the plane of the Milky Way runs through the view.",
  massSolar: 4.297e6,
  spin: 0.94,
  inclination: 1.05,
  distance: 28,
  exposure: 1,
  diskBrightness: 1,
  starIntensity: 1.15,
  tempScale: 1,
  sky: "sgr",
  jet: 0,
  aliases: ["sgr-a", "sgra", "sagittarius-a", "sagittarius-a-star"],
  tour: [
    // Back away low through the cluster, turning against the usual direction.
    {
      duration: 9.5,
      yaw: -1.1,
      inclination: 0.22,
      distance: 140,
      lift: 0.2,
      lead: -0.5,
      drift: -0.01,
      eq: "D = 8.277 kpc    ·    M = 4.297 × 10⁶ M☉",
    },
    // A long sweeping orbit that dips inward mid-way, like a star at pericentre.
    {
      duration: 10,
      yaw: 1.6,
      inclination: 0.62,
      distance: 56,
      swing: -0.15,
      lead: 0.6,
      roll: 0.04,
      sketch: [{ kind: "orbit", eccentricity: 0.88, periapsis: 7, tilt: 0.95, name: "S2" }],
      eq: "P² = 4π² a_S2³ / GM    ·    P = 16.05 yr",
    },
    {
      duration: 8,
      yaw: 0.4,
      inclination: 1.08,
      distance: 30,
      lift: 0.15,
      roll: -0.03,
      sketch: [{ kind: "shadow", assumed: true }],
      eq: "θ_crit = 6√3 GM / (c² D) ≈ 53 μas (a = 0)    ·    ring 51.8 μas",
    },
    {
      duration: 8,
      yaw: -0.7,
      inclination: 0.3,
      distance: 27,
      swing: 0.25,
      lead: -0.3,
      eq: "L_Edd ≈ 1.3 × 10³⁸ (M/M☉) erg s⁻¹",
    },
    { duration: 10, yaw: 1.3, inclination: 0.7, distance: 150, lift: 0.25, lead: 0.4 },
  ],
};

/**
 * Cygnus X-1  —  catalog hole, stellar-mass HMXB.
 *
 *   D = 2.22 kpc                 Miller-Jones et al. 2021 VLBA parallax
 *   M ≈ 15 M☉ on the dial        21.2 ± 2.2 (2021); 13–18 (Ramachandran 2025)
 *   a/M ≈ 0.95      disputed; most methods find a > 0.9: continuum fitting > 0.9985 (Zhao 2021),
 *                   IXPE soft state ≳ 0.96 (Steiner 2024). Comptonised-reflection fits find it
 *                   low (Zdziarski 2024; Niedźwiecki 2026; XRISM, arXiv:2605.24664).
 *   i ≈ 27.5°       orbital inclination (Miller-Jones 2021)
 *   companion HDE 226868, O9.7 Iab
 *
 * Disk temperature at fixed Eddington ratio:
 *   T_max ∝ (Ṁ / M²)^(1/4) ∝ M^(−1/4)
 * So a 15 M☉ hole is ~23× hotter than Sgr A* at the same ṁ. X-rays, not UV.
 *
 * Scale in geometric units (same silhouette as Sgr A*):
 *   GM☉/c² ≈ 1.48 km, GM☉/c³ ≈ 4.93 μs
 *
 * Sky: Cygnus / Orion Spur (weather = cyg). The distant wind-feeding companion is not drawn at this scale.
 */
import type { HoleSpec } from "./types";

export const stellar: HoleSpec = {
  id: "stellar",
  name: "Cygnus X-1",
  kind: "catalog",
  massSolar: 15,
  massNote: "adopted",
  spin: 0.95,
  inclination: 1.09,
  distance: 26,
  exposure: 1.05,
  diskBrightness: 1.2,
  starIntensity: 1.2,
  tempScale: 1.85,
  sky: "cyg",
  jet: 0,
  aliases: ["stellar", "cygnus-x-1", "cyg-x-1", "cygnus"],
  tour: [
    {
      phase: "wide",
      duration: 9,
      yaw: 0.9,
      inclination: 0.32,
      distance: 122,
      lift: 0.25,
      lead: 0.3,
      eq: "M ≈ 13–23 M☉    ·    D = 2.22 kpc    ·    b ≈ +3°",
    },
    // Out and back in around the hole, the way the companion circles it.
    {
      phase: "dolly",
      duration: 10.5,
      yaw: 1.8,
      inclination: 0.6,
      distance: 54,
      swing: 0.25,
      lead: 0.5,
      roll: 0.03,
    },
    {
      phase: "detail",
      duration: 8.5,
      yaw: 0.6,
      inclination: 0.12,
      distance: 16,
      lift: 0.2,
      lead: -0.4,
      roll: -0.03,
      look: { yaw: 0.18, pitch: -0.05 },
      eq: "T_max ∝ (Ṁ / M²)^(1/4) ∝ M^(−1/4)   at fixed ṁ",
    },
    {
      phase: "hold",
      duration: 8,
      yaw: -0.5,
      inclination: 1.08,
      distance: 32,
      sketch: [
        { kind: "shadow", assumed: true },
        { kind: "ruler", length: 10 },
      ],
      eq: "GM☉/c² ≈ 1.48 km    ·    GM☉/c³ ≈ 4.93 μs",
    },
    {
      phase: "wide",
      duration: 10,
      yaw: 1.4,
      inclination: 0.42,
      distance: 140,
      lift: 0.2,
      swing: 0.1,
      eq: "E_GW ≈ 3 M☉ c²    ·    f_GW,ISCO ≈ 4.4 kHz × M☉/M_tot ≈ 70 Hz",
    },
  ],
};

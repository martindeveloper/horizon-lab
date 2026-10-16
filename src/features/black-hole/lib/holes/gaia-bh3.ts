/**
 * Gaia BH3  —  catalog hole, dormant, Aquila.
 *
 *   found by mid-2023 (ground spectra July–September 2023), announced 16 April 2024
 *   M = 32.70 ± 0.82 M☉   Gaia Collaboration (Panuzzo et al.), A&A 686, L2 (2024);
 *                         preliminary DR4 astrometry plus RVS and VLT/UVES spectra
 *   D = 590.6 ± 5.8 pc    ≈ 1,926 ly; second-closest known black hole after Gaia BH1
 *   a/M = 0               not measured: no accretion, no X-ray method applies
 *   companion             metal-poor red giant, 0.76 M☉, [Fe/H] ≈ −2.3 to −2.6
 *   orbit                 P = 4253 ± 99 d (11.6 yr), e = 0.729 ± 0.005; separation ≈ 4.4–28 au
 *   stream                ED-2, a disrupted ancient star cluster (Balbinot et al., A&A 687, L3, 2024)
 *   X-rays                none: Chandra L(2–10 keV) < 2.1 × 10²⁹ erg/s; eROSITA looser (Cappelluti et al. 2024)
 *
 * Dormant, so the disk is off (diskBrightness 0): only lensed starlight is drawn.
 * Sky: the Milky Way band (weather = cyg). The companion is not drawn at this scale.
 */
import type { HoleSpec } from "./types";

export const gaiaBh3: HoleSpec = {
  id: "gaia-bh3",
  name: "Gaia BH3",
  kind: "catalog",
  catalog: "ℓ ≈ 52°, b ≈ −3.5°",
  blurb: "A dormant 33 M☉ hole 1,926 ly away, found by the wobble of an old giant star.",
  massSolar: 32.7,
  spin: 0,
  inclination: 0.5,
  distance: 30,
  exposure: 1.1,
  diskBrightness: 0,
  starIntensity: 1.35,
  tempScale: 1,
  sky: "cyg",
  jet: 0,
  aliases: ["gaia-bh3", "gaiabh3", "bh3"],
  tour: [
    // A slow, level drift in from the star field: nothing glows, only the stars bend.
    {
      duration: 9.5,
      yaw: 0.8,
      inclination: 0.2,
      distance: 120,
      lift: 0.2,
      lead: 0.3,
      eq: "M = 32.7 ± 0.8 M☉    ·    D = 590.6 ± 5.8 pc",
    },
    // Trace the giant's long, stretched orbit.
    {
      duration: 10.5,
      yaw: 1.7,
      inclination: 0.7,
      distance: 70,
      swing: 0.2,
      lead: 0.5,
      roll: 0.03,
      sketch: [{ kind: "orbit", eccentricity: 0.73, periapsis: 9, tilt: 0.85, name: "★" }],
      eq: "P = 11.6 yr    ·    e = 0.73",
    },
    {
      duration: 8.5,
      yaw: 0.5,
      inclination: 0.35,
      distance: 26,
      lead: -0.3,
      sketch: [
        { kind: "shadow", assumed: true },
        { kind: "ruler", length: 10 },
      ],
      eq: "L_X(2–10 keV) < 2.1 × 10²⁹ erg s⁻¹",
    },
    { duration: 8.5, yaw: -0.7, inclination: 0.9, distance: 34, swing: 0.2, roll: -0.03 },
    { duration: 10, yaw: 1.3, inclination: 0.4, distance: 140, lift: 0.25, lead: -0.2 },
  ],
};

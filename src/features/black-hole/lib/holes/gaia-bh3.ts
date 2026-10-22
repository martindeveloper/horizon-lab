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
import { BLACK_HOLES } from "@/space/stellar";

import { figureArgs } from "../figures";
import { quote, quoteError } from "../quote";
import type { HoleSpec } from "./types";

const GAIA_BH3 = BLACK_HOLES["gaia-bh3"];
/** The catalogue figures the equation lines quote, in their English. */
const EN = figureArgs("en");

export const gaiaBh3: HoleSpec = {
  id: "gaia-bh3",
  name: "Gaia BH3",
  kind: "catalog",
  massSolar: GAIA_BH3.mass.value,
  spin: GAIA_BH3.spin.value,
  inclination: 0.5,
  distance: 30,
  exposure: 1.1,
  diskBrightness: 0,
  starIntensity: 1.35,
  tempScale: 1,
  sky: "cyg",
  jet: 0,
  tour: [
    // A slow, level drift in from the star field: nothing glows, only the stars bend.
    {
      phase: "wide",
      duration: 9.5,
      yaw: 0.8,
      inclination: 0.2,
      distance: 120,
      lift: 0.2,
      lead: 0.3,
      eq: `M = ${quoteError(GAIA_BH3.mass)}    ·    D = ${quoteError(GAIA_BH3.distance)}`,
    },
    // Trace the giant's long, stretched orbit.
    {
      phase: "dolly",
      duration: 10.5,
      yaw: 1.7,
      inclination: 0.7,
      distance: 70,
      swing: 0.2,
      lead: 0.5,
      roll: 0.03,
      sketch: [{ kind: "orbit", eccentricity: 0.73, periapsis: 9, tilt: 0.85, name: "★" }],
      eq: `P = ${quote(GAIA_BH3.companionPeriod)}    ·    e = ${EN.gaiaEccentricity}`,
    },
    {
      phase: "detail",
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
    {
      phase: "hold",
      duration: 8.5,
      yaw: -0.7,
      inclination: 0.9,
      distance: 34,
      swing: 0.2,
      roll: -0.03,
    },
    {
      phase: "wide",
      duration: 10,
      yaw: 1.3,
      inclination: 0.4,
      distance: 140,
      lift: 0.25,
      lead: -0.2,
    },
  ],
};

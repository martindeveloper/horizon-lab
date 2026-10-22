/**
 * ω Centauri  —  catalog candidate, intermediate-mass, Centaurus.
 *
 *   M ≥ 8,200 M☉     lower limit from seven fast central stars (Häberle et al., Nature 631, 285, 2024);
 *                    N-body comparisons favour ~39,000–47,000 M☉; > 50,000 disfavoured
 *   disputed         Jeans models plus pulsar accelerations prefer an extended remnant cluster,
 *                    any IMBH < 6,000 M☉ at 3σ (Bañares-Hernández et al., A&A 693, A104, 2025)
 *   D = 5.43 kpc     ≈ 17,700 ly (Baumgardt & Vasiliev 2021)
 *   a/M = 0          not measured
 *   v_esc ≈ 62 km/s  fastest star 113.0 ± 1.1 km/s on the sky (HST, 2002–2023)
 *   silent           no radio (ATCA, Mahida et al. 2026) or infrared (JWST, Chen et al. 2026) source;
 *                    MeerKAT + Parkes timing (arXiv:2603.21845) cannot exclude 10³–10⁴ M☉
 *
 * Mass on the dial is the lower limit. Dormant, so the disk is off: lensing only.
 * Sky: crowded old stars (weather = sgr).
 */
import { BLACK_HOLES } from "@/space/stellar";

import { OBSERVATORY } from "../catalogue";
import { figureArgs } from "../figures";
import { quote } from "../quote";
import type { HoleSpec } from "./types";

const OMEGA_CEN = BLACK_HOLES["omega-cen"];
/** The catalogue figures the equation lines quote, in their English. */
const EN = figureArgs("en");

export const omegaCen: HoleSpec = {
  id: "omega-cen",
  name: "ω Centauri",
  kind: "catalog",
  massSolar: OMEGA_CEN.mass.value,
  massLowerLimit: true,
  massNote: "bound",
  spin: OMEGA_CEN.spin.value,
  inclination: 0.7,
  distance: 30,
  exposure: 1.05,
  diskBrightness: 0,
  starIntensity: 1.5,
  tempScale: 1,
  sky: "sgr",
  jet: 0,
  tour: [
    // Sink slowly through the crowded core.
    {
      phase: "wide",
      duration: 10,
      yaw: -0.9,
      inclination: 0.3,
      distance: 130,
      lift: 0.3,
      lead: -0.4,
      drift: -0.008,
      eq: `D = ${quote(OMEGA_CEN.distance)}    ·    M_cluster ≈ ${quote({ ...OBSERVATORY.omegaCen.clusterMass, digits: 2 })}`,
    },
    // A long survey sweep, like twenty years of Hubble images.
    {
      phase: "dolly",
      duration: 10.5,
      yaw: 1.5,
      inclination: 0.75,
      distance: 60,
      swing: -0.12,
      lead: 0.5,
      roll: 0.03,
      eq: `v_esc ≈ ${EN.omegaEscapeKms} km/s    ·    v_max ≈ ${EN.omegaFastestKms} km/s`,
    },
    {
      phase: "detail",
      duration: 8.5,
      yaw: 0.45,
      inclination: 1.0,
      distance: 28,
      lead: -0.3,
      sketch: [
        { kind: "shadow", assumed: true },
        { kind: "ruler", length: 10 },
      ],
      eq: `M_• ≥ ${quote(OMEGA_CEN.mass)}    ·    models ≈ ${EN.omegaModelMass} M☉`,
    },
    {
      phase: "hold",
      duration: 8.5,
      yaw: -0.6,
      inclination: 0.25,
      distance: 30,
      swing: 0.25,
      roll: -0.03,
      eq: `M_• < ${EN.omegaLimitAgainst} M☉ (3σ, stars + pulsars)`,
    },
    {
      phase: "wide",
      duration: 10,
      yaw: 1.2,
      inclination: 0.55,
      distance: 145,
      lift: 0.2,
      lead: 0.3,
    },
  ],
};

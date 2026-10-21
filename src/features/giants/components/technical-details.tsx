import {
  SimulationTechnicalDetails,
  type TechnicalDetailsAccess,
} from "@/components/simulations/technical-details";
import { SOLAR_TEFF_K } from "@horizon/toolkit/science";

import { GIANTS_EQUATIONS } from "../lib/model/equations";
import { RUNG_IDS } from "../lib/model/rungs";
import {
  CONVECTIVE_BELOW_K,
  DIFFERENTIAL_ROTATION,
  GRANULE_SCALE_HEIGHTS,
  LENS_DISTANCE,
  MEAN_MOLECULAR_WEIGHT,
} from "../lib/parameters";
import specification from "../technical.json";

export function GiantsTechnicalDetails(access: TechnicalDetailsAccess) {
  return (
    <SimulationTechnicalDetails
      {...access}
      namespace="giants"
      specification={specification}
      equations={GIANTS_EQUATIONS}
      values={{
        bodies: RUNG_IDS.length,
        solarTeff: SOLAR_TEFF_K,
        mu: MEAN_MOLECULAR_WEIGHT,
        cellHeights: GRANULE_SCALE_HEIGHTS,
        convectiveK: CONVECTIVE_BELOW_K,
        differential: DIFFERENTIAL_ROTATION,
        lensDistance: LENS_DISTANCE,
      }}
    />
  );
}

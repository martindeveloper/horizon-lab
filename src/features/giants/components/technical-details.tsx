import { useLocale } from "next-intl";

import {
  SimulationTechnicalDetails,
  type TechnicalDetailsAccess,
} from "@/components/simulations/technical-details";
import { CONVECTIVE_BELOW_K } from "@/space/hr-diagram";
import { GRANULE_SCALE_HEIGHTS, MEAN_MOLECULAR_WEIGHT } from "@/space/sun/model/granulation";
import { SHADOW_PER_RS, SOLAR_TEFF_K, formatSignificant, pluralOf } from "@horizon/toolkit/science";

import { PROSE_FIGURES } from "../lib/model/catalogue";
import { GIANTS_EQUATIONS } from "../lib/model/equations";
import { RUNG_IDS } from "../lib/model/rungs";
import { DIFFERENTIAL_ROTATION, LENS_DISTANCE, TEASPOON_M3 } from "../lib/parameters";
import specification from "../technical";

/** A millilitre, m³: the teaspoon's volume as the notes word it. */
const ML_M3 = 1e-6;

export function GiantsTechnicalDetails(access: TechnicalDetailsAccess) {
  const locale = useLocale();
  return (
    <SimulationTechnicalDetails
      {...access}
      namespace="giants"
      specification={specification}
      equations={GIANTS_EQUATIONS}
      values={{
        bodies: RUNG_IDS.length,
        solarTeff: SOLAR_TEFF_K,
        mu: formatSignificant(MEAN_MOLECULAR_WEIGHT, locale, 3),
        cellHeights: formatSignificant(GRANULE_SCALE_HEIGHTS, locale, 2),
        cellHeightsPlural: pluralOf(locale, formatSignificant(GRANULE_SCALE_HEIGHTS, locale, 2)),
        convectiveK: CONVECTIVE_BELOW_K,
        differential: DIFFERENTIAL_ROTATION,
        lensDistance: LENS_DISTANCE,
        shadowPerRs: formatSignificant(SHADOW_PER_RS, locale, 2),
        teaspoonMl: TEASPOON_M3 / ML_M3,
      }}
      figures={PROSE_FIGURES}
    />
  );
}

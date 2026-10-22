import {
  SimulationTechnicalDetails,
  type TechnicalDetailsAccess,
} from "@/components/simulations/technical-details";
import { PROSE_FIGURES } from "@/space/sun/catalogue";
import { SUN_EQUATIONS } from "@/space/sun/equations";

import { PLACE_IDS } from "../lib/model/places";
import { VIEW_IDS } from "../lib/model/views";
import specification from "../technical";

export function SunTechnicalDetails(access: TechnicalDetailsAccess) {
  return (
    <SimulationTechnicalDetails
      {...access}
      namespace="sun"
      specification={specification}
      equations={SUN_EQUATIONS}
      values={{ views: VIEW_IDS.length, places: PLACE_IDS.length }}
      figures={PROSE_FIGURES}
    />
  );
}

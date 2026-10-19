import {
  SimulationTechnicalDetails,
  type TechnicalDetailsAccess,
} from "@/components/simulations/technical-details";

import { PROSE_FIGURES } from "../lib/model/catalogue";
import { ORRERY_EQUATIONS } from "../lib/model/equations";
import specification from "../technical.json";

export function OrreryTechnicalDetails(access: TechnicalDetailsAccess) {
  return (
    <SimulationTechnicalDetails
      {...access}
      namespace="orrery"
      specification={specification}
      equations={ORRERY_EQUATIONS}
      figures={PROSE_FIGURES}
    />
  );
}

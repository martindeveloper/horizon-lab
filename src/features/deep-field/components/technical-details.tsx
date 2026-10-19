import {
  SimulationTechnicalDetails,
  type TechnicalDetailsAccess,
} from "@/components/simulations/technical-details";

import { PROSE_FIGURES } from "../lib/model/catalogue";
import { DEEP_FIELD_EQUATIONS } from "../lib/model/equations";
import specification from "../technical.json";

export function DeepFieldTechnicalDetails(access: TechnicalDetailsAccess) {
  return (
    <SimulationTechnicalDetails
      {...access}
      namespace="deepField"
      specification={specification}
      equations={DEEP_FIELD_EQUATIONS}
      figures={PROSE_FIGURES}
    />
  );
}

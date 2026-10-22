import {
  SimulationTechnicalDetails,
  type TechnicalDetailsAccess,
} from "@/components/simulations/technical-details";

import { PROSE_FIGURES } from "../lib/model/catalogue";
import { VOYAGE_EQUATIONS } from "../lib/model/equations";
import specification from "../technical.json";

export function VoyageTechnicalDetails(access: TechnicalDetailsAccess) {
  return (
    <SimulationTechnicalDetails
      {...access}
      namespace="voyage"
      specification={specification}
      equations={VOYAGE_EQUATIONS}
      figures={PROSE_FIGURES}
    />
  );
}

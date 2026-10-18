import { SimulationTechnicalDetails } from "@/components/simulations/technical-details";

import { PROSE_FIGURES } from "../lib/model/catalogue";
import { DEEP_FIELD_EQUATIONS } from "../lib/model/equations";
import specification from "../technical.json";

export function DeepFieldTechnicalDetails() {
  return (
    <SimulationTechnicalDetails
      namespace="deepField"
      specification={specification}
      equations={DEEP_FIELD_EQUATIONS}
      figures={PROSE_FIGURES}
    />
  );
}

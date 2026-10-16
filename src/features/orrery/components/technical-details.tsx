import { SimulationTechnicalDetails } from "@/components/simulations/technical-details";

import { ORRERY_EQUATIONS } from "../lib/model/equations";
import { ORRERY_COPY } from "../lib/model/figures";
import specification from "../technical.json";

export function OrreryTechnicalDetails() {
  return (
    <SimulationTechnicalDetails
      namespace="orrery"
      specification={specification}
      equations={ORRERY_EQUATIONS}
      values={ORRERY_COPY}
    />
  );
}

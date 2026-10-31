import {
  SimulationTechnicalDetails,
  type TechnicalDetailsAccess,
} from "@/components/simulations/technical-details";

import { PROSE_FIGURES } from "../lib/model/catalogue";
import { AFTERGLOW_EQUATIONS } from "../lib/model/equations";
import specification from "../technical";

export function AfterglowTechnicalDetails(access: TechnicalDetailsAccess) {
  return (
    <SimulationTechnicalDetails
      {...access}
      namespace="afterglow"
      specification={specification}
      equations={AFTERGLOW_EQUATIONS}
      figures={PROSE_FIGURES}
    />
  );
}

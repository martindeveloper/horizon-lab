import {
  SimulationTechnicalDetails,
  type TechnicalDetailsAccess,
} from "@/components/simulations/technical-details";

import { BLACK_HOLE_EQUATIONS } from "../lib/equations";
import { BLACK_HOLE_COPY } from "../lib/parameters";
import specification from "../technical";

export function BlackHoleTechnicalDetails(access: TechnicalDetailsAccess) {
  return (
    <SimulationTechnicalDetails
      {...access}
      namespace="blackHole"
      specification={specification}
      equations={BLACK_HOLE_EQUATIONS}
      values={BLACK_HOLE_COPY}
    />
  );
}

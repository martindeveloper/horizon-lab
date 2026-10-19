import {
  SimulationTechnicalDetails,
  type TechnicalDetailsAccess,
} from "@/components/simulations/technical-details";

import { LINES } from "../lib/model/atoms";
import { SPECTROSCOPY_EQUATIONS } from "../lib/model/equations";
import specification from "../technical.json";

export function SpectroscopyTechnicalDetails(access: TechnicalDetailsAccess) {
  return (
    <SimulationTechnicalDetails
      {...access}
      namespace="spectroscopy"
      specification={specification}
      equations={SPECTROSCOPY_EQUATIONS}
      values={{ lines: LINES.length }}
    />
  );
}

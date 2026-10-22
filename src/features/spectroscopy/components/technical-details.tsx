import {
  SimulationTechnicalDetails,
  type TechnicalDetailsAccess,
} from "@/components/simulations/technical-details";

import { LINES } from "../lib/model/atoms";
import { PROSE_FIGURES, PROSE_TYPES } from "../lib/model/catalogue";
import { SPECTROSCOPY_EQUATIONS } from "../lib/model/equations";
import specification from "../technical";

export function SpectroscopyTechnicalDetails(access: TechnicalDetailsAccess) {
  return (
    <SimulationTechnicalDetails
      {...access}
      namespace="spectroscopy"
      specification={specification}
      equations={SPECTROSCOPY_EQUATIONS}
      values={{ lines: LINES.length, ...PROSE_TYPES }}
      figures={PROSE_FIGURES}
    />
  );
}

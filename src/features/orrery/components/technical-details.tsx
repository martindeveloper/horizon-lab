import { useLocale } from "next-intl";

import { SimulationTechnicalDetails } from "@/components/simulations/technical-details";

import { ORRERY_EQUATIONS } from "../lib/model/equations";
import specification from "../technical.json";
import { proseArgs } from "./format";

export function OrreryTechnicalDetails() {
  return (
    <SimulationTechnicalDetails
      namespace="orrery"
      specification={specification}
      equations={ORRERY_EQUATIONS}
      values={proseArgs(useLocale())}
    />
  );
}

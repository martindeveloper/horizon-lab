import { useTranslations } from "next-intl";

import { useSimulationDrift } from "@/components/simulations/drift";
import { SimulationRoot } from "@/components/simulations/simulation-root";

import { DRIFT } from "../lib/drift";
import { useAfterglow } from "../lib/store";
import { viewFromPath } from "../routing";
import { AfterglowCanvas } from "./canvas";
import { DriftCaption } from "./dock";
import { AfterglowOverlay } from "./overlay";

/** The store as the root and the address hold it: a module value, so the component passes no hook. */
const store = useAfterglow;

export function Afterglow() {
  const t = useTranslations("afterglow");
  const view = useAfterglow((s) => s.view);
  const driftState = useAfterglow((s) => s.drift);
  const drift = useSimulationDrift(driftState, store, DRIFT, <DriftCaption />);
  return (
    <SimulationRoot
      namespace="afterglow"
      store={store}
      views={{ store, fromPath: viewFromPath }}
      heading={t(`views.${view}`)}
      drift={drift}
      canvas={<AfterglowCanvas />}
      overlay={<AfterglowOverlay />}
    />
  );
}

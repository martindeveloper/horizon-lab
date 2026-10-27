import { useTranslations } from "next-intl";

import { useSimulationDrift } from "@/components/simulations/drift";
import { SimulationRoot } from "@/components/simulations/simulation-root";

import { DRIFT } from "../lib/drift";
import { useSun } from "../lib/store";
import { viewFromPath } from "../routing";
import { SunCanvas } from "./canvas";
import { SunOverlay } from "./overlay";

/** The store as the root and the address hold it: a module value, so the component passes no hook. */
const store = useSun;

/** The drift's one readout: the view and the light it is seen in. */
function DriftView() {
  const t = useTranslations("sun");
  const view = useSun((s) => s.view);
  const light = useSun((s) => s.light);
  return (
    <>
      {t(`views.${view}`)} · {t(`lights.${light}`)}
    </>
  );
}

export function Sun() {
  const t = useTranslations("sun");
  const view = useSun((s) => s.view);
  const drift = useSimulationDrift(
    useSun((s) => s.drift),
    store,
    DRIFT,
    <DriftView />,
  );
  return (
    <SimulationRoot
      namespace="sun"
      store={store}
      views={{ store, fromPath: viewFromPath }}
      heading={t(`views.${view}`)}
      tone="bright"
      drift={drift}
      canvas={<SunCanvas />}
      overlay={<SunOverlay />}
    />
  );
}

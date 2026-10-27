import { useFormatter, useTranslations } from "next-intl";

import { useSimulationDrift } from "@/components/simulations/drift";
import { SimulationRoot } from "@/components/simulations/simulation-root";

import { DRIFT } from "../lib/drift";
import { useOrrery } from "../lib/store";
import { viewFromPath } from "../routing";
import { OrreryCanvas } from "./canvas";
import { OrreryOverlay } from "./overlay";
import { SolarActivityNotice } from "./solar-activity-controls";
import { motionRateLabel } from "./time-dock";

/** The store as the root and the address hold it: a module value, so the component passes no hook. */
const store = useOrrery;

/** The drift's one readout: how fast the clock runs, since the planets' motion is what it shows. */
function DriftClock() {
  const t = useTranslations("orrery");
  const f = useFormatter();
  const rate = useOrrery((s) => s.driftRate);
  return (
    <>
      {t("hud.clockRate")} · {motionRateLabel(t, f, rate)}
    </>
  );
}

export function Orrery() {
  const t = useTranslations("orrery");
  const view = useOrrery((s) => s.view);
  const drift = useSimulationDrift(
    useOrrery((s) => s.drift),
    store,
    DRIFT,
    <DriftClock />,
  );
  return (
    <SimulationRoot
      namespace="orrery"
      store={store}
      views={{ store, fromPath: viewFromPath }}
      heading={t(`views.${view}`)}
      drift={drift}
      canvas={<OrreryCanvas />}
      overlay={<OrreryOverlay />}
    >
      <SolarActivityNotice />
    </SimulationRoot>
  );
}

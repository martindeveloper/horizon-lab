import { useTranslations } from "next-intl";

import { useSimulationDrift } from "@/components/simulations/drift";
import { SimulationRoot } from "@/components/simulations/simulation-root";

import { DRIFT } from "../lib/drift";
import { rungNameKey } from "../lib/model/names";
import { RUNG_IDS } from "../lib/model/rungs";
import { useGiants } from "../lib/store";
import { rungFromPath } from "../routing";
import { GiantsCanvas } from "./canvas";
import { GiantsOverlay } from "./overlay";

/** The store as the root and the address hold it: a module value, so the component passes no hook. */
const store = useGiants;

/** The drift's one readout: the body in focus, since the stage's names step aside in immersive view. */
function DriftBody() {
  const t = useTranslations("giants");
  const focus = useGiants((s) => s.focus);
  return <>{t(rungNameKey(RUNG_IDS[focus] ?? RUNG_IDS[0]!))}</>;
}

/** The store as the address sees it: a link to a rung flies there; climbing leaves the address be. */
export function Giants() {
  const drift = useSimulationDrift(
    useGiants((s) => s.drift),
    store,
    DRIFT,
    <DriftBody />,
  );
  return (
    <SimulationRoot
      namespace="giants"
      store={store}
      views={{ store, fromPath: rungFromPath }}
      drift={drift}
      canvas={<GiantsCanvas />}
      overlay={<GiantsOverlay />}
    />
  );
}

import { useLocale, useTranslations } from "next-intl";

import { useSimulationDrift } from "@/components/simulations/drift";
import { SimulationRoot } from "@/components/simulations/simulation-root";
import { formatAu } from "@/lib/facts";
import { LIGHT_YEAR_AU } from "@horizon/toolkit/science";

import { DRIFT } from "../lib/drift";
import { useDeepField } from "../lib/store";
import { viewFromPath } from "../routing";
import { DeepFieldCanvas } from "./canvas";
import { DeepFieldOverlay } from "./overlay";

/** The store as the root and the address hold it: a module value, so the component passes no hook. */
const store = useDeepField;

/** The drift's one readout: how far out the camera is, since the journey is up and down that scale. */
function DriftDistance() {
  const t = useTranslations("deepField");
  const locale = useLocale();
  const ly = useDeepField((s) => s.viewLy);
  const unit = useDeepField((s) => s.distanceUnit);
  const mode = useDeepField((s) => s.show.cosmicMode);
  return (
    <>
      {t("hud.distance")} · {formatAu(t, { unit, locale }, ly * LIGHT_YEAR_AU)}
      {ly >= 240e6 && ly <= 8e9 ? <> · {t(`atlas.modes.${mode}`)}</> : null}
    </>
  );
}

export function DeepField() {
  const t = useTranslations("deepField");
  const view = useDeepField((s) => s.view);
  const drift = useSimulationDrift(
    useDeepField((s) => s.drift),
    store,
    DRIFT,
    <DriftDistance />,
  );
  return (
    <SimulationRoot
      namespace="deepField"
      store={store}
      views={{ store, fromPath: viewFromPath }}
      heading={t(`views.${view}`)}
      drift={drift}
      canvas={<DeepFieldCanvas />}
      overlay={<DeepFieldOverlay />}
    />
  );
}

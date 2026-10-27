import { useTranslations } from "next-intl";

import { SimulationRoot } from "@/components/simulations/simulation-root";

import { useVoyage } from "../lib/store";
import { viewFromPath } from "../routing";
import { VoyageCanvas } from "./canvas";
import { VoyageOverlay } from "./overlay";

/** The store as the root and the address hold it: a module value, so the component passes no hook. */
const store = useVoyage;

export function Voyage() {
  const t = useTranslations("voyage");
  const view = useVoyage((s) => s.view);
  return (
    <SimulationRoot
      namespace="voyage"
      store={store}
      views={{ store, fromPath: viewFromPath }}
      heading={t(`views.${view}`)}
      canvas={<VoyageCanvas />}
      overlay={<VoyageOverlay />}
    />
  );
}

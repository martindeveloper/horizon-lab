import { useTranslations } from "next-intl";

import { SimulationRoot } from "@/components/simulations/simulation-root";

import { useSpectroscopy } from "../lib/store";
import { pathForView, viewFromPath } from "../routing";
import { SpectroscopyOverlay } from "./overlay";
import { Stage } from "./stage";
import { useGuideMotion } from "./use-guide-motion";

/** The store as the root and the address hold it: a module value, so the component passes no hook. */
const store = useSpectroscopy;

/** Leaving the simulation starts the next visit fresh, with new mystery cases dealt. */
const dealAgain = () => useSpectroscopy.getState().shuffleCases();

export function Spectroscopy() {
  const t = useTranslations("spectroscopy");
  const view = useSpectroscopy((s) => s.view);
  useGuideMotion();
  return (
    <SimulationRoot
      namespace="spectroscopy"
      store={store}
      /* The guide changes the view itself; the address follows it. */
      views={{ store, fromPath: viewFromPath, pathFor: pathForView }}
      heading={t(`views.${view}.title`)}
      onLeave={dealAgain}
      canvas={<Stage />}
      overlay={<SpectroscopyOverlay />}
    />
  );
}

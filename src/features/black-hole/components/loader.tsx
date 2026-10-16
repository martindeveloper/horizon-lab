import { useTranslations } from "next-intl";

import { SimulationLoading } from "@/components/simulations/loading";
import { LoadingOverlay } from "@horizon/toolkit/ui";

import { useBlackHole } from "../lib/store";

export function HorizonLoader() {
  const t = useTranslations("blackHole");
  const ready = useBlackHole((s) => s.skyReady);
  return (
    <LoadingOverlay ready={ready}>
      <SimulationLoading title={t("app")} />
    </LoadingOverlay>
  );
}

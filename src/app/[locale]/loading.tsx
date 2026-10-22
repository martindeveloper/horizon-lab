"use client";

import { useTranslations } from "next-intl";

import { SimulationLoading } from "@/components/simulations/loading";
import { CatalogueLoading } from "@/features/catalogue/loading";
import { usePathname } from "@/i18n/navigation";
import { simulationForPath } from "@/lib/simulations";
import { ANCHOR_IDS } from "@/lib/urls";

export default function RouteLoading() {
  const t = useTranslations();
  const simulation = simulationForPath(usePathname());
  return simulation ? (
    <main id={ANCHOR_IDS.mainContent} className="simulation-stage">
      <SimulationLoading title={t(`catalogue.${simulation.messageKey}.title`)} />
    </main>
  ) : (
    <CatalogueLoading />
  );
}

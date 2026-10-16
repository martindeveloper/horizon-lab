"use client";

import { useTranslations } from "next-intl";

import { SimulationLoading } from "@/components/simulations/loading";
import { CatalogueLoading } from "@/features/catalogue/loading";
import { usePathname } from "@/i18n/navigation";
import { simulationForPath } from "@/lib/simulations";

export default function RouteLoading() {
  const t = useTranslations();
  const simulation = simulationForPath(usePathname());
  return simulation ? (
    <main id="main-content" className="simulation-stage">
      <SimulationLoading title={t(`catalogue.${simulation.messageKey}.title`)} />
    </main>
  ) : (
    <CatalogueLoading />
  );
}

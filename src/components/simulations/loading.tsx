"use client";

import { useTranslations } from "next-intl";

import { LoadingScreen } from "@horizon/toolkit/ui";

export function SimulationLoading({ title, className }: { title?: string; className?: string }) {
  const t = useTranslations();
  return (
    <LoadingScreen
      title={title ?? t("loading.simulationTitle")}
      status={t("loading.simulationBody")}
      {...(className !== undefined ? { className } : {})}
    />
  );
}

/** The page's main landmark while a simulation's client chunk loads. */
export function SimulationLoadingPage({ title }: { title?: string }) {
  return (
    <main id="main-content" className="h-full">
      <SimulationLoading {...(title !== undefined ? { title } : {})} />
    </main>
  );
}

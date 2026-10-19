"use client";

import { useTranslations } from "next-intl";
import dynamic from "next/dynamic";

import { SimulationLoadingPage } from "@/components/simulations/loading";

// The lab computes its spectra in the browser; the layout keeps it mounted across views.
const Spectroscopy = dynamic(() => import("./spectroscopy").then((module) => module.Spectroscopy), {
  ssr: false,
  loading: SpectroscopyLoading,
});

export function SpectroscopyClient() {
  return <Spectroscopy />;
}

function SpectroscopyLoading() {
  const t = useTranslations("spectroscopy");
  return <SimulationLoadingPage title={t("app")} />;
}

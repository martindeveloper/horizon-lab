"use client";

import { useTranslations } from "next-intl";
import dynamic from "next/dynamic";

import { SimulationLoadingPage } from "@/components/simulations/loading";
import { WebGLGate } from "@/components/simulations/webgl-gate";

// Browser-derived store initialization and WebGL belong exclusively on the client.
// Keep this in the black-hole layout so navigation preserves the canvas and its state.
const Observatory = dynamic(() => import("./observatory").then((module) => module.Observatory), {
  ssr: false,
  loading: ObservatoryLoading,
});

export function ObservatoryClient() {
  return (
    <WebGLGate fallback={<ObservatoryLoading />}>
      <Observatory />
    </WebGLGate>
  );
}

function ObservatoryLoading() {
  const t = useTranslations("blackHole");
  return <SimulationLoadingPage title={t("app")} />;
}

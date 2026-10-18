"use client";

import { useTranslations } from "next-intl";
import dynamic from "next/dynamic";

import { SimulationLoadingPage } from "@/components/simulations/loading";
import { WebGLGate } from "@/components/simulations/webgl-gate";

// WebGL and the browser-derived store stay on the client; the layout keeps the scene mounted across views.
const DeepField = dynamic(() => import("./deep-field").then((module) => module.DeepField), {
  ssr: false,
  loading: DeepFieldLoading,
});

export function DeepFieldClient() {
  return (
    <WebGLGate fallback={<DeepFieldLoading />}>
      <DeepField />
    </WebGLGate>
  );
}

function DeepFieldLoading() {
  const t = useTranslations("deepField");
  return <SimulationLoadingPage title={t("app")} />;
}

"use client";

import { useTranslations } from "next-intl";
import dynamic from "next/dynamic";

import { SimulationLoadingPage } from "@/components/simulations/loading";
import { WebGLGate } from "@/components/simulations/webgl-gate";

// WebGL and the browser-derived store stay on the client; the layout keeps the scene mounted across views.
const Orrery = dynamic(() => import("./orrery").then((module) => module.Orrery), {
  ssr: false,
  loading: OrreryLoading,
});

export function OrreryClient() {
  return (
    <WebGLGate fallback={<OrreryLoading />}>
      <Orrery />
    </WebGLGate>
  );
}

function OrreryLoading() {
  const t = useTranslations("orrery");
  return <SimulationLoadingPage title={t("app")} />;
}

import { simulationLayout } from "@/components/simulations/simulation-layout";
import { SunApp } from "@/features/sun";
import { sunManifest } from "@/features/sun/manifest";
import { getSunMessages } from "@/features/sun/server";

import "@/features/sun/styles.css";
import "@horizon/toolkit/scene.css";

export default simulationLayout({
  manifest: sunManifest,
  App: SunApp,
  messages: getSunMessages,
});

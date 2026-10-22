import { simulationLayout } from "@/components/simulations/simulation-layout";
import { SunApp } from "@/features/sun";
import { getSunMessages } from "@/features/sun/server";

import "@/features/sun/styles.css";
import "@horizon/toolkit/scene.css";

export default simulationLayout({
  slug: "sun",
  feature: "sun",
  namespace: "sun",
  App: SunApp,
  messages: getSunMessages,
});

import { simulationLayout } from "@/components/simulations/simulation-layout";
import { VoyageApp } from "@/features/voyage";
import { getVoyageMessages } from "@/features/voyage/server";

import "@horizon/toolkit/scene.css";
import "@/features/voyage/styles.css";

export default simulationLayout({
  slug: "voyage",
  feature: "voyage",
  namespace: "voyage",
  App: VoyageApp,
  messages: getVoyageMessages,
});

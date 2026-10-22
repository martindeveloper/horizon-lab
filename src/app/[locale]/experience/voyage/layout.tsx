import { simulationLayout } from "@/components/simulations/simulation-layout";
import { VoyageApp } from "@/features/voyage";
import { voyageManifest } from "@/features/voyage/manifest";
import { getVoyageMessages } from "@/features/voyage/server";

import "@horizon/toolkit/scene.css";
import "@/features/voyage/styles.css";

export default simulationLayout({
  manifest: voyageManifest,
  App: VoyageApp,
  messages: getVoyageMessages,
});

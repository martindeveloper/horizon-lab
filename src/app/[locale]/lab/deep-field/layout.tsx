import { simulationLayout } from "@/components/simulations/simulation-layout";
import { DeepFieldApp } from "@/features/deep-field";
import { deepFieldManifest } from "@/features/deep-field/manifest";
import { getDeepFieldMessages } from "@/features/deep-field/server";

import "@horizon/toolkit/scene.css";
import "@/features/deep-field/styles.css";

export default simulationLayout({
  manifest: deepFieldManifest,
  App: DeepFieldApp,
  messages: getDeepFieldMessages,
});

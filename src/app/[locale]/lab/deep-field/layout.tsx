import { simulationLayout } from "@/components/simulations/simulation-layout";
import { DeepFieldApp } from "@/features/deep-field";
import { getDeepFieldMessages } from "@/features/deep-field/server";

import "@horizon/toolkit/scene.css";
import "@/features/deep-field/styles.css";

export default simulationLayout({
  slug: "deep-field",
  namespace: "deepField",
  App: DeepFieldApp,
  messages: getDeepFieldMessages,
});

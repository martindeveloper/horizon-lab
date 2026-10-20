import { simulationLayout } from "@/components/simulations/simulation-layout";
import { OrreryApp } from "@/features/orrery";
import { getOrreryMessages } from "@/features/orrery/server";

import "@horizon/toolkit/scene.css";
import "@/features/orrery/styles.css";

export default simulationLayout({
  slug: "orrery",
  namespace: "orrery",
  App: OrreryApp,
  messages: getOrreryMessages,
});

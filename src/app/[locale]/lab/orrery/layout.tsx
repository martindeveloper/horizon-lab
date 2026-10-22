import { simulationLayout } from "@/components/simulations/simulation-layout";
import { OrreryApp } from "@/features/orrery";
import { orreryManifest } from "@/features/orrery/manifest";
import { getOrreryMessages } from "@/features/orrery/server";

import "@horizon/toolkit/scene.css";
import "@/features/orrery/styles.css";

export default simulationLayout({
  manifest: orreryManifest,
  App: OrreryApp,
  messages: getOrreryMessages,
});

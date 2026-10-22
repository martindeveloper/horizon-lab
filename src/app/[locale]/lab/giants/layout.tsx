import { simulationLayout } from "@/components/simulations/simulation-layout";
import { GiantsApp } from "@/features/giants";
import { giantsManifest } from "@/features/giants/manifest";
import { getGiantsMessages } from "@/features/giants/server";

import "@/features/giants/styles.css";

export default simulationLayout({
  manifest: giantsManifest,
  App: GiantsApp,
  messages: getGiantsMessages,
});

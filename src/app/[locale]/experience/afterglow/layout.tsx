import { simulationLayout } from "@/components/simulations/simulation-layout";
import { AfterglowApp } from "@/features/afterglow";
import { afterglowManifest } from "@/features/afterglow/manifest";
import { getAfterglowMessages } from "@/features/afterglow/server";

import "@horizon/toolkit/scene.css";
import "@/features/afterglow/styles.css";

export default simulationLayout({
  manifest: afterglowManifest,
  App: AfterglowApp,
  messages: getAfterglowMessages,
});

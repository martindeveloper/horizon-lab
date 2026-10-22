import { simulationLayout } from "@/components/simulations/simulation-layout";
import { BlackHoleApp } from "@/features/black-hole";
import { blackHoleManifest } from "@/features/black-hole/manifest";
import { getBlackHoleMessages } from "@/features/black-hole/server";

import "@/features/black-hole/styles.css";

export default simulationLayout({
  manifest: blackHoleManifest,
  App: BlackHoleApp,
  messages: getBlackHoleMessages,
});

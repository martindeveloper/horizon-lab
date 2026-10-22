import { simulationLayout } from "@/components/simulations/simulation-layout";
import { SpectroscopyApp } from "@/features/spectroscopy";
import { spectroscopyManifest } from "@/features/spectroscopy/manifest";
import { getSpectroscopyMessages } from "@/features/spectroscopy/server";

import "@/features/spectroscopy/styles.css";

export default simulationLayout({
  manifest: spectroscopyManifest,
  App: SpectroscopyApp,
  messages: getSpectroscopyMessages,
});

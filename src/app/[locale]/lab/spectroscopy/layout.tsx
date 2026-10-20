import { simulationLayout } from "@/components/simulations/simulation-layout";
import { SpectroscopyApp } from "@/features/spectroscopy";
import { getSpectroscopyMessages } from "@/features/spectroscopy/server";

import "@/features/spectroscopy/styles.css";

export default simulationLayout({
  slug: "spectroscopy",
  namespace: "spectroscopy",
  App: SpectroscopyApp,
  messages: getSpectroscopyMessages,
});

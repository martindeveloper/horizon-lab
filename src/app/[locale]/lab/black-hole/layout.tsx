import { simulationLayout } from "@/components/simulations/simulation-layout";
import { BlackHoleApp } from "@/features/black-hole";
import { getBlackHoleMessages } from "@/features/black-hole/server";

import "@/features/black-hole/styles.css";

export default simulationLayout({
  slug: "black-hole",
  namespace: "blackHole",
  App: BlackHoleApp,
  messages: getBlackHoleMessages,
});

import { simulationLayout } from "@/components/simulations/simulation-layout";
import { GiantsApp } from "@/features/giants";
import { getGiantsMessages } from "@/features/giants/server";

import "@/features/giants/styles.css";

export default simulationLayout({
  slug: "giants",
  feature: "giants",
  namespace: "giants",
  App: GiantsApp,
  messages: getGiantsMessages,
});

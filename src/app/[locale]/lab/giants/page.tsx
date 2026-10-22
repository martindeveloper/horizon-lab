import { GIANTS_PATH } from "@/features/giants/manifest";
import { getGiantsMessages } from "@/features/giants/server";
import { simulationMetadata } from "@/lib/metadata";
import { SIMULATION_ASSETS } from "@/lib/urls";

export const generateMetadata = simulationMetadata({
  feature: "giants",
  path: GIANTS_PATH,
  messages: getGiantsMessages,
  image: SIMULATION_ASSETS.giants.social,
});

export default function GiantsPage() {
  return null;
}

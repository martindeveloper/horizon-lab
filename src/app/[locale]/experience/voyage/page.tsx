import { VOYAGE_PATH } from "@/features/voyage/manifest";
import { getVoyageMessages } from "@/features/voyage/server";
import { simulationMetadata } from "@/lib/metadata";
import { SIMULATION_ASSETS } from "@/lib/urls";

export const generateMetadata = simulationMetadata({
  feature: "voyage",
  path: VOYAGE_PATH,
  messages: getVoyageMessages,
  image: SIMULATION_ASSETS.voyage.social,
});

export default function VoyagePage() {
  return null;
}

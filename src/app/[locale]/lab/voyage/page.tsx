import { VOYAGE_PATH } from "@/features/voyage/manifest";
import { getVoyageMessages } from "@/features/voyage/server";
import { simulationMetadata } from "@/lib/metadata";

export const generateMetadata = simulationMetadata({
  feature: "voyage",
  path: VOYAGE_PATH,
  messages: getVoyageMessages,
  image: "/simulations/voyage/og.png",
});

export default function VoyagePage() {
  return null;
}

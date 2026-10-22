import { voyageManifest } from "@/features/voyage/manifest";
import { getVoyageMessages } from "@/features/voyage/server";
import { simulationMetadata } from "@/lib/metadata";

export const generateMetadata = simulationMetadata({
  manifest: voyageManifest,
  messages: getVoyageMessages,
});

export default function VoyagePage() {
  return null;
}

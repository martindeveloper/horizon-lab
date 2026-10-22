import { deepFieldManifest } from "@/features/deep-field/manifest";
import { getDeepFieldMessages } from "@/features/deep-field/server";
import { simulationMetadata } from "@/lib/metadata";

export const generateMetadata = simulationMetadata({
  manifest: deepFieldManifest,
  messages: getDeepFieldMessages,
});

export default function DeepFieldPage() {
  return null;
}

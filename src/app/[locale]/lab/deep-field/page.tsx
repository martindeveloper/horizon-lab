import { DEEP_FIELD_PATH, deepFieldManifest } from "@/features/deep-field/manifest";
import { getDeepFieldMessages } from "@/features/deep-field/server";
import { simulationMetadata } from "@/lib/metadata";

export const generateMetadata = simulationMetadata({
  path: DEEP_FIELD_PATH,
  messages: getDeepFieldMessages,
  image: deepFieldManifest.social,
});

export default function DeepFieldPage() {
  return null;
}

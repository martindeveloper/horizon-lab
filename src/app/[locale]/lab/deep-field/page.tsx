import { DEEP_FIELD_PATH } from "@/features/deep-field/manifest";
import { getDeepFieldMessages } from "@/features/deep-field/server";
import { simulationMetadata } from "@/lib/metadata";
import { SIMULATION_ASSETS } from "@/lib/urls";

export const generateMetadata = simulationMetadata({
  path: DEEP_FIELD_PATH,
  messages: getDeepFieldMessages,
  image: SIMULATION_ASSETS["deep-field"].social,
});

export default function DeepFieldPage() {
  return null;
}

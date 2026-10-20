import { DEEP_FIELD_PATH } from "@/features/deep-field/manifest";
import { getDeepFieldMessages } from "@/features/deep-field/server";
import { simulationMetadata } from "@/lib/metadata";

export const generateMetadata = simulationMetadata({
  path: DEEP_FIELD_PATH,
  messages: getDeepFieldMessages,
  image: "/simulations/deep-field/og.png",
});

export default function DeepFieldPage() {
  return null;
}

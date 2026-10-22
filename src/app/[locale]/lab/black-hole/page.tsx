import { blackHoleManifest } from "@/features/black-hole/manifest";
import { getBlackHoleMessages } from "@/features/black-hole/server";
import { simulationMetadata } from "@/lib/metadata";

export const generateMetadata = simulationMetadata({
  manifest: blackHoleManifest,
  messages: getBlackHoleMessages,
});

export default function BlackHolePage() {
  return null;
}

import { BLACK_HOLE_PATH, blackHoleManifest } from "@/features/black-hole/manifest";
import { getBlackHoleMessages } from "@/features/black-hole/server";
import { simulationMetadata } from "@/lib/metadata";

export const generateMetadata = simulationMetadata({
  path: BLACK_HOLE_PATH,
  messages: getBlackHoleMessages,
  image: blackHoleManifest.social,
});

export default function BlackHolePage() {
  return null;
}

import { ORRERY_PATH, orreryManifest } from "@/features/orrery/manifest";
import { getOrreryMessages } from "@/features/orrery/server";
import { simulationMetadata } from "@/lib/metadata";

export const generateMetadata = simulationMetadata({
  path: ORRERY_PATH,
  messages: getOrreryMessages,
  image: orreryManifest.social,
});

export default function OrreryPage() {
  return null;
}

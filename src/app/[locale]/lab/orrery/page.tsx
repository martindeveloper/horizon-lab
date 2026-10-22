import { orreryManifest } from "@/features/orrery/manifest";
import { getOrreryMessages } from "@/features/orrery/server";
import { simulationMetadata } from "@/lib/metadata";

export const generateMetadata = simulationMetadata({
  manifest: orreryManifest,
  messages: getOrreryMessages,
});

export default function OrreryPage() {
  return null;
}

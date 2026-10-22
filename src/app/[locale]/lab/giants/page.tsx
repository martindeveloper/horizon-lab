import { giantsManifest } from "@/features/giants/manifest";
import { getGiantsMessages } from "@/features/giants/server";
import { simulationMetadata } from "@/lib/metadata";

export const generateMetadata = simulationMetadata({
  manifest: giantsManifest,
  messages: getGiantsMessages,
});

export default function GiantsPage() {
  return null;
}

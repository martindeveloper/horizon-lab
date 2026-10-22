import { spectroscopyManifest } from "@/features/spectroscopy/manifest";
import { getSpectroscopyMessages } from "@/features/spectroscopy/server";
import { simulationMetadata } from "@/lib/metadata";

export const generateMetadata = simulationMetadata({
  manifest: spectroscopyManifest,
  messages: getSpectroscopyMessages,
});

export default function SpectroscopyPage() {
  return null;
}

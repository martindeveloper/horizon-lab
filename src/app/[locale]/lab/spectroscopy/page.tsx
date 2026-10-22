import { SPECTROSCOPY_PATH, spectroscopyManifest } from "@/features/spectroscopy/manifest";
import { getSpectroscopyMessages } from "@/features/spectroscopy/server";
import { simulationMetadata } from "@/lib/metadata";

export const generateMetadata = simulationMetadata({
  path: SPECTROSCOPY_PATH,
  messages: getSpectroscopyMessages,
  image: spectroscopyManifest.social,
});

export default function SpectroscopyPage() {
  return null;
}

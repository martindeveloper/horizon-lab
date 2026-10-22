import { SPECTROSCOPY_PATH } from "@/features/spectroscopy/manifest";
import { getSpectroscopyMessages } from "@/features/spectroscopy/server";
import { simulationMetadata } from "@/lib/metadata";
import { SIMULATION_ASSETS } from "@/lib/urls";

export const generateMetadata = simulationMetadata({
  path: SPECTROSCOPY_PATH,
  messages: getSpectroscopyMessages,
  image: SIMULATION_ASSETS.spectroscopy.social,
});

export default function SpectroscopyPage() {
  return null;
}

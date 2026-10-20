import { SPECTROSCOPY_PATH } from "@/features/spectroscopy/manifest";
import { getSpectroscopyMessages } from "@/features/spectroscopy/server";
import { simulationMetadata } from "@/lib/metadata";

export const generateMetadata = simulationMetadata({
  path: SPECTROSCOPY_PATH,
  messages: getSpectroscopyMessages,
  image: "/simulations/spectroscopy/og.png",
});

export default function SpectroscopyPage() {
  return null;
}

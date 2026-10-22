import { spectroscopyManifest } from "@/features/spectroscopy/manifest";
import { getSpectroscopyMessages } from "@/features/spectroscopy/server";
import { simulationMetadata } from "@/lib/metadata";
import { simulationStaticParams } from "@/lib/simulation-access";

export const dynamicParams = false;
export const generateStaticParams = simulationStaticParams(spectroscopyManifest);
export const generateMetadata = simulationMetadata({
  manifest: spectroscopyManifest,
  messages: getSpectroscopyMessages,
  viewTitle: (t, id) => t(`views.${id}.title`),
});

export default function ViewPage() {
  return null;
}

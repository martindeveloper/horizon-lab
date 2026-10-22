import { sunManifest } from "@/features/sun/manifest";
import { getSunMessages } from "@/features/sun/server";
import { simulationMetadata } from "@/lib/metadata";
import { simulationStaticParams } from "@/lib/simulation-access";

export const dynamicParams = false;
/* With the feature off no view is prerendered: every view answers not found, as the layout does. */
export const generateStaticParams = simulationStaticParams(sunManifest);
export const generateMetadata = simulationMetadata({
  manifest: sunManifest,
  messages: getSunMessages,
  viewTitle: (t, id) => t(`views.${id}`),
});

export default function SunViewPage() {
  return null;
}

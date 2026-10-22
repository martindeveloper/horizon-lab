import { voyageManifest } from "@/features/voyage/manifest";
import { getVoyageMessages } from "@/features/voyage/server";
import { simulationMetadata } from "@/lib/metadata";
import { simulationStaticParams } from "@/lib/simulation-access";

export const dynamicParams = false;
/* With the feature off no view is prerendered: every view answers not found, as the layout does. */
export const generateStaticParams = simulationStaticParams(voyageManifest);
export const generateMetadata = simulationMetadata({
  manifest: voyageManifest,
  messages: getVoyageMessages,
  viewTitle: (t, id) => t(`views.${id}`),
});

export default function ViewPage() {
  return null;
}

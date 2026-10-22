import { deepFieldManifest } from "@/features/deep-field/manifest";
import { getDeepFieldMessages } from "@/features/deep-field/server";
import { simulationMetadata } from "@/lib/metadata";
import { simulationStaticParams } from "@/lib/simulation-access";

export const dynamicParams = false;
export const generateStaticParams = simulationStaticParams(deepFieldManifest);
export const generateMetadata = simulationMetadata({
  manifest: deepFieldManifest,
  messages: getDeepFieldMessages,
  viewTitle: (t, id) => t(`views.${id}`),
});

export default function ViewPage() {
  return null;
}

import { afterglowManifest } from "@/features/afterglow/manifest";
import { getAfterglowMessages } from "@/features/afterglow/server";
import { simulationMetadata } from "@/lib/metadata";
import { simulationStaticParams } from "@/lib/simulation-access";

export const dynamicParams = false;
/* With the feature off no chapter is prerendered: every chapter answers not found, as the layout does. */
export const generateStaticParams = simulationStaticParams(afterglowManifest);
export const generateMetadata = simulationMetadata({
  manifest: afterglowManifest,
  messages: getAfterglowMessages,
  viewTitle: (t, id) => t(`views.${id}`),
});

export default function ViewPage() {
  return null;
}

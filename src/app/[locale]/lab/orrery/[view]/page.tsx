import { orreryManifest } from "@/features/orrery/manifest";
import { getOrreryMessages } from "@/features/orrery/server";
import { simulationMetadata } from "@/lib/metadata";
import { simulationStaticParams } from "@/lib/simulation-access";

export const dynamicParams = false;
export const generateStaticParams = simulationStaticParams(orreryManifest);
export const generateMetadata = simulationMetadata({
  manifest: orreryManifest,
  messages: getOrreryMessages,
  viewTitle: (t, id) => t(`views.${id}`),
});

export default function ViewPage() {
  return null;
}

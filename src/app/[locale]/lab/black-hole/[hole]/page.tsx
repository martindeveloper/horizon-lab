import { blackHoleManifest } from "@/features/black-hole/manifest";
import { getBlackHoleMessages } from "@/features/black-hole/server";
import { simulationMetadata } from "@/lib/metadata";
import { simulationStaticParams } from "@/lib/simulation-access";

export const dynamicParams = false;
export const generateStaticParams = simulationStaticParams(blackHoleManifest);
export const generateMetadata = simulationMetadata({
  manifest: blackHoleManifest,
  messages: getBlackHoleMessages,
  viewTitle: (t, id) => t(`presets.${id}`),
});

export default function HolePage() {
  return null;
}

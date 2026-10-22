import { giantsManifest } from "@/features/giants/manifest";
import { getGiantsMessages, rungNameKey } from "@/features/giants/server";
import { simulationMetadata } from "@/lib/metadata";
import { simulationStaticParams } from "@/lib/simulation-access";

export const dynamicParams = false;
/* With the feature off no rung is prerendered: every rung answers not found, as the layout does. */
export const generateStaticParams = simulationStaticParams(giantsManifest);
export const generateMetadata = simulationMetadata({
  manifest: giantsManifest,
  messages: getGiantsMessages,
  viewTitle: (t, id) => t(rungNameKey(id)),
});

export default function RungPage() {
  return null;
}

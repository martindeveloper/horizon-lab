import { FEATURES } from "@/config";
import { giantsManifest } from "@/features/giants/manifest";
import { pathForRung, resolveRung, rungRouteParams } from "@/features/giants/routing";
import { getGiantsMessages, rungNameKey } from "@/features/giants/server";
import { simulationMetadata } from "@/lib/metadata";

export const dynamicParams = false;
/* With the feature off no rung is prerendered: every rung answers not found, as the layout does. */
export const generateStaticParams = () => (FEATURES.giants ? rungRouteParams() : []);
export const generateMetadata = simulationMetadata({
  feature: "giants",
  messages: getGiantsMessages,
  image: giantsManifest.social,
  view: {
    param: giantsManifest.routes.param,
    resolve: resolveRung,
    pathFor: pathForRung,
    title: (t, id) => t(rungNameKey(id)),
  },
});

export default function RungPage() {
  return null;
}

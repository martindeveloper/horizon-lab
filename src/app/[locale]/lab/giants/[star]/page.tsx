import { FEATURES } from "@/config";
import { pathForRung, resolveRung, rungRouteParams } from "@/features/giants/routing";
import { getGiantsMessages, rungNameKey } from "@/features/giants/server";
import { simulationMetadata } from "@/lib/metadata";
import { SIMULATION_ASSETS } from "@/lib/urls";

export const dynamicParams = false;
/* With the feature off no rung is prerendered: every rung answers not found, as the layout does. */
export const generateStaticParams = () => (FEATURES.giants ? rungRouteParams() : []);
export const generateMetadata = simulationMetadata({
  feature: "giants",
  messages: getGiantsMessages,
  image: SIMULATION_ASSETS.giants.social,
  view: {
    param: "star",
    resolve: resolveRung,
    pathFor: pathForRung,
    title: (t, id) => t(rungNameKey(id)),
  },
});

export default function RungPage() {
  return null;
}

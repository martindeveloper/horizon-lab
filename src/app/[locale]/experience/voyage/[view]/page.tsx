import { FEATURES } from "@/config";
import { pathForView, resolveView, viewRouteParams } from "@/features/voyage/routing";
import { getVoyageMessages } from "@/features/voyage/server";
import { simulationMetadata } from "@/lib/metadata";
import { SIMULATION_ASSETS } from "@/lib/urls";

export const dynamicParams = false;
/* With the feature off no view is prerendered: every view answers not found, as the layout does. */
export const generateStaticParams = () => (FEATURES.voyage ? viewRouteParams() : []);
export const generateMetadata = simulationMetadata({
  feature: "voyage",
  messages: getVoyageMessages,
  image: SIMULATION_ASSETS.voyage.social,
  view: {
    param: "view",
    resolve: resolveView,
    pathFor: pathForView,
    title: (t, id) => t(`views.${id}`),
  },
});

export default function ViewPage() {
  return null;
}

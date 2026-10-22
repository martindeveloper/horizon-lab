import { FEATURES } from "@/config";
import { pathForView, resolveView, viewRouteParams } from "@/features/sun/routing";
import { getSunMessages } from "@/features/sun/server";
import { simulationMetadata } from "@/lib/metadata";
import { SIMULATION_ASSETS } from "@/lib/urls";

export const dynamicParams = false;
/* With the feature off no view is prerendered: every view answers not found, as the layout does. */
export const generateStaticParams = () => (FEATURES.sun ? viewRouteParams() : []);
export const generateMetadata = simulationMetadata({
  feature: "sun",
  messages: getSunMessages,
  image: SIMULATION_ASSETS.sun.social,
  view: {
    param: "view",
    resolve: resolveView,
    pathFor: pathForView,
    title: (t, id) => t(`views.${id}`),
  },
});

export default function SunViewPage() {
  return null;
}

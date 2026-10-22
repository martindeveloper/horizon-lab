import { FEATURES } from "@/config";
import { sunManifest } from "@/features/sun/manifest";
import { pathForView, resolveView, viewRouteParams } from "@/features/sun/routing";
import { getSunMessages } from "@/features/sun/server";
import { simulationMetadata } from "@/lib/metadata";

export const dynamicParams = false;
/* With the feature off no view is prerendered: every view answers not found, as the layout does. */
export const generateStaticParams = () => (FEATURES.sun ? viewRouteParams() : []);
export const generateMetadata = simulationMetadata({
  feature: "sun",
  messages: getSunMessages,
  image: sunManifest.social,
  view: {
    param: sunManifest.routes.param,
    resolve: resolveView,
    pathFor: pathForView,
    title: (t, id) => t(`views.${id}`),
  },
});

export default function SunViewPage() {
  return null;
}

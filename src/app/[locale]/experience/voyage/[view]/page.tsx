import { FEATURES } from "@/config";
import { voyageManifest } from "@/features/voyage/manifest";
import { pathForView, resolveView, viewRouteParams } from "@/features/voyage/routing";
import { getVoyageMessages } from "@/features/voyage/server";
import { simulationMetadata } from "@/lib/metadata";

export const dynamicParams = false;
/* With the feature off no view is prerendered: every view answers not found, as the layout does. */
export const generateStaticParams = () => (FEATURES.voyage ? viewRouteParams() : []);
export const generateMetadata = simulationMetadata({
  feature: "voyage",
  messages: getVoyageMessages,
  image: voyageManifest.social,
  view: {
    param: voyageManifest.routes.param,
    resolve: resolveView,
    pathFor: pathForView,
    title: (t, id) => t(`views.${id}`),
  },
});

export default function ViewPage() {
  return null;
}

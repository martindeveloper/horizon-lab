import { deepFieldManifest } from "@/features/deep-field/manifest";
import { pathForView, resolveView, viewRouteParams } from "@/features/deep-field/routing";
import { getDeepFieldMessages } from "@/features/deep-field/server";
import { simulationMetadata } from "@/lib/metadata";

export const dynamicParams = false;
export const generateStaticParams = viewRouteParams;
export const generateMetadata = simulationMetadata({
  messages: getDeepFieldMessages,
  image: deepFieldManifest.social,
  view: {
    param: deepFieldManifest.routes.param,
    resolve: resolveView,
    pathFor: pathForView,
    title: (t, id) => t(`views.${id}`),
  },
});

export default function ViewPage() {
  return null;
}

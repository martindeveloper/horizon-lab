import { orreryManifest } from "@/features/orrery/manifest";
import { pathForView, resolveView, viewRouteParams } from "@/features/orrery/routing";
import { getOrreryMessages } from "@/features/orrery/server";
import { simulationMetadata } from "@/lib/metadata";

export const dynamicParams = false;
export const generateStaticParams = viewRouteParams;
export const generateMetadata = simulationMetadata({
  messages: getOrreryMessages,
  image: orreryManifest.social,
  view: {
    param: orreryManifest.routes.param,
    resolve: resolveView,
    pathFor: pathForView,
    title: (t, id) => t(`views.${id}`),
  },
});

export default function ViewPage() {
  return null;
}

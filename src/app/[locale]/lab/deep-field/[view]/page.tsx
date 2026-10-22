import { pathForView, resolveView, viewRouteParams } from "@/features/deep-field/routing";
import { getDeepFieldMessages } from "@/features/deep-field/server";
import { simulationMetadata } from "@/lib/metadata";
import { SIMULATION_ASSETS } from "@/lib/urls";

export const dynamicParams = false;
export const generateStaticParams = viewRouteParams;
export const generateMetadata = simulationMetadata({
  messages: getDeepFieldMessages,
  image: SIMULATION_ASSETS["deep-field"].social,
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

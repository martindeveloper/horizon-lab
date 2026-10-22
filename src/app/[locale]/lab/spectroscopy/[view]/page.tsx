import { pathForView, resolveView, viewRouteParams } from "@/features/spectroscopy/routing";
import { getSpectroscopyMessages } from "@/features/spectroscopy/server";
import { simulationMetadata } from "@/lib/metadata";
import { SIMULATION_ASSETS } from "@/lib/urls";

export const dynamicParams = false;
export const generateStaticParams = viewRouteParams;
export const generateMetadata = simulationMetadata({
  messages: getSpectroscopyMessages,
  image: SIMULATION_ASSETS.spectroscopy.social,
  view: {
    param: "view",
    resolve: resolveView,
    pathFor: pathForView,
    title: (t, id) => t(`views.${id}.title`),
  },
});

export default function ViewPage() {
  return null;
}

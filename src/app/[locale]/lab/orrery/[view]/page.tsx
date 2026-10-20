import { pathForView, resolveView, viewRouteParams } from "@/features/orrery/routing";
import { getOrreryMessages } from "@/features/orrery/server";
import { simulationMetadata } from "@/lib/metadata";

export const dynamicParams = false;
export const generateStaticParams = viewRouteParams;
export const generateMetadata = simulationMetadata({
  messages: getOrreryMessages,
  image: "/simulations/orrery/og.png",
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

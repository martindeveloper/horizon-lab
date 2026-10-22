import { pathForHole, resolveHole, presetRouteParams } from "@/features/black-hole/routing";
import { getBlackHoleMessages } from "@/features/black-hole/server";
import { simulationMetadata } from "@/lib/metadata";
import { SIMULATION_ASSETS } from "@/lib/urls";

export const dynamicParams = false;
export const generateStaticParams = presetRouteParams;
export const generateMetadata = simulationMetadata({
  messages: getBlackHoleMessages,
  image: SIMULATION_ASSETS["black-hole"].social,
  view: {
    param: "hole",
    resolve: resolveHole,
    pathFor: pathForHole,
    title: (t, id) => t(`presets.${id}`),
  },
});

export default function HolePage() {
  return null;
}

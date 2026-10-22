import { SUN_PATH } from "@/features/sun/manifest";
import { getSunMessages } from "@/features/sun/server";
import { simulationMetadata } from "@/lib/metadata";
import { SIMULATION_ASSETS } from "@/lib/urls";

export const generateMetadata = simulationMetadata({
  feature: "sun",
  path: SUN_PATH,
  messages: getSunMessages,
  image: SIMULATION_ASSETS.sun.social,
});

export default function SunPage() {
  return null;
}

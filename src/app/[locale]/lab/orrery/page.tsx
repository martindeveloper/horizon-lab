import { ORRERY_PATH } from "@/features/orrery/manifest";
import { getOrreryMessages } from "@/features/orrery/server";
import { simulationMetadata } from "@/lib/metadata";
import { SIMULATION_ASSETS } from "@/lib/urls";

export const generateMetadata = simulationMetadata({
  path: ORRERY_PATH,
  messages: getOrreryMessages,
  image: SIMULATION_ASSETS.orrery.social,
});

export default function OrreryPage() {
  return null;
}

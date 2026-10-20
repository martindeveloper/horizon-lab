import { ORRERY_PATH } from "@/features/orrery/manifest";
import { getOrreryMessages } from "@/features/orrery/server";
import { simulationMetadata } from "@/lib/metadata";

export const generateMetadata = simulationMetadata({
  path: ORRERY_PATH,
  messages: getOrreryMessages,
  image: "/simulations/orrery/og.png",
});

export default function OrreryPage() {
  return null;
}

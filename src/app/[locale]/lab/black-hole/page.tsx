import { BLACK_HOLE_PATH } from "@/features/black-hole/manifest";
import { getBlackHoleMessages } from "@/features/black-hole/server";
import { simulationMetadata } from "@/lib/metadata";
import { SIMULATION_ASSETS } from "@/lib/urls";

export const generateMetadata = simulationMetadata({
  path: BLACK_HOLE_PATH,
  messages: getBlackHoleMessages,
  image: SIMULATION_ASSETS["black-hole"].social,
});

export default function BlackHolePage() {
  return null;
}

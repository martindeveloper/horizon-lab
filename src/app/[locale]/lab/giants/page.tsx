import { GIANTS_PATH } from "@/features/giants/manifest";
import { getGiantsMessages } from "@/features/giants/server";
import { simulationMetadata } from "@/lib/metadata";

export const generateMetadata = simulationMetadata({
  feature: "giants",
  path: GIANTS_PATH,
  messages: getGiantsMessages,
  image: "/simulations/giants/og.png",
});

export default function GiantsPage() {
  return null;
}

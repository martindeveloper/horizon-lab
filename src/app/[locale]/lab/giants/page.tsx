import { GIANTS_PATH, giantsManifest } from "@/features/giants/manifest";
import { getGiantsMessages } from "@/features/giants/server";
import { simulationMetadata } from "@/lib/metadata";

export const generateMetadata = simulationMetadata({
  feature: "giants",
  path: GIANTS_PATH,
  messages: getGiantsMessages,
  image: giantsManifest.social,
});

export default function GiantsPage() {
  return null;
}

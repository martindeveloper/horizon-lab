import { SUN_PATH, sunManifest } from "@/features/sun/manifest";
import { getSunMessages } from "@/features/sun/server";
import { simulationMetadata } from "@/lib/metadata";

export const generateMetadata = simulationMetadata({
  feature: "sun",
  path: SUN_PATH,
  messages: getSunMessages,
  image: sunManifest.social,
});

export default function SunPage() {
  return null;
}

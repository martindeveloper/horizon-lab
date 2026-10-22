import { sunManifest } from "@/features/sun/manifest";
import { getSunMessages } from "@/features/sun/server";
import { simulationMetadata } from "@/lib/metadata";

export const generateMetadata = simulationMetadata({
  manifest: sunManifest,
  messages: getSunMessages,
});

export default function SunPage() {
  return null;
}

import { afterglowManifest } from "@/features/afterglow/manifest";
import { getAfterglowMessages } from "@/features/afterglow/server";
import { simulationMetadata } from "@/lib/metadata";

export const generateMetadata = simulationMetadata({
  manifest: afterglowManifest,
  messages: getAfterglowMessages,
});

export default function AfterglowPage() {
  return null;
}

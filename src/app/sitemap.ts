import type { MetadataRoute } from "next";

import { siteUrl } from "@/config";
import { sitePaths } from "@/lib/sitemap";

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = siteUrl();
  return sitePaths().map((path) => ({ url: new URL(path, origin).href }));
}

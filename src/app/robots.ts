import type { MetadataRoute } from "next";

import { siteUrl } from "@/config";
import { PAGE_URLS } from "@/lib/urls";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: PAGE_URLS.home },
    sitemap: new URL(PAGE_URLS.sitemap, siteUrl()).href,
  };
}

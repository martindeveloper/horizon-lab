import type { MetadataRoute } from "next";

import { PAGE_URLS, PUBLIC_ASSETS } from "@/lib/urls";

import messages from "../messages/en.json";

// English like the rest of the share metadata; the cookie picks the UI language.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: messages.app,
    short_name: messages.app,
    description: messages.metadataDescription,
    start_url: PAGE_URLS.home,
    display: "standalone",
    background_color: "#08080b",
    theme_color: "#08080b",
    icons: [
      { src: PUBLIC_ASSETS.favicon, sizes: "any", type: "image/svg+xml" },
      { src: PUBLIC_ASSETS.icon192, sizes: "192x192", type: "image/png" },
      { src: PUBLIC_ASSETS.icon512, sizes: "512x512", type: "image/png" },
      { src: PUBLIC_ASSETS.icon512, sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

import type { MetadataRoute } from "next";

import messages from "../messages/en.json";

// English like the rest of the share metadata; the cookie picks the UI language.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: messages.app,
    short_name: messages.app,
    description: messages.metadataDescription,
    start_url: "/",
    display: "standalone",
    background_color: "#08080b",
    theme_color: "#08080b",
    icons: [
      { src: "/favicon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

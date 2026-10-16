import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

import { localeRewrites, siteRedirects } from "./src/lib/redirects";

const nextConfig: NextConfig = {
  reactCompiler: true,
  transpilePackages: ["@horizon/toolkit"],
  experimental: { globalNotFound: true },
  turbopack: {
    rules: {
      "*.glsl": { loaders: ["@horizon/toolkit/shaders/loader"], as: "*.js" },
    },
  },
  async redirects() {
    return Array.from(siteRedirects(), ([source, destination]) => ({
      source,
      destination,
      permanent: true,
    }));
  },
  async rewrites() {
    return { beforeFiles: [], afterFiles: localeRewrites(), fallback: [] };
  },
};

export default createNextIntlPlugin("./src/i18n/request.ts")(nextConfig);

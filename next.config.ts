import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

import { localeRewrites, siteRedirects } from "./src/lib/redirects";

const nextConfig: NextConfig = {
  reactCompiler: true,
  transpilePackages: ["@horizon/toolkit"],
  experimental: { globalNotFound: true },
  // Vercel offers no NEXT_PUBLIC_ form of the deployment ID; bake it into both bundles.
  env: {
    NEXT_PUBLIC_DEPLOYMENT_ID:
      process.env.NEXT_PUBLIC_DEPLOYMENT_ID || process.env.VERCEL_DEPLOYMENT_ID || "",
  },
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

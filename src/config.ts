/**
 * Deployment settings. Each reads an environment variable and falls back to the
 * production value when it is unset or blank; `.env.example` lists them.
 * `NEXT_PUBLIC_` values are inlined into the browser bundle at build time, the
 * rest are read on the server only.
 */

/** An environment value, or `fallback` when it is unset or blank. */
function env(value: string | undefined, fallback: string) {
  return value?.trim() || fallback;
}

const withoutSlash = (url: string) => url.replace(/\/+$/, "");

/** A switch: `on`, `true`, `1` or `off`, `false`, `0`; anything else keeps `fallback`. */
function flag(value: string | undefined, fallback: boolean) {
  const word = value?.trim().toLowerCase() ?? "";
  if (["on", "true", "1"].includes(word)) return true;
  if (["off", "false", "0"].includes(word)) return false;
  return fallback;
}

/**
 * Where this build runs: `next dev`, a Vercel preview, or production. Vercel exposes
 * `NEXT_PUBLIC_VERCEL_ENV` to the build; without it a build counts as production.
 */
export const ENVIRONMENT: "development" | "preview" | "production" =
  process.env.NODE_ENV === "development"
    ? "development"
    : process.env.NEXT_PUBLIC_VERCEL_ENV === "preview"
      ? "preview"
      : "production";

/**
 * Developer tools: `Horizon.Debug` in the console and its stored overrides. On in
 * development and previews, off in production; `NEXT_PUBLIC_DEBUG` overrides either.
 */
export const DEBUG = flag(process.env.NEXT_PUBLIC_DEBUG, ENVIRONMENT !== "production");

/**
 * This build's deployment, for the update notice: Vercel's `VERCEL_DEPLOYMENT_ID`, passed
 * through `next.config.ts` (`NEXT_PUBLIC_DEPLOYMENT_ID` overrides it). Blank turns it off.
 */
export const DEPLOYMENT_ID = process.env.NEXT_PUBLIC_DEPLOYMENT_ID?.trim() ?? "";

/** Large static assets (music, maps): the `horizon-cdn` R2 bucket. */
export const CDN_URL = withoutSlash(
  env(process.env.NEXT_PUBLIC_CDN_URL, "https://cdn.horizonlab.observer"),
);

/** The source code, linked from the footer and the about page. */
export const REPOSITORY_URL = env(
  process.env.NEXT_PUBLIC_REPOSITORY_URL,
  "https://github.com/martindeveloper/horizon-lab",
);

/** Page-view and performance analytics (server only, decided at build). */
export const ANALYTICS = flag(process.env.ANALYTICS, true);

/**
 * Public origin for canonical URLs, robots and the sitemap (server only): `SITE_URL`,
 * then the Vercel project's production domain, then production.
 */
export function siteUrl(): URL {
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  return new URL(
    env(process.env.SITE_URL, vercel ? `https://${vercel}` : "https://horizon.martinpernica.xyz"),
  );
}

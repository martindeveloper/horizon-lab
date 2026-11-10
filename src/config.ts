import { DEPLOYMENT_URLS } from "./lib/urls.ts";
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

/** A simulation or part behind a feature switch. */
export type FeatureId = "voyage" | "giants" | "sun" | "afterglow";

/**
 * A feature switch's value: on everywhere once `released`; before that, on in development
 * while the debug tools are on, off in previews and production. `override` (`on`/`off`)
 * decides either way.
 */
export function featureFlag(
  override: string | undefined,
  environment: typeof ENVIRONMENT,
  debug: boolean,
  released = false,
) {
  return flag(override, released || (environment === "development" && debug));
}

/**
 * Feature switches, by id. A feature that is off is not in the catalogue and its routes
 * answer not found, in every language. `NEXT_PUBLIC_FEATURE_<ID>` overrides a switch for
 * a build or a preview; `process.env` is read by its full name so the value is inlined.
 */
export const FEATURES: Readonly<Record<FeatureId, boolean>> = {
  voyage: featureFlag(process.env.NEXT_PUBLIC_FEATURE_VOYAGE, ENVIRONMENT, DEBUG, true),
  giants: featureFlag(process.env.NEXT_PUBLIC_FEATURE_GIANTS, ENVIRONMENT, DEBUG, true),
  sun: featureFlag(process.env.NEXT_PUBLIC_FEATURE_SUN, ENVIRONMENT, DEBUG, true),
  afterglow: featureFlag(process.env.NEXT_PUBLIC_FEATURE_AFTERGLOW, ENVIRONMENT, DEBUG, true),
};

/**
 * This build's deployment, for the update notice: Vercel's `VERCEL_DEPLOYMENT_ID`, passed
 * through `next.config.ts` (`NEXT_PUBLIC_DEPLOYMENT_ID` overrides it). Blank turns it off.
 */
export const DEPLOYMENT_ID = process.env.NEXT_PUBLIC_DEPLOYMENT_ID?.trim() ?? "";

/** Large static assets (music, maps): the `horizon-cdn` R2 bucket. */
export const CDN_URL = withoutSlash(env(process.env.NEXT_PUBLIC_CDN_URL, DEPLOYMENT_URLS.cdn));

/** The source code, linked from the footer and the about page. */
export const REPOSITORY_URL = env(
  process.env.NEXT_PUBLIC_REPOSITORY_URL,
  DEPLOYMENT_URLS.repository,
);

/** Page-view and performance analytics (server only, decided at build). */
export const ANALYTICS = flag(process.env.ANALYTICS, true);

/**
 * Public origin for canonical URLs, robots and the sitemap (server only): `SITE_URL`,
 * then the Vercel project's production domain, then production.
 */
export function siteUrl(): URL {
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  return new URL(env(process.env.SITE_URL, vercel ? `https://${vercel}` : DEPLOYMENT_URLS.site));
}

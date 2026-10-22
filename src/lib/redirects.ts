import { LOCALE_COOKIE, routing } from "../i18n/routing";
import { slugRoutes } from "./simulation-paths";
import type { SimulationManifest } from "./simulation-types";
import { registered } from "./simulations";
import { LEGACY_URLS, PAGE_URLS, creditUrl } from "./urls";

// Native Next.js redirect rules; Vercel handles these before serving pages.
// Old /en and /cs links keep their prefix here: those prerendered pages are served
// directly, and LocaleUrl then stores the language and drops the prefix.
export function siteRedirects(
  available: readonly SimulationManifest[] = registered,
): Map<string, string> {
  const redirects = new Map<string, string>();
  const add = (source: string, target: string) => {
    if (source === target) return;
    const previous = redirects.get(source);
    if (previous !== undefined && previous !== target)
      throw new Error(`Conflicting redirect ${source}`);
    redirects.set(source, target);
  };
  add(LEGACY_URLS.mapCredits, creditUrl("map-details"));
  add(LEGACY_URLS.scientificSources, creditUrl("source-details"));
  add(LEGACY_URLS.thirdPartyNotices, creditUrl("licence-texts"));
  for (const prefix of ["", ...routing.locales.map((locale) => `/${locale}`)]) {
    for (const { routes: definition } of available) {
      const slugs = slugRoutes(definition).redirects();
      const legacy = definition.legacy;
      // Native Next matchers see the encoded request pathname, including historical aliases.
      const sources = [...slugs].map(([slug, path]) => [encodeURIComponent(slug), path] as const);
      if (legacy?.rootAliases)
        for (const [slug, path] of sources) add(`${prefix}/${slug}`, `${prefix}${path}`);
      for (const old of legacy?.bases ?? []) {
        add(`${prefix}${old}`, `${prefix}${definition.base}`);
        for (const [slug, path] of sources) add(`${prefix}${old}/${slug}`, `${prefix}${path}`);
      }
      // Keep the published compatibility policy: aliases/default slugs redirect only where
      // the feature declares compatibility addresses or explicit aliases.
      if (
        legacy ||
        "aliases" in definition ||
        definition.entries.some((entry) => "aliases" in entry)
      )
        for (const [slug, path] of sources)
          add(`${prefix}${definition.base}/${slug}`, `${prefix}${path}`);
    }
  }
  return redirects;
}

// Checked after static files and before dynamic routes: a clean path resolves to
// the prerendered page of the cookie's locale, or the default locale. Paths that
// already name a locale (old links) and Next.js internals pass through untouched.
export function localeRewrites() {
  const page = `/:path((?!_next/|(?:${routing.locales.join("|")})(?:/|$)).+)`;
  const cookie = (locale: string) => [
    { type: "cookie" as const, key: LOCALE_COOKIE, value: locale },
  ];
  // On Vercel the router's data requests for the home page arrive as /index.rsc
  // and /index.segments/…; served the HTML instead, they would force a full page
  // load (stopping the music). Other pages keep the suffix inside :path.
  const rules = (locale: string) => [
    { source: "/index.rsc", destination: `/${locale}.rsc` },
    { source: "/index.segments/:segment*", destination: `/${locale}.segments/:segment*` },
    { source: PAGE_URLS.home, destination: `/${locale}` },
    { source: page, destination: `/${locale}/:path` },
  ];
  const others = routing.locales.filter((locale) => locale !== routing.defaultLocale);
  return [
    ...others.flatMap((locale) => rules(locale).map((rule) => ({ ...rule, has: cookie(locale) }))),
    ...rules(routing.defaultLocale),
  ];
}

import { BLACK_HOLE_PATH } from "../features/black-hole/manifest";
import { legacyPresetRedirects } from "../features/black-hole/routing";
import { ORRERY_PATH } from "../features/orrery/manifest";
import { legacyViewRedirects } from "../features/orrery/routing";
import { LOCALE_COOKIE, routing } from "../i18n/routing";
import { SIMULATION_PREFIX } from "./simulation-paths";

// Native Next.js redirect rules; Vercel handles these before serving pages.
// Old /en and /cs links keep their prefix here: those prerendered pages are served
// directly, and LocaleUrl then stores the language and drops the prefix.
export function siteRedirects(): Map<string, string> {
  const redirects = new Map<string, string>();
  const add = (source: string, target: string) => {
    if (source !== target) redirects.set(source, target);
  };
  const features = [
    [BLACK_HOLE_PATH, legacyPresetRedirects()],
    [ORRERY_PATH, legacyViewRedirects()],
  ] as const;
  for (const prefix of ["", ...routing.locales.map((locale) => `/${locale}`)]) {
    for (const [slug, path] of legacyPresetRedirects())
      add(`${prefix}/${slug}`, `${prefix}${path}`);
    for (const [base, slugs] of features) {
      // Simulations used to live at the root, before the shared prefix.
      const old = base.slice(SIMULATION_PREFIX.length);
      add(`${prefix}${old}`, `${prefix}${base}`);
      for (const [slug, path] of slugs) {
        add(`${prefix}${old}/${slug}`, `${prefix}${path}`);
        add(`${prefix}${base}/${slug}`, `${prefix}${path}`);
      }
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
    { source: "/", destination: `/${locale}` },
    { source: page, destination: `/${locale}/:path` },
  ];
  const others = routing.locales.filter((locale) => locale !== routing.defaultLocale);
  return [
    ...others.flatMap((locale) => rules(locale).map((rule) => ({ ...rule, has: cookie(locale) }))),
    ...rules(routing.defaultLocale),
  ];
}

import { defineRouting } from "next-intl/routing";

export const LOCALE_COOKIE = "NEXT_LOCALE";
const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

// URLs never carry the language. Static rewrites in next.config map each clean
// path to its prerendered /en or /cs page by reading the locale cookie.
export const routing = defineRouting({
  locales: ["en", "cs"],
  defaultLocale: "en",
  localePrefix: "never",
  localeDetection: false,
  localeCookie: { name: LOCALE_COOKIE, maxAge: LOCALE_COOKIE_MAX_AGE, sameSite: "lax" },
});
export type Locale = (typeof routing.locales)[number];

/** Set-Cookie value that selects a locale; the default locale clears the cookie. */
export function localeCookie(locale: Locale): string {
  return locale === routing.defaultLocale
    ? `${LOCALE_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`
    : `${LOCALE_COOKIE}=${locale}; Path=/; Max-Age=${LOCALE_COOKIE_MAX_AGE}; SameSite=Lax`;
}

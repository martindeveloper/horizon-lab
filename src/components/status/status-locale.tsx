import { LOCALE_COOKIE, routing, type Locale } from "@/i18n/routing";

/** The locale the cookie selects, or the default. */
export function cookieLocale(cookie: string): Locale {
  const value = new RegExp(`(?:^|;\\s*)${LOCALE_COOKIE}=([^;]*)`).exec(cookie)?.[1];
  return routing.locales.find((locale) => locale === value) ?? routing.defaultLocale;
}

// Global status pages sit outside the locale layout and are prerendered once.
// Before first paint the cookie sets <html lang>; CSS then hides the other copies.
const script = `(function(){var m=/(?:^|;\\s*)${LOCALE_COOKIE}=([^;]*)/.exec(document.cookie);var l=${JSON.stringify(routing.locales)};document.documentElement.lang=m&&l.indexOf(m[1])>=0?m[1]:${JSON.stringify(routing.defaultLocale)}})()`;
const css = `${routing.locales
  .map((locale) => `html[lang="${locale}"] [data-locale]:not([data-locale="${locale}"])`)
  .join(",")}{display:none}`;

export function StatusLocaleHead() {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: script }} />
      <style>{css}</style>
    </>
  );
}

/** Every locale's copy; only the one matching <html lang> is displayed. */
export function Localized({ copy }: { copy: Record<Locale, string> }) {
  return routing.locales.map((locale) => (
    <span key={locale} lang={locale} data-locale={locale}>
      {copy[locale]}
    </span>
  ));
}

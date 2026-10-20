/**
 * The languages Horizon is built in; the first is the default. No imports here:
 * next.config.ts reads this list through src/lib/redirects.ts, before next-intl loads.
 */
export const LOCALES = ["en", "cs"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

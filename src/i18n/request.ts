import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { notFound } from "next/navigation";

import { routing } from "./routing";

export default getRequestConfig(async ({ locale: override }) => {
  // Every localized server caller passes its build-time locale explicitly.
  const locale = override ?? routing.defaultLocale;
  if (!hasLocale(routing.locales, locale)) notFound();
  return {
    locale,
    timeZone: "UTC",
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});

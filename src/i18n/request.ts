import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { notFound } from "next/navigation";

import { routing } from "./routing";

export default getRequestConfig(async ({ locale: override }) => {
  // Every localized server caller passes its build-time locale explicitly.
  const locale = override ?? routing.defaultLocale;
  if (!hasLocale(routing.locales, locale)) notFound();
  // The status copy lives apart so the root error page, in every page's bundle, carries only it.
  const [shared, status] = await Promise.all([
    import(`../messages/${locale}.json`),
    import(`../messages/status/${locale}.json`),
  ]);
  return {
    locale,
    timeZone: "UTC",
    messages: { ...shared.default, ...status.default },
  };
});

import "server-only";
import type { Locale } from "@/i18n/routing";

export async function getOrreryMessages(locale: Locale) {
  return (await import(`./messages/${locale}.json`)).default;
}

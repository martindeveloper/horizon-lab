import "server-only";
import type { Locale } from "@/i18n/routing";
import { withSpaceCopy } from "@/space/server";

export { rungNameKey } from "./lib/model/names";

export async function getGiantsMessages(locale: Locale) {
  return withSpaceCopy(
    locale,
    import(`./messages/${locale}.json`).then((module) => module.default),
  );
}

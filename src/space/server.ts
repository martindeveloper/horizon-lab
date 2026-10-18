import "server-only";
import type { Locale } from "@/i18n/routing";

import { withSpaceMessages, type MessageTree } from "./messages";

/** A space simulation's messages, with the shared copy merged in. */
export async function withSpaceCopy<T extends MessageTree>(locale: Locale, own: Promise<T>) {
  const [space, messages] = await Promise.all([
    import(`./messages/${locale}.json`).then((module: { default: MessageTree }) => module.default),
    own,
  ]);
  return withSpaceMessages(space, messages);
}

/**
 * Copy the space simulations share (units, distance words, HUD chrome, the solar system's
 * names and orbit rows) is written once, in `messages/`, and merged under each simulation's
 * own namespace as its messages load: components read `t("names.mercury")` in either.
 */
import type { AbstractIntlMessages } from "next-intl";

export type MessageTree = AbstractIntlMessages;

/**
 * `own` over `space`, deeply; a key in both is a copy written twice, and an error. Typed as the
 * simulation's own messages: the shared keys come along beside them.
 */
export function withSpaceMessages<T extends MessageTree>(space: MessageTree, own: T): T;
export function withSpaceMessages(space: MessageTree, own: MessageTree): MessageTree {
  const merged: MessageTree = { ...space };
  for (const [key, value] of Object.entries(own)) {
    const shared = merged[key];
    if (shared === undefined) merged[key] = value;
    else if (typeof shared === "object" && typeof value === "object")
      merged[key] = withSpaceMessages(shared, value);
    else throw new Error(`Message "${key}" is in the shared space copy and the simulation's own`);
  }
  return merged;
}

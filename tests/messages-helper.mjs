import { readFileSync } from "node:fs";

import { registered } from "../src/lib/simulations.ts";
import { withSpaceMessages } from "../src/space/messages.ts";

const read = (path) => JSON.parse(readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8"));

/** A simulation's messages as its layout loads them: the shared space copy under its own. */
export const featureMessages = (feature, locale) =>
  withSpaceMessages(
    read(`space/messages/${locale}.json`),
    read(`features/${feature}/messages/${locale}.json`),
  );

/**
 * The catalog a layout hands its provider: the locale layout's shared messages, and under a
 * simulation's layout its own messages beside them in its namespace.
 */
export function layoutMessages(feature, locale) {
  const shared = { ...read(`messages/${locale}.json`), ...read(`messages/status/${locale}.json`) };
  if (!feature) return shared;
  /* Every registered simulation's copy is checked, whether or not its switch is on. */
  const { messageKey } = registered.find((simulation) => simulation.id === feature);
  return { ...shared, [messageKey]: featureMessages(feature, locale) };
}

export function leaves(value, prefix = "") {
  return Object.entries(value).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof child === "string" ? [[path, child]] : leaves(child, path);
  });
}

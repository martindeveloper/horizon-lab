import { readFileSync } from "node:fs";

import { simulations } from "../src/lib/simulations.ts";
import { withSpaceMessages } from "../src/space/messages.ts";

const read = (path) => JSON.parse(readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8"));

/** The simulations whose layouts merge the shared space copy under their own messages. */
const SPACE = new Set(["orrery", "deep-field"]);

/** A simulation's messages as its layout loads them: the space copy under its own, for a space one. */
export const featureMessages = (feature, locale) => {
  const own = read(`features/${feature}/messages/${locale}.json`);
  return SPACE.has(feature) ? withSpaceMessages(read(`space/messages/${locale}.json`), own) : own;
};

/**
 * The catalog a layout hands its provider: the locale layout's shared messages, and under a
 * simulation's layout its own messages beside them in its namespace.
 */
export function layoutMessages(feature, locale) {
  const shared = read(`messages/${locale}.json`);
  if (!feature) return shared;
  const { messageKey } = simulations.find((simulation) => simulation.id === feature);
  return { ...shared, [messageKey]: featureMessages(feature, locale) };
}

export function leaves(value, prefix = "") {
  return Object.entries(value).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof child === "string" ? [[path, child]] : leaves(child, path);
  });
}

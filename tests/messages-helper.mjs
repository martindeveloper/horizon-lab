import { readFileSync } from "node:fs";

import { withSpaceMessages } from "../src/space/messages.ts";

const read = (path) => JSON.parse(readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8"));

/** A space simulation's messages as its layout loads them: its own over the shared copy. */
export const featureMessages = (feature, locale) =>
  withSpaceMessages(
    read(`space/messages/${locale}.json`),
    read(`features/${feature}/messages/${locale}.json`),
  );

export function leaves(value, prefix = "") {
  return Object.entries(value).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof child === "string" ? [[path, child]] : leaves(child, path);
  });
}

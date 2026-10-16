import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
/**
 * The credits page: copy in both languages, every measured planet map
 * credited, and every package named with the licence its own package.json
 * declares.
 */
import test from "node:test";

import { MAPS } from "@horizon/toolkit/bodies";

import { routing } from "../src/i18n/routing.ts";
import { CREDITS, LICENCE_URLS } from "../src/lib/credits.ts";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");
const catalogs = Object.fromEntries(
  routing.locales.map((locale) => [locale, JSON.parse(read(`src/messages/${locale}.json`))]),
);
const items = CREDITS.flatMap((group) => group.items);
/** The page names licences as people read them; package.json uses SPDX ids. */
const spdx = (licence) => ({ "SIL OFL 1.1": "OFL-1.1" })[licence] ?? licence;

test("credits copy is complete and translated", () => {
  for (const [locale, messages] of Object.entries(catalogs)) {
    const copy = messages.credits;
    assert.ok(messages.shell.credits, locale);
    for (const group of CREDITS) {
      assert.ok(
        copy.groups[group.id]?.label && copy.groups[group.id]?.intro,
        `${locale} ${group.id}`,
      );
      for (const item of group.items) assert.ok(copy.items[item.id], `${locale} items.${item.id}`);
    }
  }
  const ids = new Set(items.map((item) => item.id));
  assert.equal(ids.size, items.length, "ids are unique");
  assert.deepEqual(Object.keys(catalogs.en.credits.items).sort(), [...ids].sort());
});

test("every measured planet map is credited with its licence", () => {
  const imagery = CREDITS.find((group) => group.id === "imagery").items;
  for (const [id, map] of Object.entries(MAPS)) {
    const match = imagery.find((item) => item.url === map.url);
    assert.ok(match, `${id}: ${map.url}`);
    assert.equal(match.licence, map.licence, id);
  }
  for (const item of items) {
    assert.equal(new URL(item.url).protocol, "https:", item.id);
    if (!["Public domain", "Cited"].includes(item.licence)) assert.ok(LICENCE_URLS[item.licence]);
  }
});

test("packages are named with the licence they declare, and every runtime dependency is credited", () => {
  const pkg = JSON.parse(read("package.json"));
  const declared = { ...pkg.dependencies, ...pkg.devDependencies };
  const credited = new Set();
  for (const item of items.filter((item) => item.package)) {
    assert.ok(declared[item.package], `${item.package} is a dependency`);
    const meta = JSON.parse(read(`node_modules/${item.package}/package.json`));
    assert.equal(meta.license, spdx(item.licence), item.package);
    credited.add(item.package);
    for (const sibling of item.covers ?? []) {
      const license = JSON.parse(read(`node_modules/${sibling}/package.json`)).license;
      assert.equal(license, spdx(item.licence), sibling);
      credited.add(sibling);
    }
  }
  for (const name of Object.keys(pkg.dependencies)) {
    if (name.startsWith("@horizon/")) continue;
    assert.ok(credited.has(name), `${name} is not on the credits page`);
  }
});

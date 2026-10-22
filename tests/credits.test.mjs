import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";

import { MAPS } from "@horizon/toolkit/bodies";

import { CREDITS, LICENCE_URLS } from "../src/lib/credits.ts";
import { SPACECRAFT } from "../src/space/spacecraft/models.ts";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");
const items = CREDITS.flatMap((group) => group.items);
/** The page names licences as people read them; package.json uses SPDX ids. */
const spdx = (licence) => ({ "SIL OFL 1.1": "OFL-1.1" })[licence] ?? licence;

test("distributed notices match dependencies and retain font and Feather terms verbatim", () => {
  execFileSync(process.execPath, ["--import", "tsx", "scripts/generate-credits.mjs", "--check"], {
    cwd: root,
  });
  const notices = JSON.parse(read("src/data/credits.generated.json"))
    .notices.map(({ title, text }) => `${title}\n${text}`)
    .join("\n");
  for (const name of [
    "lucide-react",
    "@fontsource-variable/bodoni-moda",
    "@fontsource-variable/ibm-plex-sans",
    "@fontsource/ibm-plex-mono",
  ]) {
    assert.ok(notices.includes(read(`node_modules/${name}/LICENSE`)), name);
  }
  assert.ok(items.some((item) => item.id === "feather" && item.licence === "MIT"));
  assert.ok(notices.includes(read("scripts/licenses/tanner-helland-LICENSE.txt")));
});

test("every measured planet map and spacecraft model is credited with its licence", () => {
  const imagery = CREDITS.find((group) => group.id === "imagery").items;
  for (const [id, map] of [...Object.entries(MAPS), ...Object.entries(SPACECRAFT)]) {
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
  // Workspace packages (the toolkit) declare runtime dependencies of their own.
  const workspaces = readdirSync(new URL("packages/", root)).map((name) =>
    JSON.parse(read(`packages/${name}/package.json`)),
  );
  const runtime = Object.assign({}, pkg.dependencies, ...workspaces.map((w) => w.dependencies));
  const declared = { ...runtime, ...pkg.devDependencies };
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
  for (const name of Object.keys(runtime)) {
    if (name.startsWith("@horizon/")) continue;
    assert.ok(credited.has(name), `${name} is not on the credits page`);
  }
});

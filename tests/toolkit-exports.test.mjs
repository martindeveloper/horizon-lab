import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import test from "node:test";

test("public toolkit entry points resolve to existing package exports", () => {
  const root = new URL("../packages/toolkit/", import.meta.url);
  const pkg = JSON.parse(readFileSync(new URL("package.json", root), "utf8"));
  for (const [entry, target] of Object.entries(pkg.exports)) {
    if (entry.includes("*")) continue;
    const specifier = entry === "." ? pkg.name : `${pkg.name}/${entry.slice(2)}`;
    const resolved = import.meta.resolve(specifier);
    assert.equal(resolved, new URL(target, root).href, specifier);
    assert.ok(existsSync(new URL(resolved)), specifier);
  }
});

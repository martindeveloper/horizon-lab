import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import test from "node:test";

test("toolkit exports resolve and its modules have no application or routing dependencies", () => {
  const root = new URL("../packages/toolkit/", import.meta.url);
  const pkg = JSON.parse(readFileSync(new URL("package.json", root), "utf8"));
  for (const target of Object.values(pkg.exports))
    if (!target.includes("*")) assert.ok(existsSync(new URL(target, root)), target);
  function scan(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = new URL(entry.name + (entry.isDirectory() ? "/" : ""), dir);
      if (entry.isDirectory()) scan(path);
      else if (/\.(ts|tsx)$/.test(entry.name)) {
        const source = readFileSync(path, "utf8");
        assert.doesNotMatch(
          source,
          /["']@\/|["']next(?:\/|["'])|["']next-intl|["']zustand/,
          path.href,
        );
        if (path.href.includes("/ui/"))
          assert.doesNotMatch(source, /from ["']three["']|\/rendering|\/shaders/, path.href);
        if (path.href.includes("/bench/"))
          assert.doesNotMatch(
            source,
            /from ["'](?:three|react)["']|\/rendering|\/shaders|\/ui|\/camera/,
            path.href,
          );
        if (path.href.includes("/bodies/"))
          assert.doesNotMatch(
            source,
            /from ["'](?:three|react)["']|\/rendering|\/shaders|\/ui|\/camera|\/audio/,
            path.href,
          );
      }
    }
  }
  scan(new URL("src/", root));
});

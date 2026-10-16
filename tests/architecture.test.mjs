import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { presetFromPath, presetRouteParams } from "../src/features/black-hole/routing.ts";
import { viewFromPath, viewRouteParams } from "../src/features/orrery/routing.ts";
import { getPathname } from "../src/i18n/navigation.ts";
import { routing } from "../src/i18n/routing.ts";
import { siteRedirects } from "../src/lib/redirects.ts";
import { SIMULATION_PREFIX, slugRoutes } from "../src/lib/simulation-paths.ts";
import { simulations, simulationForPath } from "../src/lib/simulations.ts";

const root = new URL("../", import.meta.url);
function files(dir) {
  if (dir instanceof URL) dir = fileURLToPath(dir);
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = join(dir, entry.name);
    return entry.isDirectory() ? files(file) : [file];
  });
}

test("catalogue registry has real routes, assets, and translated copy", () => {
  assert.equal(new Set(simulations.map((entry) => entry.id)).size, simulations.length);
  for (const simulation of simulations) {
    assert.ok(simulation.href.startsWith(`${SIMULATION_PREFIX}/`), "Simulations share one prefix");
    assert.ok(existsSync(new URL(`public${simulation.artwork}`, root)));
    assert.ok(existsSync(new URL(`src/app/[locale]${simulation.href}/page.tsx`, root)));
    assert.equal(simulationForPath(simulation.href)?.id, simulation.id);
    assert.equal(simulationForPath(`${simulation.href}/m87`)?.id, simulation.id);
    assert.equal(simulationForPath(`${simulation.href}-other`), undefined);
    for (const locale of routing.locales) {
      const messages = JSON.parse(readFileSync(new URL(`src/messages/${locale}.json`, root), "utf8"));
      const copy = messages.catalogue[simulation.messageKey];
      for (const key of ["title", "description", "open", ...simulation.highlights])
        assert.ok(copy[key]);
      for (const entry of simulation.entryPoints) {
        assert.ok(copy.entryPoints[entry.id].title);
        assert.ok(getPathname({ locale, href: entry.href }).startsWith(simulation.href));
      }
      assert.equal(
        messages.blackHole,
        undefined,
        "Feature copy must not be sent with the catalogue",
      );
      assert.equal(messages.pins, undefined);
      assert.equal(messages.orrery, undefined, "Feature copy must not be sent with the catalogue");
    }
  }
  assert.equal(simulationForPath("/"), undefined);
});

test("legacy redirects reach the new app without loops or catalogue collisions", () => {
  const redirects = siteRedirects();
  assert.equal(redirects.get("/m87"), "/lab/black-hole/m87");
  assert.equal(redirects.get("/lensed"), "/lab/black-hole");
  assert.equal(redirects.get("/lab/black-hole/lensed"), "/lab/black-hole");
  for (const path of ["/", "/lab/black-hole", "/lab/black-hole/m87", "/lab/orrery"])
    assert.equal(redirects.has(path), false, `${path} is a canonical page`);
  for (const { hole } of presetRouteParams()) {
    assert.equal(presetFromPath(`/lab/black-hole/${hole}`).id, hole);
    // Prerendering still runs under the internal /en and /cs segments.
    for (const locale of routing.locales)
      assert.equal(presetFromPath(`/${locale}/lab/black-hole/${hole}`).id, hole);
  }
  for (const { view } of viewRouteParams()) {
    assert.equal(viewFromPath(`/lab/orrery/${view}`), view);
    for (const locale of routing.locales)
      assert.equal(viewFromPath(`/${locale}/lab/orrery/${view}`), view);
  }
  for (const locale of routing.locales) {
    assert.equal(redirects.get(`/${locale}/lensed`), `/${locale}/lab/black-hole`);
    assert.equal(redirects.has(`/${locale}/lab/black-hole/m87`), false);
  }
  for (const [source, target] of redirects)
    assert.ok(target.replace(/^\/(?:en|cs)/, "").startsWith(`${SIMULATION_PREFIX}/`), source);
  for (const [source, target] of redirects) {
    const prefix = source.match(/^\/(?:en|cs)(?=\/)/)?.[0] ?? "";
    assert.ok(target.startsWith(`${prefix}/`), `${source} keeps its language`);
    assert.notEqual(source, target);
    assert.equal(redirects.has(target), false, `Redirect chain: ${source} -> ${target}`);
  }
});

test("pre-prefix simulation URLs redirect permanently to the prefixed routes", () => {
  const redirects = siteRedirects();
  const moved = [
    ["/black-hole", "/lab/black-hole"],
    ["/black-hole/m87", "/lab/black-hole/m87"],
    ["/black-hole/lensed", "/lab/black-hole"],
    ["/black-hole/powehi", "/lab/black-hole/m87"],
    ["/orrery", "/lab/orrery"],
    ["/orrery/giants", "/lab/orrery"],
    ["/orrery/galaxy", "/lab/orrery/galaxy"],
    ["/orrery/milky-way", "/lab/orrery/galaxy"],
    ["/lab/orrery/milky-way", "/lab/orrery/galaxy"],
  ];
  for (const locale of ["", ...routing.locales.map((locale) => `/${locale}`)])
    for (const [source, target] of moved)
      assert.equal(redirects.get(`${locale}${source}`), `${locale}${target}`, source);
  for (const { hole } of presetRouteParams())
    assert.equal(redirects.get(`/black-hole/${hole}`), `/lab/black-hole/${hole}`);
  for (const { view } of viewRouteParams())
    assert.equal(redirects.get(`/orrery/${view}`), `/lab/orrery/${view}`);
});

test("shared code and catalogue do not import a simulation's private runtime", () => {
  const dirs = ["src/components", "src/lib", "src/i18n", "src/features/catalogue", "src/app"];
  for (const dir of dirs) {
    for (const file of files(fileURLToPath(new URL(`${dir}/`, root)))) {
      if (!/\.(ts|tsx)$/.test(file)) continue;
      const source = readFileSync(file, "utf8");
      assert.doesNotMatch(
        source,
        /(?:from\s*|import\s*\()\s*["'][^"'\n]*features\/[^/"'\n]+\/(?:lib|hooks|components)\//,
        file,
      );
    }
  }
});

for (const feature of ["black-hole", "orrery"])
  test(`${feature}: technical documentation has localized prose and scientific references`, () => {
    const specification = JSON.parse(
      readFileSync(new URL(`src/features/${feature}/technical.json`, root), "utf8"),
    );
    assert.equal(specification.schemaVersion, 1);
    for (const reference of specification.references ?? []) {
      assert.ok(reference.title);
      assert.equal(new URL(reference.url).protocol, "https:");
    }
    assert.equal(
      new Set(specification.sections.map((section) => section.id)).size,
      specification.sections.length,
    );
    for (const locale of routing.locales) {
      const copy = JSON.parse(
        readFileSync(new URL(`src/features/${feature}/messages/${locale}.json`, root), "utf8"),
      ).technicalDetails;
      for (const id of specification.features) assert.ok(copy.features[id]);
      for (const section of specification.sections) {
        assert.ok(copy.sections[section.id].title);
        assert.ok(copy.sections[section.id].body);
        assert.ok(!("sources" in section));
      }
    }
  });

test("catalogue links never prefetch simulation bundles", () => {
  const source = readFileSync(new URL("src/features/catalogue/index.tsx", root), "utf8");
  const links = [...source.matchAll(/<Link\b[\s\S]*?>/g)];
  assert.ok(links.length > 0);
  for (const [link] of links) assert.match(link, /prefetch=\{false\}/);
});

test("slug routes resolve aliases, fall back to the default and list redirects", () => {
  const routes = slugRoutes({
    base: "/lab/demo",
    ids: ["home", "far", "near"],
    defaultId: "home",
    aliases: { distant: "far", gone: "missing" },
  });
  assert.equal(routes.resolve(undefined), "home");
  assert.equal(routes.resolve(" Distant "), "far");
  assert.equal(routes.resolve("gone"), null);
  assert.equal(routes.resolve("constructor"), null);
  assert.equal(routes.pathFor("home"), "/lab/demo");
  assert.equal(routes.pathFor("near"), "/lab/demo/near");
  assert.equal(routes.pathFor("unknown"), "/lab/demo");
  assert.equal(routes.fromPath("/cs/lab/demo/distant"), "far");
  assert.equal(routes.fromPath("/lab/demo/unknown"), "home");
  assert.deepEqual(routes.slugs(), ["far", "near"]);
  assert.deepEqual(
    [...routes.redirects()],
    [
      ["home", "/lab/demo"],
      ["far", "/lab/demo/far"],
      ["near", "/lab/demo/near"],
      ["distant", "/lab/demo/far"],
    ],
  );
});

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";

import { presetFromPath, presetRouteParams } from "../src/features/black-hole/routing.ts";
import {
  viewFromPath as deepViewFromPath,
  viewRouteParams as deepViewRouteParams,
} from "../src/features/deep-field/routing.ts";
import { viewFromPath, viewRouteParams } from "../src/features/orrery/routing.ts";
import { getPathname } from "../src/i18n/navigation.ts";
import { routing } from "../src/i18n/routing.ts";
import { siteRedirects } from "../src/lib/redirects.ts";
import { SIMULATION_PREFIX, slugRoutes } from "../src/lib/simulation-paths.ts";
import { simulations, simulationForPath } from "../src/lib/simulations.ts";

const root = new URL("../", import.meta.url);

test("catalogue routes resolve by path segment and entry points stay within their simulation", () => {
  assert.equal(new Set(simulations.map((entry) => entry.id)).size, simulations.length);
  for (const simulation of simulations) {
    assert.ok(simulation.href.startsWith(`${SIMULATION_PREFIX}/`), "Simulations share one prefix");
    assert.ok(existsSync(new URL(`public${simulation.artwork}`, root)));
    assert.ok(existsSync(new URL(`src/app/[locale]${simulation.href}/page.tsx`, root)));
    assert.equal(simulationForPath(simulation.href)?.id, simulation.id);
    assert.equal(simulationForPath(`${simulation.href}/m87`)?.id, simulation.id);
    assert.equal(simulationForPath(`${simulation.href}-other`), undefined);
    for (const locale of routing.locales) {
      for (const entry of simulation.entryPoints)
        assert.ok(getPathname({ locale, href: entry.href }).startsWith(simulation.href));
    }
  }
  assert.equal(simulationForPath("/"), undefined);
});

test("legacy redirects reach the new app without loops or catalogue collisions", () => {
  const redirects = siteRedirects();
  assert.equal(redirects.get("/m87"), "/lab/black-hole/m87");
  assert.equal(redirects.get("/lensed"), "/lab/black-hole");
  assert.equal(redirects.get("/lab/black-hole/lensed"), "/lab/black-hole");
  for (const path of [
    "/",
    "/lab/black-hole",
    "/lab/black-hole/m87",
    "/lab/orrery",
    "/lab/deep-field",
    "/lab/spectroscopy",
  ])
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
  for (const { view } of deepViewRouteParams()) {
    assert.equal(deepViewFromPath(`/lab/deep-field/${view}`), view);
    for (const locale of routing.locales)
      assert.equal(deepViewFromPath(`/${locale}/lab/deep-field/${view}`), view);
  }
  for (const locale of routing.locales) {
    assert.equal(redirects.get(`/${locale}/lensed`), `/${locale}/lab/black-hole`);
    assert.equal(redirects.has(`/${locale}/lab/black-hole/m87`), false);
  }
  const creditRedirects = new Map([
    ["/textures/orrery/CREDITS.md", "/credits#credits-map-details"],
    ["/SCIENTIFIC-SOURCES.txt", "/credits#credits-source-details"],
    ["/THIRD-PARTY-NOTICES.txt", "/credits#credits-licence-texts"],
  ]);
  for (const [source, target] of redirects) {
    if (creditRedirects.has(source)) assert.equal(target, creditRedirects.get(source));
    else assert.ok(target.replace(/^\/(?:en|cs)/, "").startsWith(`${SIMULATION_PREFIX}/`), source);
  }
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
    ["/orrery/oort", "/lab/orrery/oort"],
    ["/orrery/oort-cloud", "/lab/orrery/oort"],
    ["/lab/orrery/oort-cloud", "/lab/orrery/oort"],
  ];
  for (const locale of ["", ...routing.locales.map((locale) => `/${locale}`)])
    for (const [source, target] of moved)
      assert.equal(redirects.get(`${locale}${source}`), `${locale}${target}`, source);
  for (const { hole } of presetRouteParams())
    assert.equal(redirects.get(`/black-hole/${hole}`), `/lab/black-hole/${hole}`);
  for (const { view } of viewRouteParams())
    assert.equal(redirects.get(`/orrery/${view}`), `/lab/orrery/${view}`);
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

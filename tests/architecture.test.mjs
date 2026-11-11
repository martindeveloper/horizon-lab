import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import { getPathMatch } from "next/dist/shared/lib/router/utils/path-match.js";

import { custom, holeById } from "../src/features/black-hole/lib/holes/index.ts";
import { presetIdFromPath, presetRouteParams } from "../src/features/black-hole/routing.ts";
import {
  resolveView as resolveDeepView,
  viewFromPath as deepViewFromPath,
  viewRouteParams as deepViewRouteParams,
} from "../src/features/deep-field/routing.ts";
import { resolveView, viewFromPath, viewRouteParams } from "../src/features/orrery/routing.ts";
import { getPathname } from "../src/i18n/navigation.ts";
import { routing } from "../src/i18n/routing.ts";
import { siteRedirects } from "../src/lib/redirects.ts";
import {
  EXPERIENCE_PREFIX,
  SIMULATION_PREFIX,
  defineRoutes,
  slugRoutes,
} from "../src/lib/simulation-paths.ts";
import { registered, simulations, simulationForPath } from "../src/lib/simulations.ts";

const root = new URL("../", import.meta.url);

test("catalogue routes resolve by path segment and entry points stay within their simulation", () => {
  assert.equal(new Set(simulations.map((entry) => entry.id)).size, simulations.length);
  for (const simulation of simulations) {
    const prefix = simulation.kind === "lab" ? SIMULATION_PREFIX : EXPERIENCE_PREFIX;
    assert.ok(simulation.href.startsWith(`${prefix}/`), "Each shelf shares one prefix");
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

// The tile stacks the SVG once per listed layer, each showing only its group: a group left out
// never shows, and a listed id without a group shows the whole picture again.
test("artwork layers name every layer group of their SVG, in paint order", () => {
  for (const simulation of registered) {
    if (!simulation.artworkLayers) continue;
    const svg = readFileSync(new URL(`public${simulation.artwork}`, root), "utf8");
    const groups = [...svg.matchAll(/<g class="layer" id="layer-([\w-]+)">/g)].map((m) => m[1]);
    assert.deepEqual(
      simulation.artworkLayers.map(({ id }) => id),
      groups,
      simulation.id,
    );
    assert.ok(svg.includes(".layer:not(:target){display:none}"), simulation.id);
  }
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
    assert.equal(presetIdFromPath(`/lab/black-hole/${hole}`), hole);
    // Prerendering still runs under the internal /en and /cs segments.
    for (const locale of routing.locales)
      assert.equal(presetIdFromPath(`/${locale}/lab/black-hole/${hole}`), hole);
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
  const routes = slugRoutes(
    defineRoutes({
      base: "/lab/demo",
      param: "view",
      entries: [{ id: "home" }, { id: "far" }, { id: "near" }],
      defaultId: "home",
      aliases: { distant: "far" },
    }),
  );
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

test("lookup tables do not mistake Object prototype names for simulation IDs", () => {
  for (const name of ["constructor", "toString", "__proto__"]) {
    assert.equal(holeById(name), custom);
    assert.equal(resolveView(name), null);
    assert.equal(resolveDeepView(name), null);
  }
  assert.equal(resolveView("oort-cloud"), "oort");
});

test("route definitions reject ambiguous addresses, missing defaults and unresolved aliases", () => {
  const base = {
    base: "/lab/example",
    param: "object",
    defaultId: "home",
    entries: [{ id: "home" }, { id: "far", aliases: ["distant"] }],
  };
  const routes = slugRoutes(defineRoutes(base));
  assert.deepEqual(routes.params(), [{ object: "far" }]);
  assert.deepEqual(routes.paths(), ["/lab/example", "/lab/example/far"]);
  assert.equal(routes.resolve("distant"), "far");
  assert.throws(() => defineRoutes({ ...base, defaultId: "missing" }), /Unknown default route/);
  assert.throws(
    () => defineRoutes({ ...base, entries: [{ id: "home" }, { id: "home" }] }),
    /Duplicate route id/,
  );
  assert.throws(
    () => defineRoutes({ ...base, entries: [{ id: "home" }, { id: "far", aliases: ["home"] }] }),
    /Conflicting route alias/,
  );
  assert.throws(
    () => defineRoutes({ ...base, aliases: { distant: "home" } }),
    /Conflicting route alias/,
  );
  assert.throws(
    () => defineRoutes({ ...base, aliases: { distant: "missing" } }),
    /Unknown alias target/,
  );
  for (const slug of [
    ".",
    "..",
    "%2e%2e",
    "far away",
    "far/away",
    "far\\away",
    "far?away",
    "far#away",
    "far:away",
    "far*",
    " far",
    "Far",
    "ve\u0301ga",
  ])
    for (const entries of [[{ id: "home" }, { id: slug }], [{ id: "home", aliases: [slug] }]])
      assert.throws(() => defineRoutes({ ...base, entries }), /Invalid route slug/, slug);
  assert.throws(
    () => defineRoutes({ ...base, entries: [{ id: "home", closeUp: true }] }),
    /needs a body/,
  );
});

test("Unicode route IDs and historical aliases survive browser URL encoding", () => {
  const routes = slugRoutes(
    defineRoutes({
      base: "/lab/example",
      param: "star",
      defaultId: "home",
      entries: [{ id: "home" }, { id: "véga", aliases: ["hvězda"] }],
    }),
  );
  assert.equal(routes.pathFor("véga"), "/lab/example/v%C3%A9ga");
  assert.deepEqual(routes.params(), [{ star: "véga" }]);
  for (const locale of ["", "/en", "/cs"])
    for (const href of [routes.pathFor("véga"), "/lab/example/hvězda"]) {
      const pathname = new URL(`${locale}${href}`, "https://example.test").pathname;
      assert.equal(routes.fromPath(pathname), "véga");
    }
  assert.equal(routes.redirects().get("hvězda"), routes.pathFor("véga"));
  for (const malformed of ["%", "%E0%A4%A", "%252e%252e"])
    assert.equal(routes.fromPath(`/lab/example/${malformed}`), "home");
});

test("native redirects match encoded Unicode aliases without redirecting a canonical URL to itself", () => {
  const published = siteRedirects();
  for (const prefix of ["", "/en", "/cs"])
    for (const base of ["", "/black-hole", "/lab/black-hole"]) {
      const pathname = new URL(`${prefix}${base}/pōwehi`, "https://example.test").pathname;
      assert.equal(published.get(pathname), `${prefix}/lab/black-hole/m87`);
      assert.ok(getPathMatch(pathname)(pathname), "Next matches the encoded request pathname");
    }

  const manifest = {
    ...registered[0],
    routes: defineRoutes({
      base: "/lab/example",
      param: "star",
      defaultId: "home",
      entries: [{ id: "home" }, { id: "véga", aliases: ["hvězda"] }],
      legacy: { bases: ["/old-example"] },
    }),
  };
  const redirects = siteRedirects([manifest]);
  for (const prefix of ["", "/en", "/cs"]) {
    const target = `${prefix}/lab/example/v%C3%A9ga`;
    assert.equal(redirects.has(target), false, "an encoded canonical ID is not a redirect");
    for (const path of ["/lab/example/hvězda", "/old-example/hvězda", "/old-example/véga"]) {
      const pathname = new URL(`${prefix}${path}`, "https://example.test").pathname;
      const matches = [...redirects].filter(([source]) => getPathMatch(source)(pathname));
      assert.deepEqual(
        matches,
        [[pathname, target]],
        "exactly one native rule reaches the canonical URL",
      );
    }
  }
});

test("manifests derive entry points and assets from their route and feature identities", async () => {
  const { defineSimulation } = await import("../src/lib/simulation-manifest.ts");
  const define = (defaultId) =>
    defineSimulation({
      id: "example",
      kind: "lab",
      messageKey: "example",
      socialSubtitle: "Example",
      highlights: [],
      routes: defineRoutes({
        base: "/lab/example",
        param: "view",
        defaultId,
        entries: [{ id: "home" }, { id: "far" }],
      }),
      entryPoints: [
        { id: "start", view: "home" },
        { id: "distant", view: "far" },
      ],
    });
  const manifest = define("home");
  assert.equal(manifest.href, "/lab/example");
  assert.equal(manifest.artwork, "/simulations/example.svg");
  assert.equal(manifest.social, "/simulations/example/og.png");
  assert.deepEqual(manifest.entryPoints, [
    { id: "start", href: "/lab/example" },
    { id: "distant", href: "/lab/example/far" },
  ]);
  assert.deepEqual(define("far").entryPoints, [
    { id: "start", href: "/lab/example/home" },
    { id: "distant", href: "/lab/example" },
  ]);
  assert.throws(
    () =>
      defineSimulation({
        ...manifest,
        entryPoints: [{ id: "bad", view: "missing" }],
      }),
    /Unknown entry point view/,
  );
});

test("a new declared route reaches the sitemap and body links without another registry entry", async () => {
  const { bodyDestinations } = await import("../src/lib/body-destinations.ts");
  const { sitePaths } = await import("../src/lib/sitemap.ts");
  const body = { catalogue: "stars", id: "vega" };
  const example = {
    ...registered[0],
    id: "example",
    href: "/lab/example",
    routes: defineRoutes({
      base: "/lab/example",
      param: "star",
      defaultId: "home",
      entries: [{ id: "home" }, { id: "vega", body, closeUp: true }],
    }),
  };
  assert.deepEqual(sitePaths([example]), [
    "/",
    "/about",
    "/credits",
    "/changelog",
    "/lab/example",
    "/lab/example/vega",
  ]);
  assert.deepEqual(bodyDestinations(body, [example]), [
    { simulationId: "example", href: "/lab/example/vega" },
  ]);
  assert.deepEqual(bodyDestinations(body, []), [], "disabled labs cannot be destinations");
  assert.deepEqual(bodyDestinations({ catalogue: "stars", id: "sun" }, [example]), []);
  const defaultView = {
    ...example,
    routes: defineRoutes({ ...example.routes, defaultId: "vega" }),
  };
  assert.equal(
    bodyDestinations(body, [defaultView])[0].href,
    "/lab/example",
    "a default destination uses the base URL",
  );
});

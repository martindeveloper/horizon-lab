import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { gzipSync } from "node:zlib";

import { slugRoutes } from "../../src/lib/simulation-paths.ts";
import { simulations } from "../../src/lib/simulations.ts";

/**
 * Every simulation this build prerenders (one behind a switch has routes only with the switch
 * on): its id, its address and one view beyond the default, which has an address of its own.
 */
const routes = simulations.map((manifest) => {
  const route = manifest.href.slice(1);
  return { id: manifest.id, route, view: `${route}/${slugRoutes(manifest.routes).slugs()[0]}` };
});

// Run after `npm run build`; inspect production artifacts without starting a server.
const build = new URL("../../.next/", import.meta.url);
const read = (path) => readFileSync(new URL(path, build), "utf8");
function assets(route, extension) {
  const html = read(`server/app/${route}.html`);
  return new Set(
    [...html.matchAll(/\/_next\/(static\/[^"\\<> ]+\.(?:js|css))/g)]
      .map((match) => match[1])
      .filter((path) => path.endsWith(extension)),
  );
}
const contents = (paths) => [...paths].map(read).join("\n");

test("catalogue client boundary contains no simulation entry points", () => {
  const context = {};
  runInNewContext(read("server/app/[locale]/page_client-reference-manifest.js"), context);
  const modules = context.__RSC_MANIFEST["/[locale]/page"].clientModules;
  for (const name of Object.keys(modules)) {
    assert.doesNotMatch(name, /\/features\/(?!catalogue\/)/, name);
  }
});

test("catalogues exclude WebGL and shader JavaScript, including preload references", () => {
  const chunks = readdirSync(new URL("static/chunks/", build))
    .filter((name) => name.endsWith(".js"))
    .map((name) => `static/chunks/${name}`);
  const heavy = chunks.filter((path) => /WebGLRenderer|uniform mat4 uCamera/.test(read(path)));
  assert.ok(heavy.length > 0, "Must find the production renderer/shader chunks");
  for (const locale of ["en", "cs"]) {
    const initial = assets(locale, ".js");
    for (const path of heavy) assert.ok(!initial.has(path), `${locale} loads ${path}`);
    assert.doesNotMatch(contents(initial), /WebGLRenderer|uniform mat4 uCamera/);
    const gzipBytes = [...initial].reduce((total, path) => total + gzipSync(read(path)).length, 0);
    console.log(`${locale}: initial JS ${(gzipBytes / 1024).toFixed(1)} KiB gzip`);
    // The WebGL gate runs first on simulation routes; the renderer stays lazy behind it.
    for (const { route } of routes) {
      const first = assets(`${locale}/${route}`, ".js");
      for (const path of heavy) assert.ok(!first.has(path), `${locale}/${route} loads ${path}`);
    }
  }
});

test("catalogues do not load the toolkit body catalogue or painted surfaces", () => {
  // Mercury's JPL semi-major axis marks @horizon/toolkit/bodies; the painted
  // coastline of Baffin Island marks @horizon/toolkit/bodies/surfaces.
  const markers = [/\.38709927/, /-90,72 -80,73\.7/];
  const chunks = readdirSync(new URL("static/chunks/", build))
    .filter((name) => name.endsWith(".js"))
    .map((name) => read(`static/chunks/${name}`));
  for (const marker of markers)
    assert.ok(
      chunks.some((code) => marker.test(code)),
      `Must find ${marker} in the orrery build`,
    );
  for (const locale of ["en", "cs"]) {
    const initial = contents(assets(locale, ".js"));
    for (const marker of markers) assert.doesNotMatch(initial, marker);
  }
});

test("the spacecraft models' glTF loader stays in an optional chunk, off every route's first load", () => {
  const marker = /glTF versions >=2\.0 are supported/;
  const loaders = readdirSync(new URL("static/chunks/", build))
    .filter((name) => name.endsWith(".js"))
    .map((name) => `static/chunks/${name}`)
    .filter((path) => marker.test(read(path)));
  assert.ok(loaders.length > 0, "find the glTF loader chunk");
  for (const locale of ["en", "cs"])
    for (const suffix of ["", ...routes.map(({ route }) => `/${route}`)]) {
      const initial = assets(`${locale}${suffix}`, ".js");
      for (const path of loaders) assert.ok(!initial.has(path), `${locale}${suffix} loads ${path}`);
    }
});

test("solar activity stays in an optional chunk, outside the Orrery engine and initial route", () => {
  const chunks = readdirSync(new URL("static/chunks/", build))
    .filter((name) => name.endsWith(".js"))
    .map((name) => ({ path: `static/chunks/${name}`, code: read(`static/chunks/${name}`) }));
  const effects = chunks.filter(({ code }) => code.includes("Illustrative solar prominences"));
  const engines = chunks.filter(({ code }) => code.includes("solarActivityPaused"));
  assert.ok(effects.length > 0, "find the optional effect renderer");
  assert.ok(engines.length > 0, "find the main Orrery engine");
  for (const { code } of engines) {
    assert.doesNotMatch(code, /Illustrative solar prominences|uniform sampler3D densityMap/);
  }
  for (const locale of ["en", "cs"]) {
    const initial = assets(`${locale}/lab/orrery`, ".js");
    for (const { path } of effects) assert.ok(!initial.has(path), `${locale} preloads ${path}`);
  }
});

test("black-hole styles load on feature routes, never on catalogue routes", () => {
  for (const locale of ["en", "cs"]) {
    const shared = assets(locale, ".css");
    assert.doesNotMatch(
      contents(shared),
      /black-hole-orbit-ring|scene-label|deep-field-rung|spectroscopy-ribbon|voyage-cockpit/,
    );
    const marker = {
      "black-hole": /black-hole-orbit-ring/,
      /* The Orrery and the Sun have no rules of their own: their scene labels are their marker. */
      orrery: /scene-label/,
      "deep-field": /deep-field-rung/,
      spectroscopy: /spectroscopy-ribbon/,
      giants: /giants-stage/,
      voyage: /voyage-cockpit/,
      sun: /scene-label/,
    };
    /* The zoomable scenes label their objects; the black hole, the spectra and Giants draw their own. */
    const labelled = new Set(["orrery", "deep-field", "sun", "voyage"]);
    for (const { id, route, view } of routes)
      for (const suffix of [route, view]) {
        const feature = [...assets(`${locale}/${suffix}`, ".css")].filter(
          (path) => !shared.has(path),
        );
        assert.ok(feature.length > 0, `${locale}/${suffix} needs its own CSS`);
        assert.ok(marker[id], `${id} names a CSS marker`);
        assert.match(contents(feature), marker[id]);
        if (labelled.has(id))
          assert.match(contents(feature), /scene-label/, `${locale}/${suffix} styles scene labels`);
        assert.doesNotMatch(
          contents(feature),
          /@layer utilities/,
          "Utilities compile once, in the shared stylesheet; a second bundle reorders the cascade",
        );
      }
    const bytes = [...shared].reduce((total, path) => total + Buffer.byteLength(read(path)), 0);
    console.log(`${locale}: initial CSS ${(bytes / 1024).toFixed(1)} KiB uncompressed`);
  }
});

test("standalone errors keep clean recovery links, noindex and lightweight bundles", () => {
  const html = read("server/app/_not-found.html");
  assert.doesNotMatch(html, /href="\/(?:en|cs)"/);
  assert.match(html, /href="\/"/);
  assert.match(html, /noindex/);
  assert.doesNotMatch(contents(assets("_not-found", ".js")), /WebGLRenderer|uniform mat4 uCamera/);

  // Next's emergency HTML is framework-owned. The custom global-error boundary
  // is registered in the client manifest and takes over when React handles errors.
  const context = {};
  runInNewContext(read("server/app/_global-error/page_client-reference-manifest.js"), context);
  const manifest = Object.values(context.__RSC_MANIFEST)[0];
  const entry = Object.entries(manifest.clientModules).find(([name]) =>
    name.endsWith("/src/app/global-error.tsx"),
  );
  assert.ok(entry, "Custom root error boundary must be included");
  const code = contents(entry[1].chunks.map((path) => path.replace(/^\/_next\//, "")));
  assert.doesNotMatch(code, /WebGLRenderer|uniform mat4 uCamera/);
});

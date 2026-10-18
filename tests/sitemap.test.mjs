import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";

import manifest from "../src/app/manifest.ts";
import robots from "../src/app/robots.ts";
import sitemap from "../src/app/sitemap.ts";
import { BLACK_HOLE_PATH } from "../src/features/black-hole/manifest.ts";
import { presetRouteParams } from "../src/features/black-hole/routing.ts";
import { DEEP_FIELD_PATH } from "../src/features/deep-field/manifest.ts";
import { viewRouteParams as deepViewRouteParams } from "../src/features/deep-field/routing.ts";
import { ORRERY_PATH } from "../src/features/orrery/manifest.ts";
import { viewRouteParams } from "../src/features/orrery/routing.ts";
import { routing } from "../src/i18n/routing.ts";
import { siteUrl } from "../src/lib/metadata.ts";
import { siteRedirects } from "../src/lib/redirects.ts";
import { simulations } from "../src/lib/simulations.ts";

const root = new URL("../", import.meta.url);
const origin = siteUrl().origin;
const urls = sitemap().map(({ url }) => new URL(url));
const paths = urls.map(({ pathname }) => pathname);

test("sitemap lists the catalogue, the about and credits pages, every simulation and every preset/view", () => {
  const expected = [
    "/",
    "/about",
    "/credits",
    ...simulations.map(({ href }) => href),
    ...presetRouteParams().map(({ hole }) => `${BLACK_HOLE_PATH}/${hole}`),
    ...viewRouteParams().map(({ view }) => `${ORRERY_PATH}/${view}`),
    ...deepViewRouteParams().map(({ view }) => `${DEEP_FIELD_PATH}/${view}`),
  ];
  assert.deepEqual([...paths].sort(), [...new Set(expected)].sort());
  for (const { entryPoints } of simulations)
    for (const { href } of entryPoints) assert.ok(paths.includes(href), href);
  for (const url of urls) assert.equal(url.origin, origin);
});

test("sitemap holds canonical clean paths only", () => {
  const redirects = siteRedirects();
  const prefix = new RegExp(`^/(?:${routing.locales.join("|")})(?:/|$)`);
  for (const path of paths) {
    assert.doesNotMatch(path, prefix, `${path} carries a language`);
    assert.equal(redirects.has(path), false, `${path} is a redirect source`);
  }
});

test("robots.txt points to the sitemap; manifest icons exist", () => {
  assert.equal(robots().sitemap, `${origin}/sitemap.xml`);
  for (const { src } of manifest().icons) assert.ok(existsSync(new URL(`public${src}`, root)), src);
  for (const file of ["favicon.ico", "apple-touch-icon.png"])
    assert.ok(existsSync(new URL(`public/${file}`, root)), file);
});

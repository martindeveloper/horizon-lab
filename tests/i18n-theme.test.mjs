import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { createTranslator } from "next-intl";

import { HOLE_ALIASES, PRESETS } from "../src/features/black-hole/lib/holes/index.ts";
import { pathForHole, presetFromPath, resolveHole } from "../src/features/black-hole/routing.ts";
import { getPathname } from "../src/i18n/navigation.ts";
import { LOCALE_COOKIE, localeCookie, routing } from "../src/i18n/routing.ts";
import { localeRewrites, siteRedirects } from "../src/lib/redirects.ts";
import { simulations } from "../src/lib/simulations.ts";
import { layoutMessages, leaves } from "./messages-helper.mjs";

/** Every layout's catalog at once: the shared copy and each simulation under its namespace. */
const catalogs = Object.fromEntries(
  routing.locales.map((locale) => [
    locale,
    Object.assign({}, ...simulations.map(({ id }) => layoutMessages(id, locale))),
  ]),
);
test("English and Czech have identical keys and every ICU message formats", () => {
  assert.deepEqual(
    leaves(catalogs.cs)
      .map(([key]) => key)
      .sort(),
    leaves(catalogs.en)
      .map(([key]) => key)
      .sort(),
  );
  for (const [locale, messages] of Object.entries(catalogs)) {
    const t = createTranslator({
      locale,
      messages,
      onError(error) {
        throw error;
      },
    });
    for (const [key, message] of leaves(messages)) {
      const args = Object.fromEntries(
        [...message.matchAll(/\{(\w+)[,}]/g)].map(([, name]) => [name, 1]),
      );
      const tags = Object.fromEntries(
        [...message.matchAll(/<(\w+)>/g)].map(([, name]) => [name, (chunks) => chunks]),
      );
      const text = Object.keys(tags).length ? t.markup(key, { ...args, ...tags }) : t(key, args);
      assert.ok(text.length, `${locale}:${key}`);
    }
  }
});

test("Next.js redirects preserve legacy URLs on language-free paths", () => {
  const redirects = siteRedirects();
  assert.equal(redirects.has("/"), false);
  assert.equal(redirects.get("/m87"), "/lab/black-hole/m87");
  for (const preset of PRESETS) assert.equal(redirects.has(pathForHole(preset.id)), false);
  for (const [alias, id] of Object.entries(HOLE_ALIASES)) {
    if (!resolveHole(alias)) continue;
    assert.equal(redirects.get(`/${alias}`), pathForHole(id));
  }
  for (const target of redirects.values()) {
    assert.equal(redirects.has(target), false, `Redirect chain: ${target}`);
  }
});

test("old language-prefixed links keep their language and show clean URLs", () => {
  const redirects = siteRedirects();
  for (const locale of routing.locales) {
    assert.equal(redirects.get(`/${locale}/m87`), `/${locale}/lab/black-hole/m87`);
    assert.equal(redirects.has(`/${locale}`), false, "Prefixed pages are served, then cleaned");
  }
  assert.match(localeCookie("cs"), new RegExp(`^${LOCALE_COOKIE}=cs; Path=/; Max-Age=\\d+`));
  assert.match(localeCookie("en"), new RegExp(`^${LOCALE_COOKIE}=; Path=/; Max-Age=0`));
});

test("clean URLs rewrite to the cookie's locale, falling back to English", () => {
  const rules = localeRewrites();
  const fallback = rules.filter((rule) => !rule.has);
  const pageRule = fallback.at(-1);
  // The home page's RSC requests (Vercel's /index.rsc) come first, or the "/" rule serves them HTML.
  const expected = (locale) => [
    ["/index.rsc", `/${locale}.rsc`],
    ["/index.segments/:segment*", `/${locale}.segments/:segment*`],
    ["/", `/${locale}`],
    [pageRule.source, `/${locale}/:path`],
  ];
  assert.deepEqual(
    fallback.map((rule) => [rule.source, rule.destination]),
    expected("en"),
  );
  assert.deepEqual(
    rules.slice(-fallback.length),
    fallback,
    "Cookie rules must be checked before the fallback",
  );
  const czech = rules.filter((rule) => rule.has?.[0].value === "cs");
  assert.deepEqual(
    czech.map((rule) => [rule.source, rule.destination]),
    expected("cs"),
  );
  for (const rule of czech) assert.equal(rule.has[0].key, LOCALE_COOKIE);
  const page = new RegExp(`^/${pageRule.source.match(/^\/:path\((.+)\)$/)[1]}$`);
  for (const path of ["/lab/black-hole", "/lab/deep-field/laniakea", "/english", "/csv"])
    assert.match(path, page);
  for (const path of ["/_next/static/x.js", "/en", "/cs", "/cs/lab/black-hole", "/en/lab/orrery"])
    assert.doesNotMatch(path, page, `${path} must not be rewritten`);
});

function rgb(hex) {
  return hex.match(/\w\w/g).map((part) => parseInt(part, 16) / 255);
}
function luminance(rgb) {
  return rgb
    .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
    .reduce((sum, c, index) => sum + c * [0.2126, 0.7152, 0.0722][index], 0);
}
function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
test("text tokens stay readable on every glass composited over the dark scene, in both themes", () => {
  const css = readFileSync(
    new URL("../packages/toolkit/src/ui/theme.css", import.meta.url),
    "utf8",
  );
  const [dark, light] = css.split(":root.light {");
  assert.ok(!light.includes("--color-space:"), "Scene background must not change with UI theme");
  const scene = rgb(css.match(/--color-space:\s*#([\da-f]{6})/)[1]);
  for (const [theme, block] of [
    ["dark", dark],
    ["light", light],
  ]) {
    for (const glass of ["panel-bg", "hud-bg"]) {
      const layer = block.match(
        new RegExp(`--${glass}:\\s*rgba\\((\\d+),\\s*(\\d+),\\s*(\\d+),\\s*([\\d.]+)\\)`),
      );
      const alpha = Number(layer[4]);
      const backdrop = [1, 2, 3].map(
        (i) => (Number(layer[i]) / 255) * alpha + scene[i - 1] * (1 - alpha),
      );
      for (const role of ["fg", "muted", "subtle", "accent"]) {
        const text = rgb(block.match(new RegExp(`--color-${role}:\\s*#([\\da-f]{6})`))[1]);
        const ratio = contrast(backdrop, text);
        assert.ok(ratio >= 4.5, `${theme} ${role} on ${glass}: ${ratio.toFixed(2)} is below 4.5:1`);
      }
    }
  }
});

test("localized preset links, aliases, and initial scene state agree", () => {
  for (const locale of routing.locales) {
    for (const preset of PRESETS) {
      const url = getPathname({ locale, href: pathForHole(preset.id) });
      assert.equal(url, pathForHole(preset.id), "URLs carry no language");
      assert.equal(presetFromPath(url).id, preset.id);
    }
    for (const [alias, id] of Object.entries(HOLE_ALIASES)) {
      if (id === "custom") continue;
      assert.equal(resolveHole(alias), id);
      assert.equal(presetFromPath(`/${locale}/${alias}`).id, id);
    }
  }
  assert.equal(resolveHole("unknown-black-hole"), null);
  assert.equal(resolveHole("M87"), "m87");
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { createTranslator } from "next-intl";
import { parse } from "postcss";

import { MAPS } from "@horizon/toolkit/bodies";
import { keysOf } from "@horizon/toolkit/records";

import { HOLE_ALIASES, PRESETS } from "../src/features/black-hole/lib/holes/index.ts";
import { pathForHole, presetIdFromPath, resolveHole } from "../src/features/black-hole/routing.ts";
import { getPathname } from "../src/i18n/navigation.ts";
import { LOCALE_COOKIE, localeCookie, routing } from "../src/i18n/routing.ts";
import { CREDITS } from "../src/lib/credits.ts";
import { localeRewrites, siteRedirects } from "../src/lib/redirects.ts";
import { simulations } from "../src/lib/simulations.ts";
import { SOLAR_LABEL_KEYS } from "../src/space/solar-system/scene/solar-system.ts";
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

test("every body the scenes label and every credited map has its name in both languages", () => {
  const strict = (locale, messages, namespace) =>
    createTranslator({
      locale,
      messages,
      namespace,
      onError(error) {
        throw error;
      },
    });
  for (const locale of routing.locales) {
    // The scenes that place the solar system's labels read `names.<key>` in their namespace.
    for (const id of ["orrery", "deep-field"]) {
      const { messageKey } = simulations.find((simulation) => simulation.id === id);
      const t = strict(locale, layoutMessages(id, locale), messageKey);
      for (const key of SOLAR_LABEL_KEYS) assert.ok(t(`names.${key}`), `${locale} ${id}: ${key}`);
    }
    // The credits page names each measured map's world and describes every source.
    const t = strict(locale, layoutMessages(null, locale), "credits");
    for (const id of keysOf(MAPS)) assert.ok(t(`worlds.${id}`), `${locale} credits world: ${id}`);
    for (const item of CREDITS.flatMap((group) => group.items))
      assert.ok(t(`items.${item.id}`), `${locale} credits item: ${item.id}`);
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

/** Read the actual palette, including aliases, so contrast checks follow the rendered colors. */
function themePalettes() {
  const css = parse(readFileSync(
    new URL("../packages/toolkit/src/ui/theme.css", import.meta.url),
    "utf8",
  ));
  const dark = {};
  const light = {};
  const collect = (node, into) => node.walkDecls((decl) => { into[decl.prop] = decl.value; });
  css.walkAtRules("theme", (rule) => collect(rule, dark));
  css.walkRules((rule) => {
    if (rule.selector === ":root") collect(rule, dark);
    if (rule.selector === ":root.light") collect(rule, light);
  });
  return { dark, light: { ...dark, ...light } };
}
function paletteColor(tokens, name) {
  const resolve = (key, path = []) => {
    assert.ok(tokens[key], `Missing color token ${key}`);
    assert.ok(!path.includes(key), `Circular color token ${[...path, key].join(" → ")}`);
    return tokens[key].replace(/var\((--[\w-]+)\)/g, (_, next) => resolve(next, [...path, key]));
  };
  const value = resolve(`--${name}`).trim();
  if (/^#[\da-f]{6}$/i.test(value))
    return [...value.slice(1).match(/\w\w/g).map((part) => parseInt(part, 16) / 255), 1];
  const rgb = value.match(/^rgba?\(([^)]+)\)$/);
  assert.ok(rgb, `Unsupported color in contrast check: ${name} = ${value}`);
  const [r, g, b, a = 1] = rgb[1].trim().split(/[\s,/]+/).map(Number);
  return [r / 255, g / 255, b / 255, a];
}
function composite([r, g, b, alpha], backdrop) {
  return [r, g, b].map((channel, i) => channel * alpha + backdrop[i] * (1 - alpha));
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
test("text tokens stay readable on surfaces and glass over the scene in both themes", () => {
  for (const [theme, tokens] of Object.entries(themePalettes())) {
    const color = (name) => paletteColor(tokens, name);
    const scene = color("color-space");
    const readable = (foreground, background) => {
      const backdrop = composite(color(background), scene);
      const ratio = contrast(backdrop, composite(color(foreground), backdrop));
      assert.ok(ratio >= 4.5, `${theme} ${foreground} on ${background}: ${ratio.toFixed(2)} is below 4.5:1`);
    };
    for (const surface of ["surface-primary", "surface-secondary", "surface-tertiary"])
      for (const role of ["fg-primary", "fg-secondary", "fg-tertiary", "accent"])
        readable(`color-${role}`, `color-${surface}`);
    for (const glass of ["panel-bg", "hud-bg", "popover-bg", "tip-bg", "glass-fallback"])
      for (const role of ["fg-primary", "fg-secondary", "fg-tertiary", "accent"])
        readable(`color-${role}`, glass);
    readable("lesson-fg", "lesson-bg");
    readable("color-action-fg", "color-action");
    readable("color-accent-fg", "color-accent");
    for (const role of ["space-fg", "space-muted", "space-title", "solar"])
      readable(`color-${role}`, "color-space");
  }
});

test("changing the UI theme preserves the astronomical palette", () => {
  const { dark, light } = themePalettes();
  for (const role of ["space", "space-fg", "space-muted", "space-title", "solar", "on-solar", "space-danger"])
    assert.deepEqual(paletteColor(light, `color-${role}`), paletteColor(dark, `color-${role}`), role);
});

test("localized preset links, aliases, and initial scene state agree", () => {
  for (const locale of routing.locales) {
    for (const preset of PRESETS) {
      const url = getPathname({ locale, href: pathForHole(preset.id) });
      assert.equal(url, pathForHole(preset.id), "URLs carry no language");
      assert.equal(presetIdFromPath(url), preset.id);
    }
    for (const [alias, id] of Object.entries(HOLE_ALIASES)) {
      if (id === "custom") continue;
      assert.equal(resolveHole(alias), id);
      assert.equal(presetIdFromPath(`/${locale}/${alias}`), id);
    }
  }
  assert.equal(resolveHole("unknown-black-hole"), null);
  assert.equal(resolveHole("M87"), "m87");
});

test("every Czech plural choice has its other form and reads in every category", async () => {
  const { createTranslator } = await import("next-intl");
  const { featureMessages, leaves } = await import("./messages-helper.mjs");
  for (const feature of ["orrery", "deep-field", "voyage", "giants", "black-hole", "sun"]) {
    const messages = featureMessages(feature, "cs");
    const t = createTranslator({
      locale: "cs",
      messages,
      onError(error) {
        throw error;
      },
    });
    for (const [key, message] of leaves(messages)) {
      const selects = [
        ...String(message).matchAll(/\{(\w+Plural), select, ([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g),
      ];
      if (selects.length === 0) continue;
      for (const [, , body] of selects)
        assert.match(body, /\bother \{[^{}]+\}/, `${feature}:${key} has no other form`);
      /* Every other placeholder gets a stand-in; each plural takes each form in turn. */
      const names = [...String(message).matchAll(/\{(\w+)\}/g)].map(([, name]) => name);
      for (const form of ["one", "few", "many", "other"]) {
        const values = Object.fromEntries(names.map((name) => [name, "1"]));
        for (const [, plural] of selects) values[plural] = form;
        assert.doesNotMatch(t(key, values), /[{}]|undefined/, `${feature}:${key} (${form})`);
      }
    }
  }
});

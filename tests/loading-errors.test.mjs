import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";

import { NextIntlClientProvider } from "next-intl";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { LoadingScreen } from "@horizon/toolkit/ui";

import RouteError from "../src/app/[locale]/error.tsx";
import { WebGLGate } from "../src/components/simulations/webgl-gate.tsx";
import {
  Localized,
  StatusLocaleHead,
  cookieLocale,
} from "../src/components/status/status-locale.tsx";
import { CatalogueLoading } from "../src/features/catalogue/loading.tsx";

for (const locale of ["en", "cs"]) {
  const messages = JSON.parse(
    readFileSync(new URL(`../src/messages/${locale}.json`, import.meta.url), "utf8"),
  );
  const render = (child) =>
    renderToStaticMarkup(
      createElement(NextIntlClientProvider, { locale, messages, timeZone: "UTC" }, child),
    );

  test(`${locale}: catalogue skeleton is accessible without waiting for effects`, () => {
    const html = render(createElement(CatalogueLoading));
    // The page keeps its main landmark; a separate status line is announced (never aria-busy).
    assert.match(html, /<main[^>]*id="main-content"/);
    assert.doesNotMatch(html, /<main[^>]*role=/);
    assert.match(html, /role="status"/);
    assert.doesNotMatch(html, /aria-busy/);
    assert.ok(html.includes(messages.loading.catalogue));
    assert.doesNotMatch(html, /<canvas|<img|<script/);
  });

  test(`${locale}: the WebGL gate renders only its loading fallback on the server`, () => {
    const html = render(
      createElement(
        WebGLGate,
        { fallback: createElement("p", null, "FALLBACK") },
        createElement("p", null, "SIMULATION"),
      ),
    );
    assert.match(html, /FALLBACK/);
    assert.doesNotMatch(html, /SIMULATION/);
  });

  test(`${locale}: route errors offer recovery without exposing exception details`, () => {
    const html = render(
      createElement(RouteError, { error: new Error("PRIVATE_INTERNAL_ERROR"), reset() {} }),
    );
    assert.ok(html.includes(messages.errorTitle));
    assert.ok(html.includes(messages.errorBody));
    assert.ok(html.includes(messages.tryAgain));
    assert.match(html, /href="\/"/, "Home links carry no language");
    assert.doesNotMatch(html, /PRIVATE_INTERNAL_ERROR/);
  });
}

test("shared simulation loader needs no feature runtime and announces its status", () => {
  const html = renderToStaticMarkup(
    createElement(LoadingScreen, { title: "Test world", status: "Preparing" }),
  );
  // role=status is polite by itself; aria-busy would hold the announcement back.
  assert.match(html, /role="status"/);
  assert.doesNotMatch(html, /aria-busy/);
  assert.match(html, /Test world/);
  assert.match(html, /Preparing/);
  assert.doesNotMatch(html, /<canvas|<script/);
});

test("global status pages show one language, picked from the cookie before paint", () => {
  const head = renderToStaticMarkup(createElement(StatusLocaleHead));
  const script = head.match(/<script>([\s\S]*?)<\/script>/)[1];
  const css = head.match(/<style>([\s\S]*?)<\/style>/)[1];
  for (const [cookie, locale] of [
    ["", "en"],
    ["NEXT_LOCALE=cs", "cs"],
    ["theme=dark; NEXT_LOCALE=cs; x=1", "cs"],
    ["NEXT_LOCALE=de", "en"],
    ["XNEXT_LOCALE=cs", "en"],
  ]) {
    const document = { cookie, documentElement: { lang: "en" } };
    runInNewContext(script, { document });
    assert.equal(document.documentElement.lang, locale, cookie);
    assert.equal(cookieLocale(cookie), locale, cookie);
  }
  for (const locale of ["en", "cs"])
    assert.ok(
      css.includes(`html[lang="${locale}"] [data-locale]:not([data-locale="${locale}"])`),
      `${locale} must hide the other copies`,
    );
  const copy = renderToStaticMarkup(createElement(Localized, { copy: { en: "Home", cs: "Domů" } }));
  assert.equal(
    copy,
    '<span lang="en" data-locale="en">Home</span><span lang="cs" data-locale="cs">Domů</span>',
  );
});

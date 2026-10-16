import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// Run after `npm run build`: the about page is prerendered in both languages.
const root = new URL("../../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");
const en = JSON.parse(read("src/messages/en.json")).about;
const escape = (text) => text.replaceAll("&", "&amp;").replaceAll("'", "&#x27;");

for (const locale of ["en", "cs"]) {
  test(`${locale}: /about is prerendered with its copy and English metadata`, () => {
    const html = read(`.next/server/app/${locale}/about.html`);
    const about = JSON.parse(read(`src/messages/${locale}.json`)).about;
    assert.match(html, new RegExp(`<html lang="${locale}"`));
    for (const text of [about.lead, about.disclaimer.sources, about.thanks.body])
      assert.ok(html.includes(escape(text)), `${locale}: ${text}`);
    for (const name of ["Martin Pernica", "Jakub Rozehnal", "Petr Kulhánek"])
      assert.ok(html.includes(name), name);
    assert.ok(html.includes(`<title>${en.kicker} · Horizon</title>`));
    assert.match(html, /<link rel="canonical" href="[^"]*\/about"/);
  });
}

import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";

const root = new URL("../../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");
function attributes(tag) {
  return Object.fromEntries(
    [...tag.matchAll(/([\w:-]+)="([^"]*)"/g)].map((match) => [match[1].toLowerCase(), match[2]]),
  );
}

for (const locale of ["en", "cs"]) {
  test(`${locale}: every page has route-specific social metadata and shared English artwork`, () => {
    const features = ["lab/black-hole", "lab/orrery"];
    const subpages = features.flatMap((feature) =>
      readdirSync(new URL(`.next/server/app/${locale}/${feature}/`, root))
        .filter((name) => name.endsWith(".html"))
        .map((name) => `${feature}/${name.slice(0, -5)}`),
    );
    for (const suffix of ["", ...features, ...subpages]) {
      const path = `/${locale}${suffix ? `/${suffix}` : ""}`;
      const html = read(`.next/server/app${path}.html`);
      const tags = [...html.matchAll(/<meta\b[^>]*>/g)].map(([tag]) => attributes(tag));
      const meta = (name) => {
        const matches = tags.filter((tag) => tag.property === name || tag.name === name);
        assert.equal(matches.length, 1, `${path}: exactly one ${name}`);
        return matches[0].content;
      };
      const links = [...html.matchAll(/<link\b[^>]*>/g)].map(([tag]) => attributes(tag));
      const canonical = links.find((link) => link.rel === "canonical")?.href;
      assert.equal(meta("og:url"), canonical);
      // Every language shares one clean URL.
      assert.equal(new URL(canonical).pathname, suffix ? `/${suffix}` : "/");
      assert.equal(meta("og:title"), html.match(/<title>(.*?)<\/title>/)[1]);
      assert.equal(meta("twitter:title"), meta("og:title"));
      const english = read(`.next/server/app/en${suffix ? `/${suffix}` : ""}.html`);
      assert.equal(meta("og:title"), english.match(/<title>(.*?)<\/title>/)[1]);
      const englishDescription = [...english.matchAll(/<meta\b[^>]*>/g)]
        .map(([tag]) => attributes(tag))
        .find((tag) => tag.name === "description").content;
      assert.equal(meta("description"), englishDescription);
      assert.equal(meta("og:description"), meta("description"));
      assert.equal(meta("twitter:description"), meta("description"));
      assert.equal(meta("og:site_name"), "Horizon");
      assert.equal(meta("og:locale"), "en_US");
      assert.equal(meta("twitter:card"), "summary_large_image");
      const image = suffix ? `/simulations/${suffix.split("/")[1]}/og.png` : "/social/horizon.png";
      assert.equal(new URL(meta("og:image")).pathname, image);
      assert.equal(meta("twitter:image"), meta("og:image"));
      assert.ok(meta("og:image:alt").includes("Horizon"));
      assert.equal(meta("og:image:width"), "1200");
      assert.equal(meta("og:image:height"), "630");
      assert.equal(links.filter((item) => item.hreflang).length, 0, `${path}: no language links`);
      assert.doesNotMatch(html, /href="\/(?:en|cs)(?:[/"?#])/, `${path}: links carry no language`);
      const png = readFileSync(new URL(`public${image}`, root));
      assert.equal(png.subarray(1, 4).toString(), "PNG");
      assert.equal(png.readUInt32BE(16), 1200);
      assert.equal(png.readUInt32BE(20), 630);
      assert.doesNotMatch(html, /\/og\.jpg|\/x-banner\.jpg|(?:og|horizon)-(?:en|cs)\.png/);
    }
  });
}

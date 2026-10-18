import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { createFormatter, createTranslator } from "next-intl";

import { NAMED, PLANET_IDS } from "@horizon/toolkit/bodies";
import { UNITS } from "@horizon/toolkit/science";

import { ledger } from "../scripts/lib/catalogue-ledger.mjs";
import { cardFor, NEIGHBOUR_IDS } from "../src/features/orrery/components/cards.tsx";
import { SOURCES, catalogueFacts } from "../src/features/orrery/lib/model/catalogue.ts";

const LOCALES = ["en", "cs"];
const messages = Object.fromEntries(
  LOCALES.map((locale) => [
    locale,
    JSON.parse(
      readFileSync(
        new URL(`../src/features/orrery/messages/${locale}.json`, import.meta.url),
        "utf8",
      ),
    ),
  ]),
);

const SELECTIONS = [
  { kind: "sun" },
  ...PLANET_IDS.map((id) => ({ kind: "planet", id })),
  ...NAMED.map((body) => ({ kind: "named", id: body.id })),
  ...["asteroids", "disk", "kuiper", "scattered", "oort", "ejected"].map((id) => ({
    kind: "population",
    id,
  })),
  ...["milkyway", "sun", "bulge", "halo"].map((id) => ({ kind: "galaxy", id })),
  ...Object.keys(messages.en.cards.cosmos)
    .filter((id) => typeof messages.en.cards.cosmos[id] === "object")
    .map((id) => ({ kind: "cosmos", id })),
  ...NEIGHBOUR_IDS.map((id) => ({ kind: "star", id })),
  { kind: "tracer", index: 3 },
];

/** Every card in both languages and all three distance units, at a few moments. */
function* cards() {
  const date = new Date("2026-10-18T00:00:00Z");
  for (const locale of LOCALES) {
    const t = createTranslator({
      locale,
      messages: { orrery: messages[locale] },
      namespace: "orrery",
      onError(error) {
        throw error;
      },
    });
    const f = createFormatter({ locale });
    for (const unit of ["au", "ly", "pc"])
      for (const yearsAgo of [0, 1.5e5, 2e8, 4.5e9, 9e9])
        for (const sel of SELECTIONS)
          yield {
            where: `${locale}/${unit}/${yearsAgo}/${sel.kind}:${sel.id ?? sel.index}`,
            locale,
            unit,
            yearsAgo,
            sel,
            card: cardFor(t, f, sel, yearsAgo, true, date, { unit, locale }),
          };
  }
}

test("every catalogue figure has a unit of the science kit, a known source and a sane range", () => {
  const plain = new Set(["count", "percent", "ratio"]);
  for (const { path, fact } of catalogueFacts()) {
    assert.ok(fact.unit in UNITS || plain.has(fact.unit), `${path}: unit ${fact.unit}`);
    assert.ok(fact.source in SOURCES, `${path}: source ${fact.source}`);
    assert.ok(Number.isFinite(fact.value), `${path}: value`);
    /* A computed value must say how much of it to print. */
    const written = Math.abs(fact.value).toExponential().split("e")[0].replace(".", "");
    assert.ok(fact.digits || written.replace(/0+$/, "").length <= 6, `${path}: set digits`);
    if (fact.range) {
      const [low, high] = fact.range;
      assert.ok(low < high, `${path}: range order`);
      assert.ok(low <= fact.value && fact.value <= high, `${path}: value outside its range`);
    }
    if (fact.at) {
      const today = fact.at(0);
      assert.ok(
        Math.abs(today - fact.value) <= 0.02 * Math.abs(fact.value),
        `${path}: the model gives ${today} today, the catalogue ${fact.value}`,
      );
    }
  }
});

test("cards render every figure in both languages and all distance units", () => {
  for (const { where, card } of cards())
    for (const text of [card.title, card.body, card.caution, ...card.facts.map((f) => f.value)]) {
      assert.doesNotMatch(text, /[{}]|NaN|undefined|Infinity/, where);
      assert.doesNotMatch(text, /\.\.(?!\.)|\s[,.;]/, `${where}: punctuation around a figure`);
    }
});

test("lengths follow the visitor's distance unit and keep the source's precision", () => {
  const values = new Map();
  for (const { locale, unit, yearsAgo, sel, card } of cards())
    if (locale === "en" && yearsAgo === 0 && sel.kind === "cosmos" && sel.id === "triangulum")
      values.set(unit, card.facts.find((f) => f.id === "width").value);
  assert.equal(values.get("ly"), "About 60,000 ly");
  assert.equal(values.get("pc"), "About 18,000 pc");
  assert.equal(values.get("au"), "About 3.8 × 10⁹ au");
});

/** Card copy migrated to the catalogue: its numbers are arguments, never typed digits. */
const MIGRATED = ["cards", "facts"];
/** Digits that are not measurements: years, catalogue designations, a resonance ratio, the unit's name. */
const NOT_FIGURES = [
  /\b1 au\b/g,
  /\b\d{1,2}\.? \p{L}+ (?:1[5-9]|20)\d\d\b/gu,
  /\b(?:1[5-9]|20)\d\d(?:s)?\b/g,
  /\b\d{2}\. letech/g,
  /\b(?:NGC|Abell|M) ?\d+/g,
  /\b3:2\b/g,
];

function leaves(value, prefix = "") {
  return Object.entries(value).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof child === "string" ? [[path, child]] : leaves(child, path);
  });
}

test("card copy takes its figures from the catalogue, not typed digits", () => {
  for (const locale of LOCALES)
    for (const [key, text] of leaves(messages[locale]))
      if (MIGRATED.some((prefix) => key.startsWith(`${prefix}.`))) {
        const rest = NOT_FIGURES.reduce((s, pattern) => s.replace(pattern, ""), text);
        assert.doesNotMatch(rest, /\d/, `${locale}:${key}: ${text}`);
      }
});

test("docs/science-sources.md lists the catalogue and its sources", async () => {
  const { current, next } = await ledger();
  assert.equal(current, next, "Run npm run docs:catalogue.");
  for (const { path, fact } of catalogueFacts()) {
    assert.ok(current.includes(`\`${path}\``), path);
    assert.ok(current.includes(`\`${fact.source}\``), fact.source);
  }
});

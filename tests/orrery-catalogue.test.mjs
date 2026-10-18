import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { createFormatter, createTranslator } from "next-intl";

import { NAMED, PLANET_IDS } from "@horizon/toolkit/bodies";
import { UNITS } from "@horizon/toolkit/science";

import { ledger } from "../scripts/lib/catalogue-ledger.mjs";
import {
  PLANET_NOTES,
  TRACER_NOTES,
  cardSpecs,
} from "../src/features/orrery/components/card-specs.ts";
import { cardFor, NEIGHBOUR_IDS } from "../src/features/orrery/components/cards.tsx";
import { proseArgs } from "../src/features/orrery/components/format.ts";
import {
  PROSE_FIGURES,
  SOURCES,
  catalogueFacts,
} from "../src/features/orrery/lib/model/catalogue/index.ts";

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
    for (const unit of ["auto", "au", "ly", "pc"])
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

test("every catalogue figure has a kit unit, a known source, a stated status and a sane range", () => {
  const plain = new Set(["count", "percent", "ratio"]);
  const statuses = new Set(["verified", "derived", "teaching-choice", "flag"]);
  for (const { path, fact } of catalogueFacts()) {
    assert.ok(fact.unit in UNITS || plain.has(fact.unit), `${path}: unit ${fact.unit}`);
    assert.ok(!fact.show || fact.show in UNITS, `${path}: shown in ${fact.show}`);
    assert.ok(fact.source in SOURCES, `${path}: source ${fact.source}`);
    assert.ok(statuses.has(fact.status), `${path}: status ${fact.status}`);
    assert.ok(fact.value !== undefined || fact.range, `${path}: a value or a published span`);
    for (const v of [fact.value, ...(fact.range ?? [])])
      if (v !== undefined) {
        assert.ok(Number.isFinite(v), `${path}: ${v}`);
        /* A computed value must say how much of it to print. */
        const written = Math.abs(v).toExponential().split("e")[0].replace(".", "");
        assert.ok(fact.digits || written.replace(/0+$/, "").length <= 6, `${path}: set digits`);
      }
    if (fact.range) {
      const [low, high] = fact.range;
      assert.ok(low < high, `${path}: range order`);
      if (fact.value !== undefined)
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
  const read = (selection, id) => {
    const values = new Map();
    for (const { locale, unit, yearsAgo, sel, card } of cards())
      if (
        locale === "en" &&
        yearsAgo === 0 &&
        sel.kind === selection.kind &&
        sel.id === selection.id
      )
        values.set(unit, card.facts.find((f) => f.id === id).value);
    return values;
  };
  const m33 = read({ kind: "cosmos", id: "triangulum" }, "width");
  assert.equal(m33.get("ly"), "About 60,000 ly");
  assert.equal(m33.get("pc"), "About 18,000 pc");
  assert.equal(m33.get("au"), "About 3.8 × 10⁹ au");
  assert.equal(m33.get("auto"), "About 60,000 ly");
  /* Auto: au inside half a light-year, ly beyond. */
  const oort = read({ kind: "population", id: "oort" }, "innerEdge");
  assert.equal(oort.get("auto"), "Thought to be about 2,000–5,000 au");
  assert.equal(
    read({ kind: "population", id: "oort" }, "outerEdge").get("auto"),
    "Uncertain, roughly 1.6–3.2 ly",
  );
});

test("large plain figures read in words, huge ones in powers of ten", () => {
  const values = new Map();
  for (const { locale, unit, yearsAgo, sel, card } of cards())
    if (unit === "auto" && yearsAgo === 0 && sel.kind === "cosmos" && sel.id === "virgo")
      values.set(locale, card.facts.find((f) => f.id === "heart").value);
  assert.equal(values.get("en"), "M87, with a black hole of about 6.5 billion Suns");
  assert.equal(values.get("cs"), "M87 s černou dírou asi 6,5 mld. Sluncí");
  for (const { unit, yearsAgo, sel, card, locale } of cards())
    if (
      locale === "en" &&
      unit === "auto" &&
      yearsAgo === 0 &&
      sel.kind === "cosmos" &&
      sel.id === "laniakea"
    )
      assert.equal(card.facts.find((f) => f.id === "mass").value, "About 10¹⁷ Suns");
});

/** Copy whose numbers are catalogue arguments, never typed digits. */
const MIGRATED = ["cards", "facts", "notes", "tour", "technicalDetails"];
/** Digits that are not measurements: years, catalogue designations, a resonance ratio, the unit's name. */
const NOT_FIGURES = [
  /\b1 au\b/g,
  /\b\d{1,2}\.?–\d{1,2}\.? \p{L}+ (?:19|20)\d\d\b/gu,
  /\b\d{1,2}\.? \p{L}+ (?:1[5-9]|20)\d\d\b/gu,
  /\b(?:1[5-9]|20)\d\d(?:s)?\b/g,
  /\b\d{2}\. letech/g,
  /\b(?:NGC|Abell|M) ?\d+/g,
  /\b\d:\d\b/g,
  /\bJ2000\b/g,
  /\bL[45]\b/g,
  /\p{L}+-\d+\b/gu,
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

const placeholders = (text) =>
  [...new Set([...text.matchAll(/\{(\w+)[,}]/g)].map(([, name]) => name))].sort();
const message = (locale, key) =>
  key.split(".").reduce((node, part) => node?.[part], messages[locale]);
const names = (args = {}) => Object.keys(args).sort();

test("card definitions give every message exactly the figures it asks for", () => {
  for (const locale of LOCALES) {
    for (const { body, caution, spec } of cardSpecs()) {
      for (const row of spec.rows)
        if (row.text)
          assert.deepEqual(
            placeholders(message(locale, row.text)),
            names(row.args),
            `${locale}:${row.text}`,
          );
      for (const [key, args] of [
        [body, spec.body],
        [caution, spec.caution],
      ]) {
        const text = message(locale, key);
        if (typeof text === "string")
          assert.deepEqual(placeholders(text), names(args), `${locale}:${key}`);
      }
    }
    for (const [id, text] of Object.entries(messages[locale].cards.planets))
      if (typeof text === "string" && !id.startsWith("planetCaution"))
        assert.deepEqual(
          placeholders(text),
          names(PLANET_NOTES[id]),
          `${locale}:cards.planets.${id}`,
        );
    assert.deepEqual(placeholders(messages[locale].cards.tracer.cold), names(TRACER_NOTES.cold));
    assert.deepEqual(
      placeholders(messages[locale].cards.tracer.caution),
      names(TRACER_NOTES.caution),
    );
  }
});

test("notes, guide and technical notes quote catalogue figures in both languages", () => {
  for (const locale of LOCALES) {
    const t = createTranslator({
      locale,
      messages: { orrery: messages[locale] },
      namespace: "orrery",
      onError(error) {
        throw error;
      },
    });
    /* Placeholders the components fill at run time, not figures. */
    const runtime = { step: "1", total: "9", time: "today", equation: "P² = a³" };
    const args = { ...proseArgs(locale), ...runtime };
    for (const [key, text] of leaves(messages[locale]))
      if (/^(notes|tour|technicalDetails)\./.test(key)) {
        for (const name of placeholders(text))
          assert.ok(
            name in PROSE_FIGURES || name in runtime,
            `${locale}:${key}: {${name}} is not a catalogue figure`,
          );
        const printed = t(key, args);
        assert.doesNotMatch(printed, /[{}]|NaN|undefined/, `${locale}:${key}`);
      }
  }
  assert.equal(proseArgs("en").sunRadiusKpc, "8.28");
  assert.equal(proseArgs("cs").sunBirthGyr, "4,567");
  assert.equal(proseArgs("en").namedStarsYears, "100,000");
});

test("docs/science-sources.md lists the catalogue and its sources", async () => {
  const { current, next } = await ledger();
  assert.equal(current, next, "Run npm run docs:catalogue.");
  for (const { path, fact } of catalogueFacts()) {
    assert.ok(current.includes(`\`${path}\``), path);
    assert.ok(current.includes(`\`${fact.source}\``), fact.source);
  }
});

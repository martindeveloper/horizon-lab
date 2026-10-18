import assert from "node:assert/strict";
import test from "node:test";

import { createFormatter, createTranslator } from "next-intl";

import { NAMED, PLANET_IDS } from "@horizon/toolkit/bodies";
import { UNITS } from "@horizon/toolkit/science";

import { cardFor } from "../src/features/orrery/components/cards.tsx";
import { PROSE_FIGURES, catalogueFacts } from "../src/features/orrery/lib/model/catalogue/index.ts";
import { proseArgs } from "../src/lib/facts.ts";
import { solarCatalogueFacts } from "../src/space/solar-system/model/catalogue.ts";
import { featureMessages } from "./messages-helper.mjs";

const LOCALES = ["en", "cs"];
const messages = Object.fromEntries(
  LOCALES.map((locale) => [locale, featureMessages("orrery", locale)]),
);

const SELECTIONS = [
  { kind: "sun" },
  ...PLANET_IDS.map((id) => ({ kind: "planet", id })),
  ...NAMED.map((body) => ({ kind: "named", id: body.id })),
  ...["asteroids", "disk", "kuiper", "scattered", "oort", "ejected"].map((id) => ({
    kind: "population",
    id,
  })),
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

test("catalogue quantities use supported units, finite ordered ranges and consistent model values", () => {
  const plain = new Set(["count", "percent", "ratio"]);
  for (const { path, fact } of [...solarCatalogueFacts(), ...catalogueFacts()]) {
    assert.ok(fact.unit in UNITS || plain.has(fact.unit), `${path}: unit ${fact.unit}`);
    assert.ok(!fact.show || fact.show in UNITS, `${path}: shown in ${fact.show}`);
    assert.ok(fact.value !== undefined || fact.range, `${path}: a value or a published span`);
    for (const v of [fact.value, ...(fact.range ?? [])])
      if (v !== undefined) {
        assert.ok(Number.isFinite(v), `${path}: ${v}`);
      }
    if (fact.range) {
      const [low, high] = fact.range;
      assert.ok(low < high, `${path}: range order`);
      if (fact.value !== undefined)
        assert.ok(low <= fact.value && fact.value <= high, `${path}: value outside its range`);
    }
  }
});

test("cards render every figure in both languages and all distance units", () => {
  for (const { where, card } of cards())
    for (const text of [card.title, card.body, card.caution, ...card.facts.map((f) => f.value)]) {
      assert.doesNotMatch(text, /[{}]|NaN|undefined|Infinity/, where);
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
  /* Auto: au inside half a light-year, ly beyond. */
  const oort = read({ kind: "population", id: "oort" }, "innerEdge");
  assert.match(oort.get("auto"), /2,000–5,000 au$/);
  assert.match(read({ kind: "population", id: "oort" }, "outerEdge").get("auto"), /1\.6–3\.2 ly$/);
});

function leaves(value, prefix = "") {
  return Object.entries(value).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof child === "string" ? [[path, child]] : leaves(child, path);
  });
}

test("runtime prose arguments format without missing substitutions in either locale", () => {
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
    const args = { ...proseArgs(PROSE_FIGURES, locale), ...runtime };
    for (const [key] of leaves(messages[locale]))
      if (/^(notes|tour|technicalDetails)\./.test(key)) {
        const printed = t(key, args);
        assert.doesNotMatch(printed, /[{}]|NaN|undefined/, `${locale}:${key}`);
      }
  }
});

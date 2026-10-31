import assert from "node:assert/strict";
import test from "node:test";

import { createFormatter, createTranslator } from "next-intl";

import { MOON_IDS, NAMED, PLANET_IDS } from "@horizon/toolkit/bodies";

import { cardFor } from "../src/features/orrery/components/cards.tsx";
import { formatYearsAgo } from "../src/features/orrery/components/format.ts";
import { PROSE_FIGURES } from "../src/features/orrery/lib/model/catalogue/index.ts";
import { proseArgs } from "../src/lib/facts.ts";
import { OBSERVATORY_IDS } from "../src/space/solar-system/model/observatories.ts";
import { featureMessages, leaves } from "./messages-helper.mjs";

const LOCALES = ["en", "cs"];
const messages = Object.fromEntries(
  LOCALES.map((locale) => [locale, featureMessages("orrery", locale)]),
);

const SELECTIONS = [
  { kind: "sun" },
  ...PLANET_IDS.map((id) => ({ kind: "planet", id })),
  ...NAMED.map((body) => ({ kind: "named", id: body.id })),
  ...MOON_IDS.map((id) => ({ kind: "moon", id })),
  ...["asteroids", "disk", "kuiper", "scattered", "oort", "ejected"].map((id) => ({
    kind: "population",
    id,
  })),
  { kind: "tracer", index: 3 },
  ...OBSERVATORY_IDS.map((id) => ({ kind: "observatory", id })),
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

test("the orrery's cards render every figure in both languages and all distance units", () => {
  for (const { where, card } of cards())
    for (const text of [card.title, card.body, card.caution, ...card.facts.map((f) => f.value)]) {
      assert.doesNotMatch(text, /[{}]|NaN|undefined|Infinity/, where);
    }
});

test("the orrery's lengths follow the visitor's distance unit and keep the source's precision", () => {
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
      if (/^(notes|tour|technicalDetails|viewHints|epochs|guide)\./.test(key)) {
        const printed = t(key, args);
        assert.doesNotMatch(printed, /[{}]|NaN|undefined/, `${locale}:${key}`);
      }
  }
});

test("years ago keep fixed decimals: two for billions, one for millions", () => {
  const t = (key, values) => `${key}:${values?.value ?? ""}`;
  const f = {
    number: (value, opts) =>
      new Intl.NumberFormat("en-US", {
        minimumFractionDigits: opts.minimumFractionDigits,
        maximumFractionDigits: opts.maximumFractionDigits,
      }).format(value),
  };
  assert.equal(formatYearsAgo(t, f, 4e9, "en"), "time.billion:4.00");
  assert.equal(formatYearsAgo(t, f, 4.5e9, "en"), "time.billion:4.50");
  assert.equal(formatYearsAgo(t, f, 5e6, "en"), "time.million:5.0");
  /* The unit is picked on the printed value: 999,700 years is a million, not "1,000 thousand". */
  assert.equal(formatYearsAgo(t, f, 999_700, "en"), "time.million:1.0");
});

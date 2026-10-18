import assert from "node:assert/strict";
import test from "node:test";

import { UNITS } from "@horizon/toolkit/science";

import { catalogueFacts as deepFieldFacts } from "../src/features/deep-field/lib/model/catalogue/index.ts";
import { catalogueFacts as orreryFacts } from "../src/features/orrery/lib/model/catalogue/index.ts";
import { solarCatalogueFacts } from "../src/space/solar-system/model/catalogue.ts";

for (const [name, facts] of [
  ["Solar System", solarCatalogueFacts],
  ["Orrery", orreryFacts],
  ["Deep Field", deepFieldFacts],
]) {
  test(`${name} quantities have supported units and finite, consistent ranges`, () => {
    const plain = new Set(["count", "percent", "ratio"]);
    for (const { path, fact } of facts()) {
      assert.ok(fact.unit in UNITS || plain.has(fact.unit), `${path}: unit ${fact.unit}`);
      assert.ok(!fact.show || fact.show in UNITS, `${path}: shown in ${fact.show}`);
      assert.ok(fact.value !== undefined || fact.range, `${path}: a value or a published span`);
      for (const value of [fact.value, ...(fact.range ?? [])])
        if (value !== undefined) assert.ok(Number.isFinite(value), `${path}: ${value}`);
      if (fact.range) {
        const [low, high] = fact.range;
        assert.ok(low < high, `${path}: range order`);
        if (fact.value !== undefined)
          assert.ok(low <= fact.value && fact.value <= high, `${path}: value outside its range`);
      }
    }
  });
}

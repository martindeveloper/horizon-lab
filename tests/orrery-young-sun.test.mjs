import assert from "node:assert/strict";
import test from "node:test";

import { SUN } from "../src/features/orrery/lib/model/catalogue/sun.ts";
import { ORRERY_EQUATIONS } from "../src/features/orrery/lib/model/equations.ts";
import {
  habitableZone,
  sunLuminosity,
  youngSunModelled,
} from "../src/features/orrery/lib/model/young-sun.ts";
import { MODEL_START, SUN_BIRTH } from "../src/space/solar-system/model/parameters.ts";
import { HABITABLE_ZONE_AU, youngSunLuminosity } from "../src/space/sun/model/young-sun.ts";

test("the Sun shines at today's output now and at about seven tenths as the sketch starts", () => {
  assert.equal(sunLuminosity(0), 1);
  const start = sunLuminosity(MODEL_START);
  assert.ok(start > 0.7 && start < 0.73, `start ${start}`);
  /* Brightening all the way, and held at the first value before the law applies. */
  let last = start;
  for (let ago = MODEL_START; ago >= 0; ago -= 1e8) {
    const L = sunLuminosity(ago);
    assert.ok(L >= last);
    last = L;
  }
  assert.equal(sunLuminosity(SUN_BIRTH), start);
  assert.equal(youngSunLuminosity.compute({ t: SUN_BIRTH }), 1);
  assert.ok(Math.abs(SUN.sun.start.value - start * 100) < 1e-9);
});

test("the habitable zone sits at its catalogued edges today and moves in with the square root of the output", () => {
  const [inner, outer] = HABITABLE_ZONE_AU;
  assert.deepEqual(habitableZone(0), { inner, outer });
  const ago = 4e9;
  const scale = Math.sqrt(sunLuminosity(ago));
  const zone = habitableZone(ago);
  assert.ok(Math.abs(zone.inner - inner * scale) < 1e-12);
  assert.ok(Math.abs(zone.outer - outer * scale) < 1e-12);
  assert.ok(zone.outer < outer && zone.inner < inner);
});

test("the law is applied from the sketch's start, and its formulas print from the registry", () => {
  assert.equal(youngSunModelled(0), true);
  assert.equal(youngSunModelled(MODEL_START), true);
  assert.equal(youngSunModelled(MODEL_START + 1), false);
  assert.match(ORRERY_EQUATIONS["young-sun-luminosity"].toString(), /L\(t\) = L☉ \/ \(1 \+ 0\.4/);
  assert.match(ORRERY_EQUATIONS["habitable-zone-edge"].toString(), /√\(L \/ L☉\)/);
});

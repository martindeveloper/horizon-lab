import assert from "node:assert/strict";
import test from "node:test";

import DISTANCES from "../src/features/voyage/lib/model/star-distances.json" with { type: "json" };
import { starDistance } from "../src/features/voyage/lib/model/star-distances.ts";
import { ballesterosTemperature, brightStarGeometry } from "../src/space/bright-stars.ts";
import { STARS } from "../src/space/star-catalogue.ts";

test("every catalogue star has a positive SIMBAD distance, and the nearest is α Centauri", () => {
  for (const [name] of STARS) {
    const pc = starDistance(name);
    assert.ok(Number.isFinite(pc) && pc > 1 && pc < 5000, `${name}: ${pc} pc`);
  }
  assert.equal(starDistance("not a star"), 0);
  const nearest = STARS.map(([name]) => [name, starDistance(name)]).sort((a, b) => a[1] - b[1])[0];
  assert.equal(nearest[0], "Rigil Kentaurus");
  assert.ok(nearest[1] > 1.3 && nearest[1] < 1.4);
  // Hipparcos 2007 checks: Sirius 2.64 pc, Vega 7.68 pc, Polaris 133 pc.
  assert.ok(Math.abs(starDistance("Sirius") - 2.64) < 0.02);
  assert.ok(Math.abs(starDistance("Vega") - 7.68) < 0.05);
  assert.ok(Math.abs(starDistance("Polaris") - 133) < 5);
  assert.ok(DISTANCES.source.includes("SIMBAD") && DISTANCES.unit === "pc");
  assert.ok(Object.keys(DISTANCES.stars).every((name) => STARS.some(([n]) => n === name)));
});

test("Ballesteros's formula gives the Sun 5,780 K, a blue star more, a red one less", () => {
  assert.ok(Math.abs(ballesterosTemperature(0.65) - 5780) < 20);
  assert.ok(ballesterosTemperature(-0.2) > 10_000);
  assert.ok(ballesterosTemperature(1.5) < 4000);
  assert.ok(ballesterosTemperature(0) > ballesterosTemperature(0.5));
});

test("parallax attributes are opt-in and leave the shared sky's positions and colours alone", () => {
  const look = { floor: 0.2, full: 1, size: (mag) => 3 - mag * 0.2 };
  const plain = brightStarGeometry(look);
  const flown = brightStarGeometry({ ...look, distanceOf: starDistance });
  assert.equal(plain.getAttribute("distance"), undefined);
  assert.equal(plain.getAttribute("temperature"), undefined);
  assert.deepEqual(flown.getAttribute("position").array, plain.getAttribute("position").array);
  assert.deepEqual(flown.getAttribute("color").array, plain.getAttribute("color").array);
  assert.deepEqual(flown.getAttribute("size").array, plain.getAttribute("size").array);
  const distance = flown.getAttribute("distance");
  const temperature = flown.getAttribute("temperature");
  assert.equal(distance.count, STARS.length);
  assert.equal(temperature.count, STARS.length);
  const sirius = STARS.findIndex(([name]) => name === "Sirius");
  assert.ok(Math.abs(distance.getX(sirius) - 2.64) < 0.02);
  assert.ok(Math.abs(temperature.getX(sirius) / ballesterosTemperature(0) - 1) < 1e-6);
  for (let i = 0; i < STARS.length; i += 1)
    assert.ok(distance.getX(i) > 0 && Number.isFinite(distance.getX(i)), STARS[i][0]);
});

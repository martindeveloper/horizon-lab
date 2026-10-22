import assert from "node:assert/strict";
import test from "node:test";

import { BAND_HEIGHT, BAND_WIDTH, bandMaps, paintSky } from "../src/space/sky/band.ts";

const AXES = { centre: [1, 0, 0], east: [0, 0, 1], pole: [0, 1, 0] };

test("a sky sampled from kept maps is the sky painted afresh, its maps as given", () => {
  const fresh = paintSky({ eras: "both", grains: 200, axes: AXES });
  assert.equal(fresh.maps.length, 2);
  for (const map of fresh.maps) assert.equal(map.rgba.length, BAND_WIDTH * BAND_HEIGHT * 4);
  const kept = bandMaps("both");
  const resampled = paintSky({ eras: "both", grains: 200, axes: AXES, maps: kept });
  assert.deepEqual(
    resampled.clouds.map((c) => [...c.position, ...c.color, ...c.size]),
    fresh.clouds.map((c) => [...c.position, ...c.color, ...c.size]),
  );
  assert.deepEqual(
    resampled.maps.map((m) => m.rgba),
    kept.map((m) => m.rgba),
  );
  /* Another grain count samples other grains from the same maps: today's haze and both eras. */
  const more = paintSky({ eras: "both", grains: 300, axes: AXES, maps: kept });
  assert.equal(more.clouds.length, 4);
  assert.equal(more.clouds[0].size.length, 300);
  assert.notEqual(more.clouds[0].position.length, fresh.clouds[0].position.length);
  assert.equal(paintSky({ eras: "today", grains: 50, axes: AXES }).clouds.length, 2);
});

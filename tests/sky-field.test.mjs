import assert from "node:assert/strict";
import test from "node:test";

import {
  TWINKLE_COUNT,
  brightest,
  meteorDelay,
  meteorPath,
  placeStars,
  scrollLapse,
  starDot,
} from "../src/components/shell/sky-field.ts";

const moment = new Date("2026-10-16T23:00:00Z");

test("the shell sky places the stars above the horizon, south at the centre, equal degrees per pixel", () => {
  const stars = placeStars(moment, 1920, 1080);
  assert.ok(stars.length > 20, `${stars.length} stars up`);
  for (const p of stars) {
    assert.ok(p.altitude > 0, `${p.star[0]} is up`);
    assert.ok(p.x > -8 && p.x < 1928 && p.y > -8 && p.y <= 1080, `${p.star[0]} in the window`);
  }
  // The horizon is the bottom edge and the zenith the top; due south is the middle.
  const highest = stars.reduce((a, b) => (a.altitude > b.altitude ? a : b));
  assert.ok(highest.y < 1080 * (1 - highest.altitude / 90) + 1e-9);
  const south = stars.reduce((a, b) =>
    Math.abs(a.azimuth - 180) < Math.abs(b.azimuth - 180) ? a : b,
  );
  assert.ok(Math.abs(south.x - 960) < Math.abs(south.azimuth - 180) * 12 + 1e-9);
  // A wider window shows more of the same sky; a taller one the same degrees, scaled.
  const wide = placeStars(moment, 3840, 1080);
  assert.ok(wide.length >= stars.length);
  for (const p of stars)
    assert.ok(
      wide.some((q) => q.star === p.star),
      p.star[0],
    );
  const tall = placeStars(moment, 1920, 2160);
  for (const p of stars) {
    const q = tall.find((q) => q.star === p.star);
    // Twice the pixels per degree: the sides lose the stars farthest from south.
    if (Math.abs(p.x - 960) * 2 >= 968) continue;
    assert.ok(q, p.star[0]);
    assert.ok(Math.abs(q.y - 2 * p.y) < 1e-6 && Math.abs(q.x - 960 - 2 * (p.x - 960)) < 1e-6);
  }
});

test("brighter stars draw larger and brighter, the lowest fade into the haze, light pages dim them", () => {
  const at = (mag, altitude, bv = 0) => ({
    star: ["x", 0, 0, mag, bv],
    altitude,
    azimuth: 180,
    x: 0,
    y: 0,
  });
  const sirius = starDot(at(-1.46, 40), false);
  const faint = starDot(at(4, 40), false);
  assert.ok(sirius.radius > faint.radius && sirius.alpha > faint.alpha);
  assert.ok(sirius.glow !== null && faint.glow === null, "only the brightest glow");
  assert.ok(faint.alpha > 0 && faint.radius >= 0.5, "the faintest still show");
  const low = starDot(at(-1.46, 3), false);
  assert.ok(low.alpha < sirius.alpha / 3 && low.glow < sirius.glow, "extinction near the horizon");
  const dim = starDot(at(-1.46, 40), true);
  assert.ok(dim.alpha < sirius.alpha * 0.31 && dim.glow === null);
  assert.deepEqual(dim.colour, [40, 44, 52]);
  assert.notDeepEqual(
    starDot(at(0, 40, -0.2), false).colour,
    starDot(at(0, 40, 1.8), false).colour,
  );
});

test("the twinkles sit on the brightest stars up", () => {
  const stars = placeStars(moment, 1920, 1080);
  const picked = brightest(stars, TWINKLE_COUNT);
  assert.equal(picked.length, TWINKLE_COUNT);
  const limit = Math.max(...picked.map((p) => p.star[3]));
  for (const p of stars)
    if (!picked.includes(p)) assert.ok(p.star[3] >= limit, `${p.star[0]} is fainter`);
  assert.equal(brightest(stars.slice(0, 3), TWINKLE_COUNT).length, 3);
});

test("a meteor falls every 9 to 24 seconds, starting across the upper sky", () => {
  assert.equal(
    meteorDelay(() => 0),
    9000,
  );
  assert.equal(
    meteorDelay(() => 1),
    24000,
  );
  for (const r of [0, 0.5, 1]) {
    const path = meteorPath(() => r);
    assert.ok(path.x >= 15 && path.x <= 85 && path.y >= 5 && path.y <= 45);
    assert.ok(path.angle >= 190 && path.angle <= 220, "falling leftward and down");
  }
});

test("scrolling runs the sky forward about an hour per 1,000 px, and not without a mouse or motion", () => {
  const hour = scrollLapse(1000, true) / 3.6e6;
  assert.ok(hour > 1 && hour < 1.2, `${hour} h`);
  assert.equal(scrollLapse(0, true), 0);
  assert.equal(scrollLapse(1000, false), 0);
});

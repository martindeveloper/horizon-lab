import assert from "node:assert/strict";
import test from "node:test";

import { nearestStar } from "../src/components/shell/sky-picking.ts";
import { horizontalPositions, OBSERVER } from "../src/components/shell/stars.ts";

const placed = (name, magnitude, x, y) => ({ star: [name, 0, 0, magnitude, 0], x, y });

test("hover selects the nearest star even when its neighbour is brighter", () => {
  const faint = placed("faint", 4, 101, 100);
  const bright = placed("bright", 1, 110, 100);
  for (const stars of [
    [faint, bright],
    [bright, faint],
  ]) {
    assert.equal(nearestStar(stars, 100, 100, 22), faint);
    assert.equal(nearestStar(stars, faint.x, faint.y, 22), faint);
  }
});

test("brightness breaks exact distance ties, regardless of catalogue order", () => {
  const faint = placed("faint", 4, 3, 4);
  const bright = placed("bright", 1, 0, 5);
  for (const stars of [
    [faint, bright],
    [bright, faint],
  ]) {
    assert.equal(nearestStar(stars, 0, 0, 22), bright);
  }
  // A slightly closer star still wins; brightness is not a proximity weight.
  assert.equal(nearestStar([bright, { ...faint, y: 3.999 }], 0, 0, 22)?.star[0], "faint");
});

test("hover includes the radius boundary and ignores stars outside it", () => {
  const boundary = placed("boundary", 4, 22, 0);
  const outside = placed("outside", -1, 22.001, 0);
  assert.equal(nearestStar([outside, boundary], 0, 0, 22), boundary);
  assert.equal(nearestStar([outside], 0, 0, 22), undefined);
  assert.equal(nearestStar([], 0, 0, 22), undefined);
});

test("hover identifies individual Pleiades stars instead of always selecting Alcyone", () => {
  // The catalogue's south-facing 1920×1080 projection, 90° vertically.
  const stars = horizontalPositions(
    new Date("2026-10-16T23:00:00Z"),
    OBSERVER.latitude,
    OBSERVER.longitude,
  )
    .filter(({ altitude }) => altitude > 0)
    .map((position) => ({
      ...position,
      x: 960 + (position.azimuth - 180) * 12,
      y: 1080 - position.altitude * 12,
    }));
  const alcyone = stars.find(({ star }) => star[0] === "Alcyone");
  assert.ok(alcyone);
  for (const name of ["Atlas", "Electra", "Maia", "Merope", "Taygeta"]) {
    const target = stars.find(({ star }) => star[0] === name);
    assert.ok(target, name);
    assert.ok(target.x > 0 && target.x < 1920 && target.y > 0 && target.y < 1080, name);
    assert.ok(Math.hypot(target.x - alcyone.x, target.y - alcyone.y) < 22, name);
    assert.equal(nearestStar(stars, target.x, target.y, 22), target, name);
  }
});

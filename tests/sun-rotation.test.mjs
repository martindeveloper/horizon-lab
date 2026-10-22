import assert from "node:assert/strict";
import test from "node:test";

import { RAD_PER_DEG } from "@horizon/toolkit/science";

import { NAMED_STARS } from "../src/space/stellar.ts";
import { TACHOCLINE_R, TACHOCLINE_THICKNESS_R } from "../src/space/sun/model/parameters.ts";
import {
  INTERIOR_RATE,
  lagBehindEquator,
  rateAt,
  surfacePeriod,
  surfaceRate,
  turnAt,
} from "../src/space/sun/model/rotation.ts";

const DAY_S = 86_400;

test("the equator turns in 24.5 days sidereal, Carrington's latitude in 25.4, the poles in a month or more", () => {
  const equator = surfacePeriod(0) / DAY_S;
  assert.ok(Math.abs(equator - 24.47) < 0.02, `${equator} d`);
  assert.ok(
    Math.abs(equator - NAMED_STARS.sun.rotation.value) < 0.01,
    "the shared catalogue's figure",
  );
  const carrington = surfacePeriod(26 * RAD_PER_DEG) / DAY_S;
  assert.ok(Math.abs(carrington - 25.38) < 0.05, `${carrington} d at 26°`);
  const pole = surfacePeriod(90 * RAD_PER_DEG) / DAY_S;
  assert.ok(pole > 33 && pole < 36, `${pole} d`);
});

test("the surface turns slower at every higher latitude, alike in both hemispheres", () => {
  for (let deg = 0; deg < 90; deg += 5) {
    const here = surfaceRate(deg * RAD_PER_DEG);
    const higher = surfaceRate((deg + 5) * RAD_PER_DEG);
    assert.ok(higher < here, `${deg}°`);
    assert.equal(surfaceRate(-deg * RAD_PER_DEG), here);
  }
});

test("the interior turns rigidly below the tachocline and differentially above it", () => {
  const below = TACHOCLINE_R - TACHOCLINE_THICKNESS_R - 0.05;
  for (const lat of [0, 0.5, 1, 1.5]) {
    assert.equal(rateAt(below, lat), INTERIOR_RATE, `rigid at latitude ${lat}`);
    assert.equal(rateAt(0.2, lat), INTERIOR_RATE);
    assert.ok(Math.abs(rateAt(1, lat) - surfaceRate(lat)) < 1e-12, "the surface law at the top");
    assert.ok(
      Math.abs(rateAt(0.85, lat) - surfaceRate(lat)) < 1e-12,
      "constant on radial lines through the convection zone",
    );
  }
  /* The rigid rate sits between the equator's and the poles': a 26.5-day turn. */
  assert.ok(INTERIOR_RATE < surfaceRate(0) && INTERIOR_RATE > surfaceRate(Math.PI / 2));
  const interiorDays = (2 * Math.PI) / INTERIOR_RATE / DAY_S;
  assert.ok(interiorDays > 26 && interiorDays < 27.5, `${interiorDays} d`);
  /* Across the tachocline the rate changes smoothly from one to the other. */
  const mid = rateAt(TACHOCLINE_R - TACHOCLINE_THICKNESS_R / 2, 0);
  assert.ok(mid > INTERIOR_RATE && mid < surfaceRate(0));
});

test("turning and lag follow from the rates", () => {
  assert.equal(turnAt(1, 0, DAY_S), surfaceRate(0) * DAY_S);
  assert.ok(Math.abs(turnAt(1, 0, surfacePeriod(0)) - 2 * Math.PI) < 1e-9, "one period, one turn");
  assert.ok(lagBehindEquator(0.6, DAY_S) < 0, "a mid-latitude feature falls behind");
  assert.equal(lagBehindEquator(0, DAY_S), 0);
});

import assert from "node:assert/strict";
import test from "node:test";

import { RAD_PER_DEG } from "@horizon/toolkit/science";

import {
  AR_13664,
  MAP_CENTRAL_MERIDIAN_DEG,
  MAP_EPOCH,
  OBSERVED_REGIONS,
  centralMeridianAt,
  createSunModel,
} from "../src/space/sun/frame.ts";
import { haleLeadingNorth, regionLife } from "../src/space/sun/model/activity.ts";
import {
  CARRINGTON_RATE_DEG_PER_DAY,
  CENTRAL_MERIDIANS,
  modelLongitude,
} from "../src/space/sun/model/observed.ts";
import { DAY_S, OBSERVED_START_SHARE } from "../src/space/sun/model/parameters.ts";
import { lagBehindEquator } from "../src/space/sun/model/rotation.ts";

const input = (time, over = {}) => ({
  time,
  cyclePhase: 25.4,
  light: "white",
  eruptionScrub: null,
  fieldLineCount: 0,
  ...over,
});
const TAU = 2 * Math.PI;
const angleGap = (a, b) => Math.abs(((((a - b) % TAU) + 1.5 * TAU) % TAU) - Math.PI);

test("the map's regions are the SWPC reports' regions, AR 13664 among them at −20°", () => {
  assert.ok(OBSERVED_REGIONS.length >= 20);
  const numbers = OBSERVED_REGIONS.map((r) => r.number);
  assert.deepEqual(
    numbers,
    [...numbers].sort((a, b) => a - b),
    "by NOAA number",
  );
  assert.equal(new Set(numbers).size, numbers.length);
  assert.ok(
    AR_13664 && Math.abs(AR_13664.lat / RAD_PER_DEG + 20) < 1.5,
    `13664 at ${AR_13664.lat / RAD_PER_DEG}°`,
  );
  assert.ok(AR_13664.areaMsh > 500, "the big one");
  for (const region of OBSERVED_REGIONS) {
    assert.ok(Math.abs(region.lat) < 40 * RAD_PER_DEG, `${region.number} at a spot latitude`);
    assert.ok(region.size > 0 && region.lon >= 0 && region.lon < TAU);
    assert.ok(Math.abs(region.stonyhurstLon) <= 76, "within the disc the mosaic sampled");
    assert.ok(region.date.startsWith("2024-05"));
  }
  /* The map's epoch sits in the window the discs span. */
  assert.ok(MAP_EPOCH > Date.UTC(2024, 4, 1) && MAP_EPOCH < Date.UTC(2024, 4, 22));
});

test("the central meridian falls at the Carrington synodic rate and fixes the model's longitude zero", () => {
  assert.ok(Math.abs(CARRINGTON_RATE_DEG_PER_DAY - 13.2) < 0.01);
  for (let i = 1; i < CENTRAL_MERIDIANS.length; i++) {
    const a = CENTRAL_MERIDIANS[i - 1];
    const b = CENTRAL_MERIDIANS[i];
    const days = (b.date - a.date) / (DAY_S * 1e3);
    const predicted = (((a.lon - CARRINGTON_RATE_DEG_PER_DAY * days) % 360) + 360) % 360;
    /* The reports round to whole degrees and the synodic rate drifts a little with Earth's orbit. */
    assert.ok(Math.abs(predicted - b.lon) < 2.5, `report ${i}: ${predicted} against ${b.lon}`);
  }
  for (const report of CENTRAL_MERIDIANS)
    assert.ok(Math.abs(centralMeridianAt(report.date) - report.lon) < 1e-9);
  assert.ok(Math.abs(MAP_CENTRAL_MERIDIAN_DEG - centralMeridianAt(MAP_EPOCH)) < 1e-12);
  /* A region at the central meridian at the epoch stands at longitude zero; one west of it ahead. */
  assert.ok(modelLongitude(MAP_CENTRAL_MERIDIAN_DEG) < 1e-9);
  assert.ok(Math.abs(modelLongitude(MAP_CENTRAL_MERIDIAN_DEG + 30) - 30 * RAD_PER_DEG) < 1e-9);
  for (const region of OBSERVED_REGIONS)
    assert.ok(Math.abs(region.lon - modelLongitude(region.carringtonLon)) < 1e-12);
});

test("a visit starts with the observed regions in place, Hale's polarities by hemisphere, then lets them decay", () => {
  const model = createSunModel(5, { observed: OBSERVED_REGIONS });
  const frame = model.frameAt(input(0));
  const slots = Math.min(OBSERVED_REGIONS.length, frame.regions.length);
  assert.ok(slots >= 10);
  for (let k = 0; k < slots; k++) {
    const seen = OBSERVED_REGIONS[k];
    const region = frame.regions[k];
    assert.equal(region.id, 20_000_000 + seen.number);
    assert.equal(region.lat, seen.lat);
    assert.ok(angleGap(region.lon, seen.lon) < 1e-9, `${seen.number} at its longitude`);
    assert.equal(region.size, seen.size);
    assert.ok(region.strength > 0.99, `${seen.number} in its prime at the start`);
    const hemisphere = seen.lat >= 0 ? 1 : -1;
    assert.equal(region.polarity, haleLeadingNorth(25) * hemisphere, `${seen.number} follows Hale`);
    assert.ok(region.tilt >= 0);
  }
  const southern = frame.regions.slice(0, slots).filter((r) => r.lat < 0);
  assert.ok(
    southern.length > 0 && southern.every((r) => r.polarity === -1),
    "cycle 25 leads negative in the south",
  );
  /* Later: in place but turned with its latitude, and weaker. */
  const first = OBSERVED_REGIONS[0];
  const later = model.frameAt(input(20 * DAY_S)).regions[0];
  if (later.id === 20_000_000 + first.number) {
    assert.ok(later.strength < 0.95, "decaying");
    assert.ok(angleGap(later.lon, first.lon + lagBehindEquator(first.lat, 20 * DAY_S)) < 1e-9);
  }
  /* After its life the slot belongs to the statistical weather, never to the observed region again. */
  const life = regionLife(first.size);
  const gone = model.frameAt(input(life * (1 - OBSERVED_START_SHARE) + DAY_S)).regions[0];
  assert.notEqual(gone.id, 20_000_000 + first.number);
  const muchLater = model.frameAt(input(400 * DAY_S));
  assert.ok(
    muchLater.regions.every((r) => r.id < 20_000_000),
    "all statistical a year on",
  );
  /* The eruption scrub picks the strongest: AR 13664. */
  const scrubbed = model.frameAt(input(0, { eruptionScrub: 0.5 }));
  assert.equal(scrubbed.eruption.regionId, 20_000_000 + AR_13664.number);
  /* Without the option the weather is statistical from the start. */
  const plain = createSunModel(5).frameAt(input(0));
  assert.ok(plain.regions.every((r) => r.id < 20_000_000));
});

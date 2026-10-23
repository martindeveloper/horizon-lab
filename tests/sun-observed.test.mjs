import assert from "node:assert/strict";
import test from "node:test";

import { RAD_PER_DEG } from "@horizon/toolkit/science";

import {
  AR_13664,
  MAP_CENTRAL_MERIDIAN_DEG,
  MAP_EPOCH,
  OBSERVED_REGIONS,
  SEEDED_GROUPS,
  SPOT_GROUPS,
  centralMeridianAt,
  createSunModel,
  photoDrawOf,
  unclaimedSpotShare,
} from "../src/space/sun/frame.ts";
import { haleLeadingNorth, regionLife } from "../src/space/sun/model/activity.ts";
import {
  CARRINGTON_RATE_DEG_PER_DAY,
  CENTRAL_MERIDIANS,
  modelLongitude,
} from "../src/space/sun/model/observed.ts";
import { DAY_S, OBSERVED_START_SHARE } from "../src/space/sun/model/parameters.ts";
import { lagBehindEquator } from "../src/space/sun/model/rotation.ts";
import { SEEDED_ID_BASE } from "../src/space/sun/model/spot-groups.ts";

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

test("a visit starts with the photograph's groups in place, Hale's polarities by hemisphere, then lets them decay", () => {
  const model = createSunModel(5, { seeded: SEEDED_GROUPS });
  const frame = model.frameAt(input(0));
  assert.equal(SEEDED_GROUPS.length, frame.regions.length, "a group in every slot");
  SEEDED_GROUPS.forEach((group, k) => {
    const region = frame.regions[k];
    assert.equal(region.id, SEEDED_ID_BASE + group.key);
    assert.equal(region.lat, group.lat);
    assert.ok(angleGap(region.lon, group.lon) < 1e-9, `${group.key} at its longitude`);
    assert.equal(region.size, group.size);
    assert.ok(region.strength > 0.99, `${group.key} in its prime at the start`);
    const hemisphere = group.lat >= 0 ? 1 : -1;
    assert.equal(region.polarity, haleLeadingNorth(25) * hemisphere, `${group.key} follows Hale`);
    assert.ok(region.tilt >= 0);
  });
  const southern = frame.regions.filter((r) => r.lat < 0);
  assert.ok(
    southern.length > 0 && southern.every((r) => r.polarity === -1),
    "cycle 25 leads negative in the south",
  );
  /* Later: in place but turned with its latitude, and weaker. */
  const first = SEEDED_GROUPS[0];
  const later = model.frameAt(input(20 * DAY_S)).regions[0];
  assert.equal(later.id, SEEDED_ID_BASE + first.key);
  assert.ok(later.strength < 0.95, "decaying");
  assert.ok(angleGap(later.lon, first.lon + lagBehindEquator(first.lat, 20 * DAY_S)) < 1e-9);
  /* After its life the slot belongs to the statistical weather, never to the group again. */
  const life = regionLife(first.size);
  const gone = model.frameAt(input(life * (1 - OBSERVED_START_SHARE) + DAY_S)).regions[0];
  assert.notEqual(gone.id, SEEDED_ID_BASE + first.key);
  const muchLater = model.frameAt(input(400 * DAY_S));
  assert.ok(
    muchLater.regions.every((r) => r.id < SEEDED_ID_BASE),
    "all statistical a year on",
  );
  /* The eruption scrub picks the strongest: AR 13664, the photograph's largest group. */
  const scrubbed = model.frameAt(input(0, { eruptionScrub: 0.5 }));
  assert.equal(scrubbed.eruption.regionId, SEEDED_ID_BASE + AR_13664.number);
  /* Without the option the weather is statistical from the start. */
  const plain = createSunModel(5).frameAt(input(0));
  assert.ok(plain.regions.every((r) => r.id < SEEDED_ID_BASE));
});

test("a cycle moved off the Sun's own has none of the photograph's groups", () => {
  const model = createSunModel(5, { seeded: SEEDED_GROUPS });
  const own = model.frameAt(input(0));
  assert.equal(own.photographed, true);
  assert.ok(
    own.regions.some((r) => r.id > SEEDED_ID_BASE),
    "the Sun's own cycle starts from them",
  );
  for (const time of [0, 5 * DAY_S]) {
    const moved = model.frameAt(input(time, { cyclePhase: 25.05, ownCycle: false }));
    assert.equal(moved.photographed, false);
    assert.ok(
      moved.regions.every((r) => r.id < SEEDED_ID_BASE),
      `no photographed group at day ${time / DAY_S}`,
    );
  }
  /* The eruption then rises over the model's own weather. */
  const scrubbed = model.frameAt(input(0, { eruptionScrub: 0.5, ownCycle: false }));
  assert.ok(scrubbed.eruption.regionId < SEEDED_ID_BASE);
});

test("the photograph's groups are seeded where it has them, largest first, numbered where a report stands near", () => {
  assert.ok(SPOT_GROUPS.length > SEEDED_GROUPS.length, "more groups than slots");
  for (let k = 1; k < SPOT_GROUPS.length; k++)
    assert.ok(SPOT_GROUPS[k].areaMsh <= SPOT_GROUPS[k - 1].areaMsh, "largest first");
  assert.deepEqual(SEEDED_GROUPS, SPOT_GROUPS.slice(0, SEEDED_GROUPS.length));
  assert.equal(new Set(SPOT_GROUPS.map((g) => g.key)).size, SPOT_GROUPS.length, "unique keys");
  assert.equal(SPOT_GROUPS[0].number, AR_13664.number, "AR 13664 is the largest");
  for (const group of SPOT_GROUPS) {
    assert.ok(group.reach > 0 && group.size > 0);
    if (group.number === null) continue;
    const report = OBSERVED_REGIONS.find((r) => r.number === group.number);
    if (!report) continue;
    /* A report places its group at 00:00 UT of a disc; the mosaic may show it from another. */
    const apart = Math.acos(
      Math.sin(report.lat) * Math.sin(group.lat) +
        Math.cos(report.lat) * Math.cos(group.lat) * Math.cos(report.lon - group.lon),
    );
    assert.ok(apart < 8 * RAD_PER_DEG, `${group.number} within 8° of its report`);
  }
});

test("each region draws a photographed patch in place: its own as seeded, a resting donor's as grown", () => {
  const seeded = (strength) => ({
    id: SEEDED_ID_BASE + AR_13664.number,
    lat: AR_13664.lat,
    lon: 0,
    tilt: 0,
    size: SEEDED_GROUPS[0].size,
    polarity: 1,
    age: 0,
    strength,
    flare: 0,
    facula: 0,
  });
  const prime = photoDrawOf(seeded(1), 0);
  assert.equal(prime.donor, SEEDED_GROUPS[0], "its own photographed group");
  assert.equal(prime.scale, 1, "at the photograph's scale");
  assert.equal(prime.growth, 1, "all of it in its prime: the photograph itself");
  assert.equal(prime.turn, 0);
  /* Decaying, it stays where and as large as it is: only the share of its spots it keeps falls. */
  const decayed = photoDrawOf(seeded(0.25), 30 * DAY_S);
  assert.equal(decayed.scale, 1, "no shrinking toward its centre");
  assert.equal(decayed.growth, 0.25);
  assert.equal(photoDrawOf(seeded(0), 60 * DAY_S).growth, 0, "gone with the region");
  /* A grown region: never the face of a seeded group on the disc, or gone less than a rotation. */
  const grown = (id, bornDay) => ({ ...seeded(0.64), id, size: 0.02, age: 0, bornDay });
  for (let id = 1; id <= 60; id++) {
    const born = 10 * DAY_S;
    const draw = photoDrawOf(grown(id, 10), born);
    const seat = SEEDED_GROUPS.indexOf(draw.donor);
    if (seat >= 0)
      assert.fail(`region ${id} borrows seeded group ${draw.donor.key}, still on the disc`);
    assert.ok(draw.donor.size >= 0.7 * 0.02 || draw.donor === SPOT_GROUPS[SEEDED_GROUPS.length]);
    assert.ok(draw.turn >= 0 && draw.turn < 2 * Math.PI);
    assert.equal(draw.growth, 0.64);
    assert.deepEqual(photoDrawOf(grown(id, 10), born), draw, "the same for the same region");
  }
  /* A year on every photographed group may lend again. */
  const lenders = new Set(
    Array.from({ length: 80 }, (_, id) => photoDrawOf(grown(id + 1, 365), 365 * DAY_S).donor.key),
  );
  assert.ok([...lenders].some((key) => SEEDED_GROUPS.some((g) => g.key === key)));
  assert.ok(lenders.size > 5, "grown regions borrow from many groups");
});

test("the photograph's unclaimed spots decay from the epoch as the largest of them would", () => {
  assert.equal(unclaimedSpotShare(0), 1);
  assert.ok(unclaimedSpotShare(5 * DAY_S) < 1);
  assert.ok(unclaimedSpotShare(5 * DAY_S) > unclaimedSpotShare(10 * DAY_S));
  assert.equal(unclaimedSpotShare(400 * DAY_S), 0);
});

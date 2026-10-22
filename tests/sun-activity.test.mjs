import assert from "node:assert/strict";
import test from "node:test";

import {
  createForecast,
  flareCurve,
  flareFlux,
  goesClassOf,
  goesFlux,
  haleLeadingNorth,
  regionLife,
  regionStrength,
  sporerLatitude,
  weatherAt,
} from "../src/space/sun/model/activity.ts";
import {
  activityAt,
  cycleCountAt,
  cyclePhaseAt,
  cyclePhaseOf,
  cycleShape,
  groupNumberIn,
  sunspotNumberIn,
  wolfNumber,
  MAUNDER_MINIMUM,
} from "../src/space/sun/model/cycle.ts";
import {
  CYCLE_RISE_YR,
  CYCLE_PERIOD_YR,
  CYCLE_25_MINIMUM_YEAR,
  DAY_S,
  ERUPTING_FLUX,
  FLARE_MAX_FLUX,
  FLARE_MIN_FLUX,
  FLARE_POWER_INDEX,
  GOES_CLASS_FLUX,
  PROMINENCE_SLOTS,
  QUIESCENT_SLOTS,
  REGION_SLOTS,
  REGION_WINDOW_D,
  SPORER_END_RAD,
  SPORER_START_RAD,
} from "../src/space/sun/model/parameters.ts";

const SEED = 11;
const live = (weather) => weather.regions.filter((region) => region.strength > 0);

test("the weather replays exactly from the seed, the time and the cycle count", () => {
  const forecast = createForecast();
  const a = structuredClone(forecast.at(SEED, 123 * DAY_S + 4_321, 25.37));
  forecast.at(SEED, 999 * DAY_S, 25.9);
  forecast.at(SEED + 1, 123 * DAY_S + 4_321, 25.37);
  const b = structuredClone(forecast.at(SEED, 123 * DAY_S + 4_321, 25.37));
  assert.deepEqual(b, a);
  assert.notDeepEqual(
    structuredClone(weatherAt(SEED + 1, 123 * DAY_S + 4_321, 25.37)),
    a,
    "another seed, other weather",
  );
});

test("a forecast fills the same slots each call and never exceeds them", () => {
  const forecast = createForecast();
  const first = forecast.at(SEED, 0, 25.5);
  const regions = first.regions;
  for (let day = 0; day < 400; day += 7) {
    const weather = forecast.at(SEED, day * DAY_S, 25 + day / (CYCLE_PERIOD_YR * 365.25));
    assert.equal(weather, first, "one object");
    assert.equal(weather.regions, regions);
    assert.equal(weather.regions.length, REGION_SLOTS);
    assert.equal(weather.prominences.length, PROMINENCE_SLOTS);
    for (const region of weather.regions) {
      assert.ok(region.strength >= 0 && region.strength <= 1);
      assert.ok(region.facula >= 0 && region.facula <= 1.0001);
      assert.ok(region.flare >= 0);
      if (region.strength === 0) assert.equal(region.id, 0, "an empty slot has no id");
    }
    for (const prominence of weather.prominences) {
      assert.ok(prominence.fade >= 0 && prominence.fade <= 1);
      assert.ok(prominence.erupting >= 0 && prominence.erupting <= 1);
    }
  }
});

test("regions drift towards the equator over a cycle (Spörer) and more of them live near maximum", () => {
  assert.ok(Math.abs(sporerLatitude(0) - SPORER_START_RAD) < 1e-12);
  assert.ok(Math.abs(sporerLatitude(1) - SPORER_END_RAD) < 1e-12);
  const meanLatitude = (phase) => {
    let sum = 0;
    let n = 0;
    for (let k = 0; k < 60; k++) {
      const weather = weatherAt(SEED + k, (k * 37 + 5) * DAY_S, 24 + phase);
      for (const region of live(weather)) {
        sum += Math.abs(region.lat);
        n++;
      }
    }
    return { mean: sum / n, count: n / 60 };
  };
  const early = meanLatitude(0.1);
  const peak = meanLatitude(CYCLE_RISE_YR / CYCLE_PERIOD_YR);
  const late = meanLatitude(0.9);
  assert.ok(early.mean > late.mean + 0.15, `${early.mean} → ${late.mean} rad`);
  assert.ok(
    peak.count > 3 * late.count,
    `${peak.count} regions at maximum against ${late.count} late`,
  );
  assert.ok(peak.count > 3 * meanLatitude(0.02).count, "and against the start");
});

test("Hale's law: leading polarities flip across the equator and from one cycle to the next", () => {
  assert.equal(haleLeadingNorth(24), -1);
  assert.equal(haleLeadingNorth(25), 1, "cycle 25 leads positive in the north");
  for (const cycle of [24, 25]) {
    for (let k = 0; k < 40; k++) {
      const weather = weatherAt(SEED + k, k * 11 * DAY_S, cycle + 0.4);
      for (const region of live(weather)) {
        const hemisphere = region.lat > 0 ? 1 : -1;
        assert.equal(
          region.polarity,
          haleLeadingNorth(cycle) * hemisphere,
          `cycle ${cycle}, lat ${region.lat}`,
        );
        assert.ok(region.tilt > -0.5 && region.tilt < 1, "Joy's tilt, poleward on the whole");
      }
    }
  }
});

test("a region grows fast, decays slowly and lives longer the larger it is", () => {
  assert.equal(regionStrength(0), 0);
  assert.equal(regionStrength(1), 0);
  assert.ok(regionStrength(0.15) > 0.99);
  assert.ok(regionStrength(0.05) > regionStrength(0.02));
  assert.ok(regionStrength(0.5) > regionStrength(0.8));
  assert.ok(regionLife(0.08) > regionLife(0.03));
  assert.ok(regionLife(0.3) <= REGION_WINDOW_D * DAY_S, "within its window");
});

test("flares follow the power law between their bounds, with GOES classes read off the flux", () => {
  assert.ok(Math.abs(flareFlux(0) - FLARE_MIN_FLUX) < 1e-12);
  assert.ok(Math.abs(flareFlux(1) - FLARE_MAX_FLUX) < 1e-9);
  /* Counts above a flux fall as F^(1−α). */
  const n = 200_000;
  let aboveC = 0;
  let aboveM = 0;
  for (let i = 0; i < n; i++) {
    const flux = flareFlux((i + 0.5) / n);
    if (flux >= GOES_CLASS_FLUX.C) aboveC++;
    if (flux >= GOES_CLASS_FLUX.M) aboveM++;
  }
  const ratio = aboveM / aboveC;
  const expected = 10 ** (1 - FLARE_POWER_INDEX);
  assert.ok(Math.abs(ratio / expected - 1) < 0.1, `M:C ${ratio} against ${expected}`);
  assert.equal(goesClassOf(5.2e-5), "M5.2");
  assert.equal(goesClassOf(2e-4), "X2.0");
  assert.equal(goesClassOf(3.1e-7), "B3.1");
  assert.ok(Math.abs(goesFlux(3, 5.2) - 5.2e-5) < 1e-15);
  /* The light curve rises fast and decays slowly, peaking at 1. */
  const flux = GOES_CLASS_FLUX.M;
  assert.equal(flareCurve(-1, flux), 0);
  let peak = 0;
  let peakAt = 0;
  for (let t = 0; t < 4 * 3_600; t += 10) {
    const light = flareCurve(t, flux);
    if (light > peak) {
      peak = light;
      peakAt = t;
    }
  }
  assert.ok(Math.abs(peak - 1) < 1e-3);
  assert.ok(peakAt < 20 * 60, "peaks within twenty minutes");
  assert.ok(flareCurve(peakAt + 3_600, flux) > 0.1, "still glowing an hour later");
});

test("eruptions come from the largest flares and run their course over the region", () => {
  const forecast = createForecast();
  let seen = 0;
  for (let minute = 0; minute < 400 * 24 * 60 && seen < 3; minute += 5) {
    const weather = forecast.at(SEED, minute * 60, 25.4);
    const { outbreak } = weather;
    if (outbreak.slot < 0) continue;
    seen++;
    assert.ok(outbreak.flux >= ERUPTING_FLUX);
    assert.ok(outbreak.s >= 0 && outbreak.s <= 1);
    assert.equal(weather.regions[outbreak.slot].id, outbreak.regionId);
    const prominence = weather.prominences[QUIESCENT_SLOTS + outbreak.slot];
    if (prominence && outbreak.slot < PROMINENCE_SLOTS - QUIESCENT_SLOTS)
      assert.equal(prominence.erupting, outbreak.s, "its prominence erupts with it");
  }
  assert.ok(seen > 0, "a year of maximum sees an eruption");
  /* Scrubbing puts the eruption where asked, over the strongest region or a stand-in. */
  const scrubbed = forecast.at(SEED, 0, 25.02, 0.6);
  assert.equal(scrubbed.outbreak.s, 0.6);
  assert.ok(scrubbed.regions[scrubbed.outbreak.slot].strength > 0);
});

test("the Wolf number follows the groups and spots, and the record reads as published", () => {
  assert.equal(wolfNumber(3, 12), 42);
  assert.equal(wolfNumber(3, 12, 0.6), 25.2);
  const weather = weatherAt(SEED, 50 * DAY_S, 25.4);
  assert.equal(weather.wolfNumber, wolfNumber(weather.groups, weather.spots));
  assert.ok(weather.groups <= live(weather).length);
  assert.equal(sunspotNumberIn(1957), 269.3);
  assert.equal(sunspotNumberIn(1700), 8.3);
  assert.equal(sunspotNumberIn(1600), undefined);
  assert.ok(groupNumberIn(1680) < 3, "the Maunder minimum");
  const maunder = [];
  for (let year = MAUNDER_MINIMUM[0]; year <= MAUNDER_MINIMUM[1]; year++)
    maunder.push(groupNumberIn(year));
  assert.ok(Math.max(...maunder) < 6 && groupNumberIn(1780) > 5);
  assert.ok(maunder.reduce((a, b) => a + b, 0) / maunder.length < 1.5, "a quiet seventy years");
});

test("the cycle's clock: phase 0 at December 2019, the curve peaking four years in, odd and even cycles told apart", () => {
  const minimum = new Date(Date.UTC(2019, 11, 15));
  const phase = cyclePhaseAt(minimum);
  assert.ok(phase < 0.01 || phase > 0.99, `${phase}`);
  assert.ok(Math.abs(cycleCountAt(minimum) - 25) < 0.01);
  assert.ok(Math.abs(cycleCountAt(new Date(Date.UTC(2030, 11, 15))) - 26) < 0.01);
  assert.ok(Math.abs(cyclePhaseOf(25.37) - 0.37) < 1e-9);
  assert.equal(CYCLE_25_MINIMUM_YEAR > 2019.9 && CYCLE_25_MINIMUM_YEAR < 2020, true);
  let best = 0;
  let bestPhase = 0;
  for (let phase = 0; phase <= 1; phase += 0.001) {
    const value = cycleShape(phase);
    if (value > best) {
      best = value;
      bestPhase = phase;
    }
  }
  assert.ok(Math.abs(best - 1) < 1e-3, `peak ${best}`);
  assert.ok(Math.abs(bestPhase - CYCLE_RISE_YR / CYCLE_PERIOD_YR) < 0.005);
  assert.ok(activityAt(0) > 0 && activityAt(0) < 0.1, "a minimum is quiet, not dead");
  assert.ok(activityAt(0.36) > 0.95);
});

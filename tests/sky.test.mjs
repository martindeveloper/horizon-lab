import assert from "node:assert/strict";
import test from "node:test";

import {
  moonAxis,
  moonEcliptic,
  moonPhase,
  moonPosition,
  OBSERVER,
  risingHourAngle,
  sunPosition,
} from "../src/components/shell/stars.ts";

const at = (iso) => sunPosition(new Date(iso), OBSERVER.latitude, OBSERVER.longitude);

test("the hero sun follows the real Sun over Ondřejov", () => {
  // Solstice noons: 90° − latitude ± obliquity.
  const summer = at("2026-06-21T11:02:00Z");
  assert.ok(Math.abs(summer.altitude - (90 - OBSERVER.latitude + 23.44)) < 0.3);
  assert.ok(Math.abs(summer.azimuth - 180) < 1.5);
  const winter = at("2026-12-21T10:59:00Z");
  assert.ok(Math.abs(winter.altitude - (90 - OBSERVER.latitude - 23.44)) < 0.3);

  // Equinox: rises due east around 05:05 UTC, sets due west around 17:15 UTC.
  const rise = at("2026-03-20T05:05:00Z");
  assert.ok(Math.abs(rise.altitude) < 1.5 && Math.abs(rise.azimuth - 90) < 3);
  const set = at("2026-03-20T17:15:00Z");
  assert.ok(Math.abs(set.altitude) < 1.5 && Math.abs(set.azimuth - 270) < 3);

  // Summer midnight: below the horizon, due north, still inside astronomical twilight.
  const midnight = at("2026-06-21T23:00:00Z");
  assert.ok(midnight.altitude < 0 && midnight.altitude > -18);
  assert.ok(midnight.azimuth > 350 || midnight.azimuth < 10);
});

test("the hero moon matches Meeus' worked examples and known lunations", () => {
  // Meeus, Astronomical Algorithms, example 47.a: 1992 April 12, 0h TD.
  const moon = moonEcliptic(2448724.5);
  assert.ok(Math.abs(moon.longitude - 133.162655) < 0.01);
  assert.ok(Math.abs(moon.latitude - -3.229126) < 0.01);
  assert.ok(Math.abs(moon.distance - 368409.7) < 50);
  // Example 48.a: the same instant, illuminated fraction 0.6786, waxing.
  const phase = moonPhase(2448724.5);
  assert.ok(Math.abs(phase.illumination - 0.6786) < 0.001);
  assert.equal(phase.waxing, true);

  // Total lunar eclipse, 2026 March 3: full, and opposite the Sun.
  const full = new Date("2026-03-03T11:38:00Z");
  const lit = moonPosition(full, OBSERVER.latitude, OBSERVER.longitude);
  const sun = sunPosition(full, OBSERVER.latitude, OBSERVER.longitude);
  assert.ok(lit.illumination > 0.999);
  assert.ok(Math.abs(Math.abs(lit.azimuth - sun.azimuth) - 180) < 5);
  // Annular solar eclipse, 2026 February 17: new, beside the Sun.
  const dark = moonPosition(
    new Date("2026-02-17T12:01:00Z"),
    OBSERVER.latitude,
    OBSERVER.longitude,
  );
  assert.ok(dark.illumination < 0.001);

  // A waxing evening crescent turns its bright limb down toward the set Sun in the west.
  const crescent = moonPosition(
    new Date("2026-10-14T16:30:00Z"),
    OBSERVER.latitude,
    OBSERVER.longitude,
  );
  assert.ok(crescent.waxing && crescent.illumination < 0.3);
  assert.ok(crescent.limb > 90 && crescent.limb < 180);
});

test("the hero moon's phase, bright limb and north follow the sky over Ondřejov", () => {
  const moon = (iso) => moonPosition(new Date(iso), OBSERVER.latitude, OBSERVER.longitude);

  // 2026 lunations: new at the total solar eclipse of 12 August, full at the
  // partial lunar eclipse of 28 August, first quarter on 18 October 16:13 UTC.
  assert.ok(moon("2026-08-12T17:46:00Z").illumination < 0.001);
  assert.ok(moon("2026-08-28T04:13:00Z").illumination > 0.995);
  const quarter = moon("2026-10-18T16:13:00Z");
  assert.ok(Math.abs(quarter.illumination - 0.5) < 0.01 && quarter.waxing);
  // Near the meridian at dusk: lit on the right, toward the Sun in the west; north nearly up.
  assert.ok(Math.abs(quarter.azimuth - 180) < 20);
  assert.ok(Math.abs(quarter.limb - 90) < 15);
  assert.ok(Math.abs(quarter.north) < 25);

  // A waning Moon at dawn is lit on the left, toward the Sun in the east.
  const waning = moon("2026-11-01T06:00:00Z");
  assert.ok(!waning.waxing && waning.limb < 0 && waning.limb > -180);

  // Meeus example 53.a: position angle of the axis 15.08° on 1992 April 12, 0h TD.
  assert.ok(Math.abs(moonAxis(2448724.5) - 15.08) < 0.2);
});

test("the hero dial cuts each body's daily circle where it rises and sets", () => {
  // Equator-crossing bodies are up for half the turn; summer days are longer.
  assert.ok(Math.abs(risingHourAngle(0, OBSERVER.latitude) - 90) < 1e-9);
  assert.ok(risingHourAngle(23.44, OBSERVER.latitude) > 115);
  assert.ok(risingHourAngle(-23.44, OBSERVER.latitude) < 65);
  assert.equal(risingHourAngle(80, OBSERVER.latitude), 180, "Circumpolar: never sets");
  assert.equal(risingHourAngle(-80, OBSERVER.latitude), 0, "Never rises");

  // Solar noon is the top of the dial; sunrise and sunset sit on the line.
  const noon = at("2026-06-21T11:02:00Z");
  assert.ok(Math.abs(noon.hourAngle) < 1);
  for (const iso of ["2026-06-21T02:00:00Z", "2026-10-18T05:30:00Z", "2026-10-18T15:30:00Z"]) {
    const sun = at(iso);
    const rising = risingHourAngle(sun.declination, OBSERVER.latitude);
    const above = Math.cos((sun.hourAngle * Math.PI) / 180) > Math.cos((rising * Math.PI) / 180);
    assert.equal(above, sun.altitude > 0, iso);
  }
  const moon = moonPosition(
    new Date("2026-10-18T12:00:00Z"),
    OBSERVER.latitude,
    OBSERVER.longitude,
  );
  assert.ok(Math.abs(moon.hourAngle) <= 180 && Math.abs(moon.declination) < 29);
});

import assert from "node:assert/strict";
import test from "node:test";

import { clockDate, solarEvents } from "../src/features/orrery/lib/model/events.ts";

const NOW = new Date("2026-10-23T00:00:00Z");
const DAY_MS = 86_400_000;
const events = solarEvents(NOW);
const byId = Object.fromEntries(events.map((e) => [e.id, e]));
const within = (id, iso, days) => {
  const event = byId[id];
  assert.ok(event, `${id} is found`);
  const off = (event.date.getTime() - Date.parse(iso)) / DAY_MS;
  assert.ok(
    Math.abs(off) <= days,
    `${id}: ${event.date.toISOString()} is ${off.toFixed(1)} d from ${iso}`,
  );
  return event;
};

test("the moments found on the orbits land on the almanac's dates", () => {
  /* Earth's next perihelion: early January 2027. */
  within("earth-perihelion", "2027-01-03T00:00:00Z", 3);
  /* Mars's next opposition: 19 February 2027. */
  within("mars-opposition", "2027-02-19T00:00:00Z", 2);
  /* Jupiter and Saturn: the great conjunction of 21 December 2020 behind us, the next in late 2040. */
  within("great-conjunction-last", "2020-12-21T00:00:00Z", 2);
  within("great-conjunction", "2040-11-01T00:00:00Z", 5);
  /* Mercury next crosses the Sun on 13 November 2032. */
  within("mercury-transit", "2032-11-13T00:00:00Z", 2);
  /* Ceres's perihelion from the JPL elements, 12 July 2027. */
  within("ceres-perihelion", "2027-07-12T00:00:00Z", 3);
  /* Halley's perihelion on 28 July 2061. */
  within("halley-perihelion", "2061-07-28T00:00:00Z", 3);
  /* Sedna's perihelion, early 2076. */
  within("sedna-perihelion", "2076-02-14T00:00:00Z", 60);
});

test("moments carry their offset from today, their order and whether the fit was carried past 2050", () => {
  for (let i = 1; i < events.length; i += 1)
    assert.ok(events[i].date >= events[i - 1].date, "in time order");
  const halley = byId["halley-perihelion"];
  assert.ok(halley.extrapolated && !byId["mars-opposition"].extrapolated);
  assert.ok(byId["great-conjunction-last"].years < 0 && halley.years > 30);
  const back = clockDate(NOW, halley.years);
  assert.ok(
    Math.abs(back.getTime() - halley.date.getTime()) < 1000,
    "the clock's date is the moment's",
  );
});

import assert from "node:assert/strict";
import test from "node:test";

import { createTranslator } from "next-intl";

import { AU_KM, JULIAN_YEAR_SECONDS, LIGHT_YEAR_KM } from "@horizon/toolkit/science";

import { cardFor } from "../src/features/voyage/components/cards.ts";
import {
  formatCalendar,
  formatDuration,
  formatIrradiance,
  formatRange,
  formatSpeed,
  formatTrip,
} from "../src/features/voyage/components/format.ts";
import { tripTo } from "../src/features/voyage/components/trips.ts";
import { bodyPositionKm, WORLD_BODIES } from "../src/features/voyage/lib/model/bodies.ts";
import { PROSE_FIGURES } from "../src/features/voyage/lib/model/catalogue.ts";
import {
  C_KM_S,
  DRIVES,
  STANDARD_GRAVITY_KM_S2,
  irradianceAt,
} from "../src/features/voyage/lib/model/parameters.ts";
import { PLACE_BODY, placeFor } from "../src/features/voyage/lib/model/places.ts";
import {
  speedOfProper,
  tripProgress,
  tripProperVelocity,
  tripTimes,
} from "../src/features/voyage/lib/model/relativity.ts";
import {
  createShip,
  shipGamma,
  shipSpeed,
  stepShip,
} from "../src/features/voyage/lib/model/ship.ts";
import { TOUR } from "../src/features/voyage/lib/model/tour.ts";
import { VIEW_IDS } from "../src/features/voyage/lib/model/view-ids.ts";
import { useVoyage } from "../src/features/voyage/lib/store.ts";
import { pathForView, resolveView, viewFromPath } from "../src/features/voyage/routing.ts";
import { proseArgs } from "../src/lib/facts.ts";
import { layoutMessages } from "./messages-helper.mjs";

const YEAR_S = 365.25 * 86_400;
const near = (actual, expected, tolerance, label = "") =>
  assert.ok(
    Math.abs(actual - expected) <= tolerance * Math.abs(expected),
    `${label} ${actual} is not within ${tolerance * 100}% of ${expected}`,
  );

test("the torch ship reaches Andromeda in 28.6 years of its own time while Earth ages 2.5 million", () => {
  const trip = tripTimes(DRIVES.torch, 2.5e6 * LIGHT_YEAR_KM);
  near(trip.tau / YEAR_S, 28.6, 0.02, "ship years");
  near(trip.t / YEAR_S, 2.5e6, 0.01, "Earth years");
  assert.ok(trip.peak < C_KM_S && trip.peak > 0.9999 * C_KM_S);
  /* Halfway through its own time the ship has covered half the way. */
  const half = tripProgress(DRIVES.torch, 2.5e6 * LIGHT_YEAR_KM, 0.5);
  near(half.covered, 0.5, 1e-6);
  near(half.elapsed, 0.5, 1e-6);
  /* A tenth of the way in time, the ship is still crawling: far less than a tenth of the distance. */
  assert.ok(tripProgress(DRIVES.torch, 2.5e6 * LIGHT_YEAR_KM, 0.1).covered < 0.01);
});

test("Voyager coasts to α Centauri in about 77,000 years, Starshot's sail at 0.2 c in 22", () => {
  const km = 4.37 * LIGHT_YEAR_KM;
  near(tripTimes(DRIVES.voyager, km).t / YEAR_S, 77_000, 0.02);
  const sail = tripTimes(DRIVES.sail, km);
  near(sail.t / YEAR_S, 21.85, 0.01);
  near(sail.tau / sail.t, Math.sqrt(1 - 0.04), 1e-9, "the sail's clock runs slow by γ");
});

test("a long torch flight stays finite: its proper velocity grows past where β rounds to 1", () => {
  /* Across the Virgo Cluster's 54 million light-years the burn reaches aτ/c ≈ 19, where tanh is 1. */
  const trip = tripTimes(DRIVES.torch, 5.4e7 * LIGHT_YEAR_KM);
  assert.ok(Number.isFinite(trip.peak) && trip.peak <= C_KM_S, `${trip.peak} km/s`);
  let last = 0;
  for (const s of [0, 0.1, 0.3, 0.5]) {
    const u = tripProperVelocity(DRIVES.torch, s, trip);
    assert.ok(Number.isFinite(u) && u >= last, `${u} km/s at ${s}`);
    assert.ok(speedOfProper(u) <= C_KM_S);
    last = u;
  }
  /* γ at the turnover is in the tens of millions, as the closed form has it. */
  near(
    Math.hypot(1, last / C_KM_S),
    1 + (STANDARD_GRAVITY_KM_S2 * 5.4e7 * LIGHT_YEAR_KM) / (2 * C_KM_S ** 2),
    1e-6,
  );
  /* Braking mirrors the burn; a coast holds its speed. */
  near(
    tripProperVelocity(DRIVES.torch, 0.9, trip),
    tripProperVelocity(DRIVES.torch, 0.1, trip),
    1e-12,
  );
  near(speedOfProper(tripProperVelocity(DRIVES.sail, 0.4, trip)), DRIVES.sail.speed, 1e-12);
});

test("the ship's integrator matches hyperbolic motion at one g", () => {
  const ship = createShip();
  const dir = [1, 0, 0];
  const tau = YEAR_S;
  for (let i = 0; i < 1000; i += 1)
    stepShip(ship, tau / 1000, { accel: STANDARD_GRAVITY_KM_S2, dir });
  const c = C_KM_S;
  const a = STANDARD_GRAVITY_KM_S2;
  near(ship.x[0], ((c * c) / a) * (Math.cosh((a * tau) / c) - 1), 1e-3, "distance");
  near(ship.t, (c / a) * Math.sinh((a * tau) / c), 1e-3, "Earth's clock");
  near(ship.tau, tau, 1e-12);
  near(shipGamma(ship), Math.cosh((a * tau) / c), 1e-3, "γ");
  near(shipSpeed(ship), c * Math.tanh((a * tau) / c), 1e-3, "speed");
  assert.ok(shipSpeed(ship) < c);
  /* Coasting keeps the speed and runs Earth's clock γ times faster than the ship's. */
  const before = { t: ship.t, tau: ship.tau };
  stepShip(ship, 100, null);
  near((ship.t - before.t) / (ship.tau - before.tau), shipGamma(ship), 1e-9);
  /* Thrust across the motion: the four-acceleration adds a·dτ across and leaves the motion's share. */
  const along = ship.u[0];
  stepShip(ship, 10, { accel: STANDARD_GRAVITY_KM_S2, dir: [0, 1, 0] });
  near(ship.u[0], along, 1e-9, "along");
  near(ship.u[1], STANDARD_GRAVITY_KM_S2 * 10, 1e-6, "across");
});

test("a torch trip's progress: half the distance at the turnover, the rest braking", () => {
  const km = 2.5e6 * LIGHT_YEAR_KM;
  near(tripProgress(DRIVES.torch, km, 0.5).covered, 0.5, 1e-9);
  assert.ok(tripProgress(DRIVES.torch, km, 0.9).covered > 0.99);
  near(tripProgress(DRIVES.torch, km, 1).covered, 1, 1e-9);
  near(tripProgress(DRIVES.voyager, km, 0.3).covered, 0.3, 1e-9);
});

test("bodies sit at their true places: Earth near 1 au, the Moon a light-second out, Earth's centre off the barycentre", async () => {
  const date = new Date("2026-10-20T00:00:00Z");
  const earth = bodyPositionKm("earth", date, [0, 0, 0]);
  const moon = bodyPositionKm("moon", date, [0, 0, 0]);
  near(Math.hypot(...earth), AU_KM, 0.02, "Earth from the Sun");
  const gap = Math.hypot(moon[0] - earth[0], moon[1] - earth[1], moon[2] - earth[2]);
  assert.ok(gap > 356_000 && gap < 407_000, `${gap} km to the Moon`);
  /* The barycentre offset is applied: Earth's centre is not on the JPL point. */
  const { planetElements } = await import("../src/space/solar-system/model/elements.ts");
  const { keplerPosition } = await import("@horizon/toolkit/bodies");
  const emb = keplerPosition(planetElements("earth", 1, 0, date)).map((v) => v * AU_KM);
  const off = Math.hypot(earth[0] - emb[0], earth[1] - emb[1], earth[2] - emb[2]);
  assert.ok(off > 4_300 && off < 5_000, `${off} km from the barycentre`);
  for (const { id } of WORLD_BODIES) {
    const at = bodyPositionKm(id, date, [0, 0, 0]);
    assert.ok(at.every(Number.isFinite), id);
  }
});

test("sunlight falls as the inverse square: 1,361 W/m² at Earth, under a watt at Pluto", () => {
  near(irradianceAt(AU_KM), 1361, 1e-9);
  near(irradianceAt(39.5 * AU_KM), 0.87, 0.01, "sunlight at Pluto");
});

test("places and routes: every place is a body with a route, and slugs round-trip", () => {
  assert.deepEqual(Object.keys(PLACE_BODY), [...VIEW_IDS]);
  for (const id of VIEW_IDS) {
    assert.equal(resolveView(id), id);
    assert.equal(viewFromPath(pathForView(id)), id);
    assert.equal(placeFor(PLACE_BODY[id]), id);
  }
  assert.equal(pathForView("earth"), "/experience/voyage");
  assert.equal(resolveView("constructor"), null);
  assert.equal(placeFor("io"), "jupiter");
});

test("the store: going to a body bumps the flight, a moon shows its host's place, holding keeps the rate", () => {
  const s = useVoyage.getState();
  const flights = s.flight;
  s.goTo("io");
  assert.equal(useVoyage.getState().destination, "io");
  assert.equal(useVoyage.getState().view, "jupiter");
  assert.equal(useVoyage.getState().flight, flights + 1);
  s.setView("saturn");
  assert.equal(useVoyage.getState().destination, "saturn");
  s.setCompression(86_400);
  s.toggleHold();
  assert.equal(useVoyage.getState().compression, 0);
  s.toggleHold();
  assert.equal(useVoyage.getState().compression, 86_400);
  /* A hold set as a rate keeps the rate to come back to. */
  s.setCompression(0);
  assert.equal(useVoyage.getState().heldCompression, 86_400);
  /* The guide restores the switches and lets go of the selection when it ends. */
  s.patchShow({ orbits: false });
  s.select({ kind: "planet", id: "mars" });
  s.startGuide();
  assert.equal(useVoyage.getState().guideOpen, true);
  assert.equal(useVoyage.getState().destination, "moon");
  s.endGuide();
  assert.equal(useVoyage.getState().show.orbits, false);
  assert.equal(useVoyage.getState().selection, null);
  useVoyage.setState(useVoyage.getInitialState(), true);
});

test("the store: the throttle stays on its travel and closes for orbit and the autopilot", () => {
  const s = useVoyage.getState();
  s.setThrottle(1.4);
  assert.equal(useVoyage.getState().throttle, 1);
  s.setThrottle(-0.2);
  assert.equal(useVoyage.getState().throttle, 0);
  s.setThrottle(0.4);
  s.setMode("free");
  assert.equal(useVoyage.getState().throttle, 0.4, "taking the helm keeps the lever");
  s.setMode("orbit");
  assert.equal(useVoyage.getState().throttle, 0);
  s.setThrottle(0.6);
  s.goTo("mars");
  assert.equal(useVoyage.getState().throttle, 0, "the autopilot flies with the lever closed");
  /* Disengaging asks the scene to hand a flight over only while one is under way. */
  const aborts = useVoyage.getState().abort;
  s.disengage();
  assert.equal(useVoyage.getState().abort, aborts);
  useVoyage.setState({ flying: true });
  s.disengage();
  assert.equal(useVoyage.getState().abort, aborts + 1);
  useVoyage.setState({ flying: false });
  /* A crash is the scene's to report; recovering clears it and asks the scene for orbit. */
  const recoveries = useVoyage.getState().recoveries;
  s.recover();
  assert.equal(useVoyage.getState().recoveries, recoveries);
  useVoyage.setState({ crash: { body: "earth", speed: 3 }, throttle: 0.5 });
  s.recover();
  assert.equal(useVoyage.getState().crash, null);
  assert.equal(useVoyage.getState().recoveries, recoveries + 1);
  assert.equal(useVoyage.getState().throttle, 0);
  s.setThrottle(0.6);
  s.startGuide();
  assert.equal(useVoyage.getState().throttle, 0);
  s.endGuide();
  useVoyage.setState(useVoyage.getInitialState(), true);
});

test("the store: a visit invites the pilot until the ship first leaves orbit", () => {
  const fresh = useVoyage.getInitialState();
  for (const fly of [(s) => s.setMode("free"), (s) => s.goTo("mars"), (s) => s.startGuide()]) {
    useVoyage.setState(fresh, true);
    assert.equal(useVoyage.getState().flown, false);
    useVoyage.getState().setMode("orbit");
    assert.equal(useVoyage.getState().flown, false, "parking is not flying");
    fly(useVoyage.getState());
    useVoyage.getState().endGuide();
    useVoyage.getState().setMode("orbit");
    assert.equal(useVoyage.getState().flown, true, "back in orbit, the invitation stays gone");
  }
  useVoyage.setState(fresh, true);
});

test("readouts carry into the larger unit, tell a speed from c, and print nothing for no value", () => {
  const messages = layoutMessages("voyage", "en");
  const t = createTranslator({ locale: "en", messages, namespace: "voyage" });
  const f = {
    number: (v, o) => new Intl.NumberFormat("en", o).format(v),
    dateTime: (v, o) => new Intl.DateTimeFormat("en", o).format(v),
  };
  assert.equal(formatDuration(t, f, 119.6, "en"), "2 min 0 s");
  assert.equal(formatDuration(t, f, 3599.9, "en"), "1 h 0 min");
  assert.equal(formatDuration(t, f, 86_399, "en"), "1 d 0 h");
  assert.equal(formatDuration(t, f, 172_790, "en"), "2 d 0 h");
  assert.equal(formatDuration(t, f, 9.96, "en"), "10 s");
  assert.equal(formatDuration(t, f, Number.NaN, "en"), "—");
  /* A year count's word agrees with it. */
  assert.equal(formatDuration(t, f, JULIAN_YEAR_SECONDS, "en"), "1 year");
  assert.equal(formatRange(t, f, { unit: "auto", locale: "en" }, Number.NaN), "—");
  assert.notEqual(formatSpeed(t, f, 0.99999 * C_KM_S), "1 c");
  assert.match(formatSpeed(t, f, 0.99999 * C_KM_S), /0\.99999 c/);
  /* Below c never reads c: not at γ = 2·10⁴, nor where β itself rounds to 1. */
  for (const gamma of [2e4, 1e9]) {
    const speed = formatSpeed(t, f, C_KM_S * Math.sqrt(1 - 1 / gamma ** 2), gamma);
    assert.match(speed, /^0\.9{9} c/, speed);
  }
  assert.match(formatSpeed(t, f, 0.9 * C_KM_S, 2.29), /0\.9 c · γ 2\.29/);
  assert.doesNotMatch(formatSpeed(t, f, 17), /γ/);
  assert.match(formatIrradiance(t, f, 5.3e-20), /E-20/);
  assert.doesNotMatch(formatIrradiance(t, f, 0.9), /E/);
  const epoch = Date.UTC(2026, 9, 20);
  assert.equal(formatCalendar(f, epoch, 1e13), null);
  assert.match(formatCalendar(f, epoch, 1e9), /2058/);
  assert.match(formatCalendar(f, epoch, 3600), /2026/);
});

for (const locale of ["en", "cs"]) {
  test(`${locale}: every card and readout prints without holes`, () => {
    const messages = layoutMessages("voyage", locale);
    const t = createTranslator({ locale, messages, namespace: "voyage" });
    const f = {
      number: (v, o) => new Intl.NumberFormat(locale, o).format(v),
      dateTime: (v, o) => new Intl.DateTimeFormat(locale, o).format(v),
    };
    const now = new Date("2026-10-20T00:00:00Z");
    const ship = [AU_KM, 0, 0];
    const clean = (text) => {
      assert.doesNotMatch(text, /\{|\}|NaN|undefined/, text);
      assert.ok(text.length > 0);
    };
    for (const body of WORLD_BODIES) {
      const sel = body.kind === "sun" ? { kind: "sun" } : { kind: body.kind, id: body.id };
      for (const unit of ["auto", "au", "ly"]) {
        const card = cardFor(t, f, sel, { unit, locale }, { now, a: 1 }, ship);
        clean(card.title);
        for (const fact of card.facts) {
          clean(fact.label);
          clean(fact.value);
        }
      }
    }
    for (const seconds of [3, 75, 5_000, 90_000, 1e7, 4e9, 1e14, 1e17])
      clean(formatDuration(t, f, seconds, locale));
    /* No drive reaches the edge: its trips read never, on both clocks. */
    const edge = tripTo("torch", "edge", ship, { now, a: 1 });
    assert.equal(formatTrip(t, f, edge.tau, locale), t("hud.never"));
    assert.equal(formatTrip(t, f, edge.t, locale), t("hud.never"));
    clean(formatTrip(t, f, tripTo("sail", "andromeda", ship, { now, a: 1 }).tau, locale));
    for (const km of [12, 12_400, 3e6, 1.5e8, 6e9])
      clean(formatRange(t, f, { unit: "auto", locale }, km));
    for (const v of [0.3, 17, 2500, 0.1 * C_KM_S, 0.999 * C_KM_S]) clean(formatSpeed(t, f, v));
    /* The guide, the far cards and the notes quote the catalogues' figures: none left unfilled. */
    const strict = createTranslator({
      locale,
      messages,
      namespace: "voyage",
      onError(error) {
        throw error;
      },
    });
    const figures = proseArgs(PROSE_FIGURES, locale);
    for (const step of TOUR) clean(strict(`tour.steps.${step.id}.body`, figures));
    clean(strict("cards.far.alphaCen", figures));
    clean(strict("technicalDetails.features.flight", figures));
  });
}

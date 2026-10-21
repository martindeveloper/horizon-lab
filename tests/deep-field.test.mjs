import assert from "node:assert/strict";
import test from "node:test";

import { createFormatter, createTranslator } from "next-intl";

import { MOON_IDS, NAMED, PLANET_IDS } from "@horizon/toolkit/bodies";
import { nearestView } from "@horizon/toolkit/camera";
import { convert } from "@horizon/toolkit/science";

import { cardFor, NEIGHBOUR_IDS } from "../src/features/deep-field/components/cards.tsx";
import { formatAgo, formatThen } from "../src/features/deep-field/components/format.ts";
import { PROSE_FIGURES } from "../src/features/deep-field/lib/model/catalogue/index.ts";
import {
  CMB_LY,
  EARTH_THEN,
  LADDER_LY,
  RUNGS,
  depthOf,
  lyAtDepth,
  sightline,
  thenOf,
} from "../src/features/deep-field/lib/model/depth.ts";
import { TOUR } from "../src/features/deep-field/lib/model/tour.ts";
import { VIEWS } from "../src/features/deep-field/lib/model/views.ts";
import { dropsSelection, useDeepField } from "../src/features/deep-field/lib/store.ts";
import { pathForView, resolveView, viewFromPath } from "../src/features/deep-field/routing.ts";
import { proseArgs } from "../src/lib/facts.ts";
import {
  ANCHORS,
  CMB_AGE_YEARS,
  CMB_MLY,
  COSMIC_VIEW_LY,
  FIRST_GALAXIES_MLY,
  HORIZON_MLY,
  LOCAL_GROUP_CENTRE,
  LOCAL_TURNAROUND,
  LOOKBACK_RINGS_GYR,
  SUPERGALACTIC,
  anchorById,
  cmbCz,
  anchorToday,
  cosmicAim,
  lookbackMly,
  supergalacticLatitude,
} from "../src/space/cosmos/model/cosmos.ts";
import {
  TRAIL_LAPS,
  sunGalactic,
  writeSunTrail,
} from "../src/space/galaxy/model/galactic-orbit.ts";
import { neighboursSelfCheck } from "../src/space/galaxy/model/neighbours.ts";
import { GALACTIC_YEAR } from "../src/space/solar-system/model/parameters.ts";
import {
  HELIOPAUSE_AU,
  LIGHT_DAY_AU,
  LIGHT_RINGS,
  PROBES,
  crossingAu,
  firstLightDay,
  probeFromEarth,
  probePath,
  probeSpeed,
} from "../src/space/solar-system/model/probes.ts";
import { featureMessages, leaves } from "./messages-helper.mjs";

const near = (actual, expected, tolerance, message) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${message}: ${actual} vs ${expected}`);
const length = (v) => Math.hypot(v[0], v[1], v[2]);

const LOCALES = ["en", "cs"];
const messages = Object.fromEntries(
  LOCALES.map((locale) => [locale, featureMessages("deep-field", locale)]),
);
const translator = (locale) =>
  createTranslator({
    locale,
    messages: { deepField: messages[locale] },
    namespace: "deepField",
    onError(error) {
      throw error;
    },
  });

const SELECTIONS = [
  { kind: "sun" },
  ...PLANET_IDS.map((id) => ({ kind: "planet", id })),
  ...NAMED.map(({ id }) => ({ kind: "named", id })),
  ...MOON_IDS.map((id) => ({ kind: "moon", id })),
  ...["asteroids", "kuiper", "scattered", "oort"].map((id) => ({ kind: "population", id })),
  { kind: "tracer", index: 3 },
  ...["milkyway", "sun", "bulge", "halo"].map((id) => ({ kind: "galaxy", id })),
  ...Object.keys(messages.en.cards.cosmos).map((id) => ({ kind: "cosmos", id })),
  ...NEIGHBOUR_IDS.map((id) => ({ kind: "star", id })),
  ...[...PROBES.map((p) => p.id), "heliopause"].map((id) => ({ kind: "reach", id })),
];

test("views run from the inner planets to the observable universe, and the ladder holds them in order", () => {
  for (const view of VIEWS)
    assert.equal(nearestView(VIEWS, (v) => v.ly, view.ly).id, view.id, view.id);
  let last = -1;
  for (const rung of RUNGS) {
    assert.ok(rung.depth > last && rung.depth > 0 && rung.depth < 1, rung.id);
    last = rung.depth;
  }
  for (const d of [0, 0.25, 0.5, 1]) near(depthOf(lyAtDepth(d)), d, 1e-12, `depth ${d}`);
  near(lyAtDepth(0), LADDER_LY.near, 1e-12, "near end");
});

test("the probes fly their tracked paths: the Voyagers met the heliosphere's edges where they did", () => {
  /* Stone et al. 2005, 2008, 2013, 2019. */
  near(crossingAu("voyager1", "shock"), 94, 0.5, "Voyager 1 at the termination shock");
  near(crossingAu("voyager2", "shock"), 84, 0.5, "Voyager 2 at the termination shock");
  near(crossingAu("voyager1", "heliopause"), 121.6, 0.3, "Voyager 1 at the heliopause");
  near(crossingAu("voyager2", "heliopause"), 119, 0.3, "Voyager 2 at the heliopause");
  assert.ok(HELIOPAUSE_AU > 119 && HELIOPAUSE_AU < 121.6, "the bubble sits between the crossings");
  const now = new Date("2026-10-19T00:00:00Z");
  /* NASA quotes about 17 and 15 km/s, coasting away from the Sun. */
  near(convert(probeSpeed("voyager1", now), "au/yr", "km/s"), 16.9, 0.2, "Voyager 1 speed");
  near(convert(probeSpeed("voyager2", now), "au/yr", "km/s"), 15.3, 0.2, "Voyager 2 speed");
  for (const probe of PROBES) {
    /* Each path starts at Earth, just after launch. */
    const start = probePath(probe.id, 2100).slice(0, 3);
    near(length(start), 1, 0.05, `${probe.id} leaves from Earth's distance`);
  }
});

test("Voyager 1 is a full light-day from Earth from mid-November 2026", () => {
  near(LIGHT_DAY_AU, 173.14, 0.01, "a light-day");
  const day = firstLightDay("voyager1");
  /* NASA predicts 18 November 2026, 10:16 UTC; the card shows the day it falls on. */
  assert.equal(day.toISOString().slice(0, 10), "2026-11-18", day.toISOString());
  assert.ok(probeFromEarth("voyager1", new Date("2026-10-19")) < LIGHT_DAY_AU);
  assert.equal(firstLightDay("newHorizons"), null, "not before its track ends");
  /* The rings are sunlight's reach: Earth lies inside ten light-minutes, Saturn past an hour. */
  const ring = (id) => LIGHT_RINGS.find((r) => r.id === id).au;
  near(ring("lightMinutes"), 1.2, 0.01, "ten light-minutes");
  near(ring("lightYear"), 63_241, 1, "a light-year");
  assert.deepEqual(
    LIGHT_RINGS.map((r) => r.au),
    LIGHT_RINGS.map((r) => r.au).toSorted((a, b) => a - b),
  );
});

test("the eyepiece: nearby, light's age is the distance; farther, ΛCDM redshift and lookback", () => {
  const proxima = sightline(4.2465);
  assert.equal(proxima.years, 4.2465);
  assert.equal(proxima.z, 0);
  /* Virgo at 53.8 Mly: z ≈ 0.0039, light ~54 million years old. */
  const virgo = sightline(53.8e6);
  near(virgo.z, 0.0039, 0.0002, "Virgo redshift");
  near(virgo.years / 1e6, 53.6, 0.5, "Virgo light");
  /* The Sloan Great Wall's comoving distance gives back its z = 0.073, in the CMB frame. */
  const wall = anchorById("sloanGreatWall");
  near(
    sightline(wall.mly * 1e6).z,
    cmbCz(wall.l, wall.b, 0.073 * 299_792.458) / 299_792.458,
    1e-4,
    "Sloan Great Wall",
  );
  /* Past the microwave background nothing is seen. */
  const edge = sightline(1e12);
  assert.equal(edge.ly, CMB_LY);
  near(edge.z, 1089.8, 1e-9, "last scattering");
  near(edge.years / 1e9, 13.79, 0.02, "the oldest light");
  let last = 0;
  for (let ly = 1e3; ly < CMB_LY; ly *= 1.7) {
    const { years } = sightline(ly);
    assert.ok(years >= last, `lookback grows with distance at ${ly}`);
    last = years;
  }
});

test("named places land where catalogues put them, in the supergalactic plane", () => {
  const { x, y, z } = SUPERGALACTIC;
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  near(dot(x, y), 0, 1e-12, "x ⟂ y");
  near(dot(y, z), 0, 1e-12, "y ⟂ z");
  const virgo = anchorById("virgoCluster");
  near(supergalacticLatitude(anchorToday(virgo)), -2.35, 0.2, "Virgo SGB");
  near(length(anchorToday(virgo)), 53.8, 0.1, "Virgo distance");
  for (const a of ANCHORS) assert.ok(a.mly > 0 && Math.abs(a.b) <= 90, a.id);
  near(anchorById("sloanGreatWall").mly, 1_060, 40, "Sloan Great Wall");
  /* The timing argument through today's separation turned around ~1 Mpc out. */
  assert.ok(LOCAL_TURNAROUND.mly > 3 && LOCAL_TURNAROUND.mly < 4, "turnaround ~1 Mpc");
  assert.ok(LOCAL_TURNAROUND.yearsAgo > 4e9 && LOCAL_TURNAROUND.yearsAgo < 7e9, "when");
});

test("the camera's aim leaves the galactic centre for each structure's heart, without jumps", () => {
  assert.equal(length(cosmicAim(200_000)), 0);
  const ga = anchorToday(anchorById("greatAttractor"));
  near(length(cosmicAim(COSMIC_VIEW_LY.laniakea)), length(ga), 1e-6, "Great Attractor");
  for (let ly = COSMIC_VIEW_LY.localGroup; ly <= COSMIC_VIEW_LY.sheet; ly *= 1.1)
    near(length(cosmicAim(ly)), length(LOCAL_GROUP_CENTRE), 1e-9, `Local Group at ${ly}`);
  let last = 0;
  for (let ly = 3e5; ly <= COSMIC_VIEW_LY.web; ly *= 1.05) {
    const d = length(cosmicAim(ly));
    assert.ok(Math.abs(d - last) < Math.max(1, ly / 1e6) * 0.5, `no jump at ${ly}`);
    last = d;
  }
  assert.equal(length(cosmicAim(COSMIC_VIEW_LY.universe)), 0, "the universe is centred on us");
});

test("the observable universe: its edge, the microwave background and the lookback rings", () => {
  near(HORIZON_MLY / 1e3, 46.2, 0.2, "edge, Gly");
  /* The first galaxies sit about three quarters of the way out; the dark ages fill the rest. */
  near(FIRST_GALAXIES_MLY / 1e3, 33.7, 0.2, "first galaxies, Gly");
  assert.ok(FIRST_GALAXIES_MLY < CMB_MLY, "galaxies stop short of the microwave background");
  near(CMB_MLY / 1e3, 45.29, 0.05, "microwave background, Gly");
  near(CMB_AGE_YEARS, 372_000, 5_000, "released ~372,000 years after the Big Bang");
  const radii = LOOKBACK_RINGS_GYR.map(lookbackMly);
  near(radii[0] / 1e3, 1.04, 0.02, "1 billion years");
  assert.ok(radii[1] > radii[0] && radii[2] > radii[1] && radii[2] < CMB_MLY);
});

test("a flight across scales keeps a selection made for its destination", () => {
  const laniakea = { kind: "cosmos", id: "laniakea" };
  const proxima = { kind: "star", id: "proxima" };
  assert.equal(dropsSelection(laniakea, "galaxy", "cosmos"), false);
  assert.equal(dropsSelection(proxima, "galaxy", "stars"), false);
  assert.equal(dropsSelection(laniakea, "galaxy", null), true);
  assert.equal(dropsSelection(proxima, "stars", null), false);
});

test("routes: every view has one canonical path, and no legacy names", () => {
  for (const view of VIEWS) {
    assert.equal(resolveView(view.id), view.id);
    assert.equal(viewFromPath(pathForView(view.id)), view.id);
  }
  assert.equal(pathForView("galaxy"), "/lab/deep-field", "the default view lives at the base");
  for (const name of ["cmb", "milky-way", "proxima"]) assert.equal(resolveView(name), null);
});

test("Deep Field's cards render every figure in both languages and all distance units", () => {
  const date = new Date("2026-10-18T00:00:00Z");
  for (const locale of LOCALES) {
    const t = translator(locale);
    const f = createFormatter({ locale });
    for (const unit of ["auto", "au", "ly", "pc"])
      for (const sel of SELECTIONS) {
        const card = cardFor(t, f, sel, { unit, locale }, date);
        const where = `${locale}/${unit}/${sel.kind}:${sel.id ?? sel.index}`;
        for (const text of [card.title, card.body, card.caution, ...card.facts.map((f) => f.value)])
          assert.doesNotMatch(text, /[{}]|NaN|undefined|Infinity/, where);
      }
  }
});

test("solar cards calculate light-time from Earth and across orbital ranges", () => {
  const t = translator("en");
  const f = createFormatter({ locale: "en" });
  const date = new Date("2026-10-18T00:00:00Z");
  const card = (sel) => cardFor(t, f, sel, { unit: "auto", locale: "en" }, date);
  const jupiter = card({ kind: "planet", id: "jupiter" }).facts;
  assert.match(jupiter.find((row) => row.id === "fromEarth").value, /au · light-time \d+ min$/);
  assert.equal(card({ kind: "planet", id: "earth" }).facts[0].id, "fromSun");
  assert.match(card({ kind: "sun" }).facts[0].value, /^0\.99\d au · light-time 8\.\d min$/);
  const belt = card({ kind: "population", id: "asteroids" }).facts;
  assert.equal(belt.find((row) => row.id === "sunlight").value, "17–27 min");
  assert.equal(
    card({ kind: "population", id: "kuiper" }).facts.find((row) => row.id === "sunlight").value,
    "4.2–6.9 h",
  );
});

test("the sightline places when the light set out: a clock time, a date, a year, then Earth's past", () => {
  const now = new Date("2026-10-18T21:00:00");
  const at = (years) => thenOf(sightline(years), now);
  assert.equal(at(convert(43, "min", "yr")).kind, "clock");
  assert.equal(at(convert(5, "d", "yr")).kind, "date");
  assert.deepEqual(at(4.2465), { kind: "year", year: 2022 });
  assert.ok(at(9_000).year < 0, "before the Common Era");
  assert.deepEqual(at(26_000), { kind: "era", id: "iceAge" });
  assert.deepEqual(at(2.5e6), { kind: "era", id: "stoneTools" });
  assert.deepEqual(at(53.8e6), { kind: "era", id: "mammals" });
  assert.deepEqual(at(1e12), { kind: "cmb" });
  for (let i = 1; i < EARTH_THEN.length; i += 1)
    assert.ok(EARTH_THEN[i].from > EARTH_THEN[i - 1].from, EARTH_THEN[i].id);
  for (const locale of LOCALES) {
    const t = translator(locale);
    const f = createFormatter({ locale });
    for (const years of [1.6e-5, 0.05, 4.2465, 9_000, ...EARTH_THEN.map((band) => band.from)])
      assert.doesNotMatch(formatThen(t, f, at(years)), /[{}]|NaN|undefined/, `${locale}:${years}`);
    assert.doesNotMatch(formatThen(t, f, at(1e12)), /[{}]|NaN/, `${locale}:cmb`);
  }
});

test("Deep Field's lengths follow the visitor's distance unit and keep the source's precision", () => {
  const t = translator("en");
  const width = (unit) =>
    cardFor(
      t,
      createFormatter({ locale: "en" }),
      { kind: "cosmos", id: "triangulum" },
      { unit, locale: "en" },
      new Date(),
    ).facts.find((f) => f.id === "width").value;
  assert.match(width("ly"), /60,000 ly$/);
  assert.match(width("pc"), /18,000 pc$/);
  assert.match(width("au"), /3\.8 × 10⁹ au$/);
  assert.match(width("auto"), /60,000 ly$/);
});

test("technical notes and light-travel times format in both languages", () => {
  for (const locale of LOCALES) {
    const t = translator(locale);
    const args = proseArgs(PROSE_FIGURES, locale);
    for (const [key] of leaves(messages[locale]))
      if (key.startsWith("technicalDetails."))
        assert.doesNotMatch(t(key, args), /[{}]|NaN|undefined/, `${locale}:${key}`);
    const f = createFormatter({ locale });
    for (const years of [1.6e-5, 7.9e-4, 0.05, 4.2465, 27_000, 2.5e6, 13.8e9])
      assert.doesNotMatch(formatAgo(t, f, years), /[{}]|NaN/, `${locale}:${years}`);
  }
  const en = (years) => formatAgo(translator("en"), createFormatter({ locale: "en" }), years);
  /* Light from the Sun to Earth, Jupiter at opposition, Proxima, Andromeda. */
  assert.equal(en(convert(8.3, "min", "yr")), "8.3 minutes ago");
  assert.equal(en(convert(4.3, "au", "ly")), "35.8 minutes ago");
  assert.equal(en(4.2465), "4.25 years ago");
  assert.equal(en(2.5e6), "2.5 million years ago");
});

test("the journey progresses outward and focuses selectable targets", () => {
  const order = VIEWS.map((v) => v.id);
  let last = -1;
  for (const step of TOUR) {
    const at = order.indexOf(step.view);
    assert.ok(at > last, `${step.id} lies farther out than the step before`);
    last = at;
    if (step.focus)
      assert.ok(
        SELECTIONS.some((sel) => JSON.stringify(sel) === JSON.stringify(step.focus)),
        `${step.id} focuses something with a card`,
      );
  }
  assert.equal(TOUR[0].view, "inner");
  assert.equal(TOUR.at(-1).view, "observable-universe");
});

test("the journey sets each step's view, focus and switches, and gives the visitor's back", () => {
  const api = useDeepField.getState;
  api().patchShow({ halo: true, distances: false });
  api().startGuide();
  assert.equal(api().view, "inner");
  assert.deepEqual(api().selection, TOUR[0].focus);
  assert.equal(api().show.distances, true);
  assert.equal(api().show.halo, true, "the visitor's own switches stay on");
  api().goGuide(2);
  assert.equal(api().view, TOUR[2].view);
  assert.equal(api().show.distances, false);
  assert.equal(api().guideLanded, false);
  api().goGuide(TOUR.length);
  assert.equal(api().guideOpen, false, "past the last step the journey ends");
  assert.equal(api().selection, null);
  assert.deepEqual(api().show, { halo: true, names: true, distances: false, lightTime: true });
});

test("the neighbours pass their own consistency checks, here rather than on every WebGL startup", () => {
  assert.deepEqual(neighboursSelfCheck(), []);
});

test("the Sun's drawn path runs back two laps and ends at today's place", () => {
  const buffer = new Float32Array(97 * 3);
  assert.equal(writeSunTrail(buffer), 97);
  for (const v of buffer) assert.ok(Number.isFinite(v));
  assert.deepEqual(buffer.slice(-3), new Float32Array(sunGalactic(0)));
  assert.deepEqual(buffer.slice(0, 3), new Float32Array(sunGalactic(TRAIL_LAPS * GALACTIC_YEAR)));
});

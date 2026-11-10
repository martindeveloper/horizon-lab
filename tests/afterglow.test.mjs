import assert from "node:assert/strict";
import test from "node:test";

import { createTranslator } from "next-intl";

import { MAPS } from "@horizon/toolkit/bodies";
import { SOLAR_RADIUS_KM, SOLAR_TEFF_K, stefanBoltzmann } from "@horizon/toolkit/science";

import { PROSE_FIGURES, catalogueFacts } from "../src/features/afterglow/lib/model/catalogue.ts";
import { CHAPTER_IDS } from "../src/features/afterglow/lib/model/chapter-ids.ts";
import {
  CHAPTERS,
  TRACK_CELLS,
  ageToSlider,
  chapterOf,
  playRate,
  sliderToAge,
} from "../src/features/afterglow/lib/model/chapters.ts";
import { displayOf } from "../src/features/afterglow/lib/model/display.ts";
import { AFTERGLOW_EQUATIONS, angularSize } from "../src/features/afterglow/lib/model/equations.ts";
import {
  FLIGHT_SWAP,
  flightHush,
  flightPlace,
  flightTurn,
  standingPlace,
} from "../src/features/afterglow/lib/model/flight.ts";
import { discShare } from "../src/features/afterglow/lib/model/framing.ts";
import { MODES, clockPaused, clockRuns } from "../src/features/afterglow/lib/model/modes.ts";
import {
  EARTH_DRY,
  OCEANS_GOING,
  earthDryness,
} from "../src/features/afterglow/lib/model/oceans.ts";
import {
  CHANGE_PER_S,
  LIFE_SECONDS,
  TEMPO_FLOOR,
  advancePlay,
  hushOf,
  lookChange,
  tempoAt,
} from "../src/features/afterglow/lib/model/pacing.ts";
import {
  DAY_CEILING,
  DAY_TODAY,
  FLIGHT_FAR_RADII,
  FLIGHT_TEMPO,
  FOV_DEG,
  HORIZON_BAND,
  HORIZON_SHARE,
  ORBIT_RADII,
  SUN_ACROSS,
  SUN_IN_FRAME,
  SUN_LIFT,
} from "../src/features/afterglow/lib/model/parameters.ts";
import { sunAt } from "../src/features/afterglow/lib/model/sun.ts";
import { CAPTION_TOP, TOUR } from "../src/features/afterglow/lib/model/tour.ts";
import {
  AGB_END,
  END_AGE,
  MS_END,
  RGB_TIP,
  TODAY,
  TRACK,
  trackAt,
} from "../src/features/afterglow/lib/model/track.ts";
import { VANTAGE } from "../src/features/afterglow/lib/model/vantage.ts";
import {
  WARM_SPELL,
  WORLDS,
  WORLD_IDS,
  fateOf,
  lostBy,
  orbitAt,
  standingAt,
  standingWorld,
  temperatureAt,
  zoneReaches,
} from "../src/features/afterglow/lib/model/worlds.ts";
import { useAfterglow } from "../src/features/afterglow/lib/store.ts";
import { pathForView, resolveView, viewFromPath } from "../src/features/afterglow/routing.ts";
import { proseArgs } from "../src/lib/facts.ts";
import { SOURCES } from "../src/lib/sources.ts";
import { layoutMessages } from "./messages-helper.mjs";
import { closeRelative } from "./toolkit-helpers.mjs";

test("the track's rows run forward in age, and the interpolation between them is continuous and finite", () => {
  for (let i = 1; i < TRACK.length; i += 1)
    assert.ok(TRACK[i].age > TRACK[i - 1].age, `${TRACK[i].id} follows ${TRACK[i - 1].id}`);
  let last = -1;
  for (let age = 0; age <= END_AGE; age += END_AGE / 5000) {
    const { luminosity, teff, mass } = trackAt(age);
    assert.ok(Number.isFinite(luminosity) && luminosity > 0, `light at ${age}`);
    assert.ok(Number.isFinite(teff) && teff > 1000, `temperature at ${age}`);
    assert.ok(mass > 0.5 && mass <= 1, `mass at ${age}`);
    assert.ok(age > last);
    last = age;
  }
  /* Each row is met exactly, and the mass only ever falls. */
  let mass = 1;
  for (const row of TRACK) {
    const at = trackAt(row.age);
    closeRelative(at.luminosity, row.luminosity, 1e-9, row.id);
    closeRelative(at.teff, row.teff, 1e-9, row.id);
    assert.ok(row.mass <= mass + 1e-12, `${row.id} loses mass or keeps it`);
    mass = row.mass;
  }
  /* The fast clock after the envelope leaves: a step of a thousand years moves the temperature a little, never a jump. */
  const a = trackAt(AGB_END + 1000);
  const b = trackAt(AGB_END + 2000);
  assert.ok(Math.abs(Math.log(b.teff / a.teff)) < 0.5, "the crossing warms steadily");
  /* Every row names a source the bibliography has, and a status. */
  for (const { fact, path } of catalogueFacts()) {
    assert.ok(SOURCES[fact.source], `${path} cites ${fact.source}`);
    for (const source of fact.sources ?? []) assert.ok(SOURCES[source], `${path} cites ${source}`);
    assert.ok(["verified", "derived", "teaching-choice", "flag"].includes(fact.status), path);
  }
});

test("the derived radii match Schröder & Smith's table at its rows", () => {
  const table = {
    zams: 0.89,
    today: 1,
    hottest: 1.11,
    msEnd: 1.37,
    rgbTip: 256,
    heliumStart: 11.2,
    agbTip: 149,
    finalPulse: 179,
  };
  for (const [id, radius] of Object.entries(table)) {
    const row = TRACK.find((r) => r.id === id);
    assert.ok(row, id);
    const sun = sunAt(row.age);
    closeRelative(sun.radius, radius, 0.012, `${id}: ${sun.radius} R☉`);
    /* And back again: the light the law gives at that radius and temperature. */
    closeRelative(
      stefanBoltzmann.compute({ R: sun.radius, T: sun.teff }),
      row.luminosity,
      1e-9,
      id,
    );
  }
  closeRelative(sunAt(TODAY).teff, SOLAR_TEFF_K, 1e-9, "today's temperature");
  closeRelative(sunAt(TODAY).radius, 1, 1e-9);
  /* The white dwarf's rows give an Earth-sized star. */
  const dwarf = sunAt(END_AGE);
  assert.ok(dwarf.radius > 0.01 && dwarf.radius < 0.03, `${dwarf.radius} R☉`);
  assert.ok(dwarf.logg > 7, "a remnant's gravity");
});

test("the giant swallows Mercury, then Venus; Earth's fate is the tides' and marked uncertain", () => {
  const mercury = fateOf("mercury");
  const venus = fateOf("venus");
  const earth = fateOf("earth");
  assert.equal(mercury.kind, "engulfed");
  assert.equal(venus.kind, "engulfed");
  assert.equal(earth.kind, "uncertain");
  assert.ok(mercury.age < venus.age && venus.age < earth.age && earth.age < RGB_TIP);
  /* Schröder & Smith's tides: Mercury 3.8 and Venus 1.0 Myr before Earth, itself half a million years before the tip. */
  closeRelative(RGB_TIP - mercury.age, 4.3e6, 1e-9, "Mercury");
  closeRelative(RGB_TIP - venus.age, 1.5e6, 1e-9, "Venus");
  /* By radius alone the giant reaches Mercury and Venus too, but Earth's widened orbit escapes the tip: only its fate is argued. */
  const tip = sunAt(RGB_TIP);
  for (const id of ["mercury", "venus"]) assert.ok(orbitAt(id, tip.mass) < tip.radiusAu, id);
  assert.ok(orbitAt("earth", tip.mass) > tip.radiusAu);
  /* The guide's step on the giant says both are gone: it stands after their loss. */
  const swallow = TOUR.find((step) => step.id === "swallow");
  assert.ok(lostBy("mercury", swallow.age) && lostBy("venus", swallow.age));
  for (const id of ["mars", "jupiter", "saturn", "pluto"])
    assert.equal(fateOf(id).kind, "survives");
  assert.equal(lostBy("mercury", mercury.age - 1), false);
  assert.equal(lostBy("mercury", mercury.age), true);
  /* Orbits widen as the mass goes; sunlight and the Sun's width follow the laws. */
  const earthNow = standingAt("earth", TODAY);
  closeRelative(earthNow.sunlight, 1, 1e-4, "sunlight at Earth today");
  closeRelative(earthNow.sunWidth, 0.0093, 0.02, "half a degree");
  closeRelative(earthNow.period, 1, 1e-4, "Earth's year");
  const marsTip = standingAt("mars", RGB_TIP);
  assert.ok(marsTip.sunWidth > 0.9 && marsTip.sunWidth < 1.3, `${marsTip.sunWidth} rad`);
  assert.equal(standingAt("earth", RGB_TIP).inside, false);
  /* Standing inside the giant's photosphere from Mercury's orbit: the whole sky. */
  closeRelative(standingAt("mercury", RGB_TIP).sunWidth, Math.PI, 1e-9);
  /* Enceladus's warm spell: on the climb the zone's centre passes Saturn, so Saturn then sits between the zone's edges, after Jupiter's turn and before the tip. */
  const warm = sunAt(WARM_SPELL);
  const saturn = orbitAt("saturn", warm.mass);
  assert.ok(warm.zone.inner < saturn && saturn < warm.zone.outer, `${saturn} au in the zone`);
  assert.ok(zoneReaches("jupiter") < WARM_SPELL && WARM_SPELL < RGB_TIP);
});

test("the chapters tile the life, the track maps both ways, and the clock holds the fast ends", () => {
  assert.deepEqual(
    CHAPTERS.map((c) => c.id),
    [...CHAPTER_IDS],
  );
  assert.equal(CHAPTERS[0].from, 0);
  for (let i = 1; i < CHAPTERS.length; i += 1) {
    assert.equal(CHAPTERS[i - 1].until, CHAPTERS[i].from, CHAPTERS[i].id);
    assert.ok(CHAPTERS[i].from > CHAPTERS[i - 1].from);
  }
  assert.equal(CHAPTERS[CHAPTERS.length - 1].until, END_AGE);
  for (const chapter of CHAPTERS) {
    assert.equal(chapterOf(chapter.from).id, chapter.id);
    assert.equal(chapterOf(chapter.until - 1).id, chapter.id);
  }
  for (const u of [0, 0.1, 0.33, 0.5, 0.77, 0.9, 1]) {
    const age = sliderToAge(u);
    assert.ok(Math.abs(ageToSlider(age) - u) < 1e-6, `round trip at ${u}`);
  }
  let last = -1;
  for (let u = 0; u <= 1; u += 0.001) {
    const age = sliderToAge(u);
    assert.ok(age >= last, `monotone at ${u}`);
    last = age;
  }
  /* The main sequence runs hundreds of millions of years a second; the nebula a few thousand. */
  assert.ok(playRate(TODAY) > 1e8 && playRate(TODAY) < 1e9, `${playRate(TODAY)} a second today`);
  assert.ok(playRate(AGB_END + 100) < 5000, `${playRate(AGB_END + 100)} a second in the nebula`);
  /* A step never leaps a chapter: it lands on the next chapter's first moment. */
  const nearEnd = CHAPTERS[0].until - 1;
  assert.equal(advancePlay(nearEnd, 1, 4), CHAPTERS[0].until);
  assert.equal(advancePlay(END_AGE, 1, 1), END_AGE);
});

test("playback slows where the Sun's look rushes, eases there, and the flight's hush slows it further", () => {
  /* Today's Sun barely changes: full tempo. The crossing to the nebula's star rushes: the floor (a briefer rush, the flash's collapse, is held step by step below). */
  assert.equal(tempoAt(ageToSlider(TODAY)), 1);
  closeRelative(tempoAt(ageToSlider(AGB_END - 2000)), TEMPO_FLOOR, 0.05, "slowed in the crossing");
  /* The climb's rush ends where the giant's calmer sweep begins: the clock is back to full there, so the Sun never stands still. */
  const sweep = CHAPTERS.find((c) => c.id === "tip");
  assert.ok(tempoAt(ageToSlider(sweep.from + 0.01 * (sweep.until - sweep.from))) > 0.99);
  /* Everywhere, a second of play changes the Sun's look (size, colour, shown brightness) by at most the cap, at any pace. */
  for (const pace of [0.25, 1, 4]) {
    const dt = 1 / 60;
    let age = 0;
    let worst = 0;
    while (age < END_AGE) {
      const next = advancePlay(age, dt, pace);
      assert.ok(next > age, `playback moves on at ${age}`);
      worst = Math.max(worst, lookChange(sunAt(age), sunAt(next)) / (dt * pace * CHANGE_PER_S));
      age = next;
    }
    assert.ok(
      worst <= 1.001,
      `at pace ${pace} a second changes the Sun by ${worst.toFixed(3)} of the cap`,
    );
  }
  /* The tempo eases: no step along the track jumps it by more than a little. */
  for (let u = 0; u < 1; u += 1e-4)
    assert.ok(Math.abs(Math.log(tempoAt(u + 1e-4) / tempoAt(u))) < 0.05, `smooth at ${u}`);
  /* The life takes longer than its chapters' seconds, and a hush slows a step in proportion. */
  assert.ok(LIFE_SECONDS > TRACK_CELLS && LIFE_SECONDS < 3 * TRACK_CELLS, `${LIFE_SECONDS} s`);
  const from = TODAY + 1e8;
  const full = ageToSlider(advancePlay(from, 0.1, 1)) - ageToSlider(from);
  const hushed = ageToSlider(advancePlay(from, 0.1, 1, 0.25)) - ageToSlider(from);
  closeRelative(hushed, full / 4, 1e-6, "a hush of a quarter plays a quarter as far");
  assert.equal(hushOf(1), 0);
  assert.equal(hushOf(TEMPO_FLOOR), 1);
});

test("every guide shot and every mode's sway keeps the Sun and the limb in the frame", () => {
  /* The Sun stands `SUN_LIFT` of the height over the limb and within `SUN_IN_FRAME` of the half-width off centre. */
  const sunInFrame = (across, horizon) =>
    Math.abs(2 * across - 1) <= SUN_IN_FRAME && horizon - SUN_LIFT > 0;
  for (const step of TOUR) {
    const horizon = step.shot.horizon ?? HORIZON_SHARE.landscape;
    assert.ok(horizon >= HORIZON_BAND.top && horizon <= HORIZON_BAND.bottom, `${step.id} limb`);
    assert.ok(sunInFrame(step.shot.across ?? SUN_ACROSS, horizon), `${step.id} Sun`);
    /* The Sun stands above the caption. */
    assert.ok(horizon - SUN_LIFT <= CAPTION_TOP, `${step.id} under the caption`);
  }
  /* The sway rides on the resting view, unclamped: at its widest it still holds the Sun and the limb. */
  for (const [id, { sway }] of Object.entries(MODES)) {
    const resting = Math.abs(2 * SUN_ACROSS - 1) / SUN_IN_FRAME;
    assert.ok(resting + sway.across <= 1, `${id} swings the Sun out`);
    for (const rest of Object.values(HORIZON_SHARE)) {
      assert.ok(rest - sway.horizon >= HORIZON_BAND.top, `${id} lifts the limb too far`);
      assert.ok(rest + sway.horizon <= HORIZON_BAND.bottom, `${id} sinks the limb too far`);
    }
  }
});

test("every tour step names a world and a formula that exist, in forward time, with a landing vantage", () => {
  let last = -1;
  for (const step of TOUR) {
    assert.ok(WORLD_IDS.includes(step.world), `${step.id} world`);
    if (step.equation) assert.ok(AFTERGLOW_EQUATIONS[step.equation], `${step.id} formula`);
    assert.ok(step.age > last, `${step.id} is later than the step before`);
    last = step.age;
  }
  assert.deepEqual(new Set(TOUR.map((s) => s.id)).size, TOUR.length, "ids unique");
  /* A caption's figure for its own moment is the Sun's where the step stands, as the readouts beside it show. */
  const at = (id) => sunAt(TOUR.find((step) => step.id === id).age);
  closeRelative(PROSE_FIGURES.pulsesMassLostPercent.value, (1 - at("pulses").mass) * 100, 1e-12);
  closeRelative(
    PROSE_FIGURES.dwarfDiameterKm.value,
    2 * at("dwarf").radius * SOLAR_RADIUS_KM,
    1e-12,
  );
  for (const chapter of CHAPTER_IDS) assert.ok(WORLD_IDS.includes(VANTAGE[chapter]), chapter);
  /* The schedule moves outward as the Sun approaches. */
  const order = WORLD_IDS;
  let farthest = 0;
  for (const chapter of CHAPTER_IDS) {
    const at = order.indexOf(VANTAGE[chapter]);
    assert.ok(at >= farthest, `${chapter} stands no nearer than before`);
    farthest = at;
  }
  /* Every world rides an orbit the model has. */
  for (const id of WORLD_IDS) assert.ok(standingAt(WORLDS[id].orbit, TODAY).distance > 0, id);
});

test("every world has a measured map for the close-up", () => {
  for (const id of WORLD_IDS) assert.ok(MAPS[WORLDS[id].body.id], `${id} has a measured map`);
});

test("the display: today's Earth reads at today's level, the day side never passes its ceiling, and the Sun's disc outshines every day side", () => {
  const today = displayOf(SOLAR_TEFF_K, sunAt(TODAY).radiusAu, 1, 0);
  closeRelative(today.sunlight, 1, 1e-6, "today's sunlight at one au");
  closeRelative(today.day, DAY_TODAY, 1e-6, "today's day side");
  for (const row of TRACK) {
    const sun = sunAt(row.age);
    for (const id of WORLD_IDS) {
      const { distance } = standingAt(WORLDS[id].orbit, row.age);
      const halfView = ((FOV_DEG.open / 2) * Math.PI) / 180;
      const fill = Math.min(1, (sun.radiusAu / distance / halfView) ** 2);
      const shown = displayOf(sun.teff, sun.radiusAu, distance, fill);
      assert.ok(
        shown.day <= DAY_CEILING + 1e-9,
        `${row.id} from ${id}: day side under the ceiling`,
      );
      assert.ok(shown.day >= 0 && Number.isFinite(shown.disc), `${row.id} from ${id}: finite`);
      if (distance > sun.radiusAu)
        assert.ok(shown.disc > shown.day, `${row.id} from ${id}: the disc outshines the day side`);
    }
  }
});

test("routes resolve every chapter and the default has the base address", () => {
  for (const id of CHAPTER_IDS) {
    assert.equal(resolveView(id), id);
    assert.equal(viewFromPath(pathForView(id)), id);
  }
  assert.equal(pathForView("today"), "/experience/afterglow");
  assert.equal(resolveView("constructor"), null);
});

test("the store: chapters ease the clock, a world stops the schedule, the guide and the autoplay give things back", () => {
  const fresh = useAfterglow.getInitialState();
  useAfterglow.setState(fresh, true);
  const s = useAfterglow.getState();
  const flights = s.flight;
  s.setView("tip");
  assert.equal(useAfterglow.getState().view, "tip");
  assert.equal(useAfterglow.getState().aim, CHAPTERS.find((c) => c.id === "tip").from);
  assert.equal(useAfterglow.getState().flight, flights + 1);
  assert.equal(useAfterglow.getState().world, "mars", "the vantage follows the schedule");
  /* On the way there the clock passes the swell: the chapter and the world hold until it lands. */
  s.tick(CHAPTERS.find((c) => c.id === "subgiant").from, false);
  assert.equal(useAfterglow.getState().view, "tip");
  assert.equal(useAfterglow.getState().world, "mars");
  s.tick(CHAPTERS.find((c) => c.id === "tip").from, true);
  assert.equal(useAfterglow.getState().aim, null);
  assert.equal(useAfterglow.getState().world, "mars");
  s.standOn("pluto");
  assert.equal(useAfterglow.getState().world, "pluto");
  assert.equal(useAfterglow.getState().auto, false);
  assert.equal(useAfterglow.getState().selection, "pluto");
  s.setView("today");
  assert.equal(useAfterglow.getState().world, "pluto", "a chosen world stays");
  s.setAge(TODAY);
  assert.equal(useAfterglow.getState().aim, null);
  assert.equal(useAfterglow.getState().view, "today");
  /* The clock's report: the chapter follows the age. */
  s.tick(RGB_TIP + 1, false);
  assert.equal(useAfterglow.getState().view, "flash");
  s.setAge(TODAY);
  s.stepPace(1);
  assert.equal(useAfterglow.getState().pace, "double");
  /* The guide moves the clock and the world; ending it puts both back. */
  s.startGuide();
  assert.equal(useAfterglow.getState().guideOpen, true);
  assert.equal(useAfterglow.getState().aim, TOUR[0].age);
  assert.equal(useAfterglow.getState().world, TOUR[0].world);
  s.goGuide(4);
  assert.equal(useAfterglow.getState().world, TOUR[4].world);
  s.endGuide();
  assert.equal(useAfterglow.getState().world, "pluto");
  assert.equal(useAfterglow.getState().age, TODAY);
  /* The autoplay starts the life over at its own pace and gives the pace back. */
  s.startDrift();
  assert.equal(useAfterglow.getState().age, 0);
  assert.equal(useAfterglow.getState().playing, true);
  assert.equal(useAfterglow.getState().pace, "half");
  assert.equal(useAfterglow.getState().world, "earth");
  /* The life waits behind the autoplay's loader, runs once it is ready, and its Pause holds the clock. */
  assert.equal(clockRuns(useAfterglow.getState()), false, "waiting behind the loader");
  assert.equal(clockPaused(useAfterglow.getState()), false);
  s.readyDrift();
  assert.equal(clockRuns(useAfterglow.getState()), true);
  s.pauseDrift();
  assert.equal(clockRuns(useAfterglow.getState()), false, "the autoplay's Pause");
  assert.equal(clockPaused(useAfterglow.getState()), true);
  s.resumeDrift();
  assert.equal(clockRuns(useAfterglow.getState()), true);
  s.stopDrift();
  assert.equal(useAfterglow.getState().playing, false);
  assert.equal(useAfterglow.getState().pace, "double");
  assert.equal(useAfterglow.getState().world, "pluto", "the visitor's own world comes back");
  assert.equal(useAfterglow.getState().auto, false);
  /* Started from inside the guide, the autoplay gives back what the visitor had before the guide: here, the schedule. */
  useAfterglow.setState(fresh, true);
  s.startGuide();
  assert.equal(useAfterglow.getState().auto, false);
  s.startDrift();
  s.stopDrift();
  assert.equal(useAfterglow.getState().auto, true, "the vantage follows the chapters again");
  /* The Settings panel and the Atlas share the rail: one at a time. */
  s.setAtlas(true);
  s.setPanel("settings");
  assert.equal(useAfterglow.getState().atlas, false);
  s.setAtlas(true);
  assert.equal(useAfterglow.getState().panel, "none");
  /* Play at the end of the life starts it over. */
  s.setAge(END_AGE);
  s.togglePlaying();
  assert.equal(useAfterglow.getState().age, 0);
  assert.equal(useAfterglow.getState().playing, true);
  useAfterglow.setState(fresh, true);
});

for (const locale of ["en", "cs"]) {
  test(`${locale}: every caption, card and note prints with its figures, without holes`, () => {
    const messages = layoutMessages("afterglow", locale);
    const strict = createTranslator({
      locale,
      messages,
      namespace: "afterglow",
      onError(error) {
        throw error;
      },
    });
    const figures = proseArgs(PROSE_FIGURES, locale);
    const clean = (text) => {
      assert.doesNotMatch(text, /\{|\}|NaN|undefined/, text);
      assert.ok(text.length > 0);
    };
    for (const step of TOUR) {
      clean(strict(`tour.steps.${step.id}.title`, figures));
      clean(strict(`tour.steps.${step.id}.body`, figures));
      if (step.crossing) clean(strict(`tour.crossings.${step.crossing}.hint`));
    }
    for (const id of WORLD_IDS) clean(strict(`cards.${id}`, figures));
    clean(strict("cards.earthCaution", figures));
    for (const id of CHAPTER_IDS) {
      clean(strict(`views.${id}`));
      clean(strict(`viewHints.${id}`));
    }
    for (const section of ["track", "worlds", "sky", "clock"]) {
      clean(strict(`technicalDetails.features.${section}`, figures));
      clean(strict(`technicalDetails.sections.${section}.body`, figures));
    }
  });
}

test("the Sun's disc keeps its size when the autoplay moves to another world", () => {
  /* At every chapter edge where the schedule changes world, the disc spans the same share of the view from either side. */
  for (const chapter of CHAPTERS.slice(1)) {
    const before = VANTAGE[chapterOf(chapter.from - 1).id];
    const after = VANTAGE[chapter.id];
    if (before === after) continue;
    const sun = sunAt(chapter.from);
    const shareFrom = (world) =>
      discShare(
        angularSize.compute({ R: sun.radiusAu, d: orbitAt(WORLDS[world].orbit, sun.mass) }) / 2,
        sun.radius,
      );
    closeRelative(
      shareFrom(after),
      shareFrom(before),
      1e-9,
      `${before} to ${after} at ${chapter.id}`,
    );
  }
});

test("a visitor never stands on a swallowed world: the nearest survivor outward takes its place, and the world comes back before its loss", () => {
  const earthLost = fateOf("earth").age;
  assert.equal(standingWorld("earth", earthLost - 1), "earth");
  assert.equal(standingWorld("earth", earthLost), "mars");
  assert.equal(standingWorld("mars", END_AGE), "mars", "Mars outlives the giant");
  const api = useAfterglow.getState;
  useAfterglow.setState(useAfterglow.getInitialState(), true);
  api().standOn("earth");
  /* Playing past the loss moves the visitor off; scrubbing back before it brings them home. */
  api().tick(earthLost + 1, false);
  assert.equal(api().world, "mars");
  assert.equal(api().chosen, "earth");
  api().setAge(earthLost - 1e6);
  assert.equal(api().world, "earth");
  /* A swallowed world's chip opens its card, never the view. */
  api().setAge(END_AGE);
  api().select(null);
  api().standOn("earth");
  assert.equal(api().world, "mars");
  assert.equal(api().selection, "earth");
  useAfterglow.setState(useAfterglow.getInitialState(), true);
});

test("Earth's oceans go between the moist and the runaway greenhouse, within the main sequence, and never come back", () => {
  /* One criterion: the habitable zone's inner edge reaches Earth's orbit as the water begins to go, where the chapter and its guide step begin. */
  const going = sunAt(OCEANS_GOING);
  closeRelative(going.zone.inner, orbitAt("earth", going.mass), 1e-9, "the zone's inner edge");
  assert.equal(CHAPTERS.find((c) => c.id === "oceans").from, OCEANS_GOING);
  assert.equal(TOUR.find((step) => step.id === "oceans").age, OCEANS_GOING);
  assert.ok(
    EARTH_DRY > OCEANS_GOING && EARTH_DRY < MS_END,
    "the seas are gone before the core's hydrogen",
  );
  assert.equal(earthDryness(TODAY), 0);
  assert.equal(earthDryness(EARTH_DRY), 1);
  let last = 0;
  for (let age = TODAY; age <= END_AGE; age += END_AGE / 4000) {
    const dry = earthDryness(age);
    assert.ok(dry >= last - 1e-12, `drier or as dry at ${age}`);
    last = dry;
  }
});

test("a world's temperature from sunlight matches the textbook equilibrium today, and rises with the giant", () => {
  /* Today, against the usual equilibrium figures: Earth 255 K, Mars 210 K, Europa ~100 K, Pluto ~35 K. */
  const today = Object.fromEntries(WORLD_IDS.map((id) => [id, temperatureAt(id, TODAY)]));
  assert.ok(Math.abs(today.earth - 255) < 3, `Earth ${today.earth}`);
  assert.ok(Math.abs(today.mars - 210) < 5, `Mars ${today.mars}`);
  assert.ok(today.europa > 85 && today.europa < 115, `Europa ${today.europa}`);
  assert.ok(today.pluto > 28 && today.pluto < 45, `Pluto ${today.pluto}`);
  /* Farther and brighter-surfaced worlds are colder. */
  for (let i = 1; i < WORLD_IDS.length; i += 1)
    assert.ok(today[WORLD_IDS[i]] < today[WORLD_IDS[i - 1]], `${WORLD_IDS[i]} colder`);
  /* The giant bakes Mars past a thousand kelvin. */
  assert.ok(temperatureAt("mars", RGB_TIP - 1e6) > 1000);
});

test("a flight backs off one world until it flies away beside the Sun and closes on the next from its other side", () => {
  const from = { distance: 1, radius: 4.26e-5 };
  const to = { distance: 1.52, radius: 2.27e-5 };
  /* A landscape view: a pixel's angle, the frame's bottom edge below the Sun, and the places left and right of it. */
  const pixel = 4.7e-4;
  const bottom = 0.49;
  const view = {
    lift: 0.2,
    gone: 2 / pixel,
    leave: { apart: 0.58, roll: -1.08 },
    arrive: { apart: 0.48, roll: 0.95 },
  };
  const rest = (end) => standingPlace(end, ORBIT_RADII * end.radius, view.lift);
  const at = (t) => flightPlace(t, from, to, view);
  /*
   * Seen from the camera facing the Sun, up towards north: how far from the Sun the globe's
   * nearest point lies, how far round from below the Sun (positive right), and its pixels across.
   */
  const seen = (p, w) => {
    const sun = [-p.x, -p.y, -p.z].map((v) => v / Math.hypot(p.x, p.y, p.z));
    const toWorld = [w.distance - p.x, -p.y, -p.z];
    const far = Math.hypot(...toWorld);
    const dir = toWorld.map((v) => v / far);
    const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const north = [0, 1, 0].map((v, i) => v - sun[1] * sun[i]);
    const up = north.map((v) => v / Math.hypot(...north));
    const right = [
      sun[1] * up[2] - sun[2] * up[1],
      sun[2] * up[0] - sun[0] * up[2],
      sun[0] * up[1] - sun[1] * up[0],
    ];
    const angular = Math.asin(w.radius / far);
    return {
      top: Math.acos(Math.min(1, dot(sun, dir))) - angular,
      roll: Math.atan2(dot(dir, right), -dot(dir, up)),
      px: (2 * angular) / pixel,
    };
  };
  for (const [t, end] of [
    [0, from],
    [1, to],
  ]) {
    closeRelative(at(t).x, rest(end).x, 1e-12, `x at ${t}`);
    closeRelative(at(t).y, rest(end).y, 1e-12, `y at ${t}`);
    assert.ok(Math.abs(at(t).z) < 1e-18, `z at ${t}`);
  }
  const STEPS = 2000;
  const samples = Array.from({ length: STEPS + 1 }, (_, i) => {
    const t = i / STEPS;
    const left = t < FLIGHT_SWAP;
    const s = seen(at(t), left ? from : to);
    /* Seen: on the screen and two pixels across (a night side's lit sliver is far thinner). */
    return { t, left, ...s, shown: s.px >= 2 && s.top * Math.cos(s.roll) < bottom };
  });
  /* A place held as the world flies away wanders by under a thousandth of a radian, as the Sun's direction shifts with the camera. */
  const HELD = 1e-3;
  const near = (x, a, b) => x >= Math.min(a, b) - HELD && x <= Math.max(a, b) + HELD;
  for (const [i, s] of samples.entries()) {
    if (!s.shown) continue;
    /* Never drops out of the frame or slides onto the Sun: between the limb's place and its far place, on its own side. */
    const place = s.left ? view.leave : view.arrive;
    assert.ok(near(s.top, view.lift, place.apart), `place at ${s.t}`);
    assert.ok(near(s.roll, 0, place.roll), `side at ${s.t}`);
    /* The world left only shrinks, the next only grows. */
    const before = samples[i - 1];
    if (!before?.shown || before.left !== s.left) continue;
    if (s.left) assert.ok(s.px <= before.px + 1e-9, `shrinks at ${s.t}`);
    else assert.ok(s.px >= before.px - 1e-9, `grows at ${s.t}`);
  }
  const swap = samples.find((s) => s.t >= FLIGHT_SWAP);
  assert.ok(
    seen(at(swap.t), from).px < 1 && swap.px < 1,
    "both are under a pixel as the globes change",
  );
  /* It backs off gently to the far place, a small globe still, before it flies away: that takes most of the way out. */
  const farPx = (2 * Math.asin(1 / FLIGHT_FAR_RADII)) / pixel;
  const gentle = samples.filter((s) => s.left && s.px >= farPx).length;
  const leaving = samples.filter((s) => s.left && s.shown).length;
  assert.ok(gentle > 0.75 * leaving, `${gentle} of ${leaving} steps down to the far place`);
  assert.ok(
    samples.filter((s) => !s.left && s.shown).length > 0.3 * STEPS,
    "the next one is seen growing for the last part of the move",
  );
  /* No seam: each world's size, place and side change at rates that never jump between frames. */
  const smooth = (value, label) => {
    /* A rate is one world's own: the step across the globes' change compares two worlds and is left out. */
    const rates = samples.slice(1).map((s, i) => ({
      t: s.t,
      rate: (value(s) - value(samples[i])) * STEPS,
      shown: s.shown && s.left === samples[i].left,
      left: s.left,
    }));
    const peak = Math.max(...rates.filter((r) => r.shown).map((r) => Math.abs(r.rate)));
    for (const [i, r] of rates.entries()) {
      if (i === 0 || !r.shown || !rates[i - 1].shown || r.left !== rates[i - 1].left) continue;
      assert.ok(Math.abs(r.rate - rates[i - 1].rate) < 0.02 * peak, `${label} jolts at ${r.t}`);
    }
  };
  smooth((s) => Math.log(s.px), "the globe's size");
  smooth((s) => s.top, "the globe's place");
  smooth((s) => s.roll, "the globe's side");
  /* The clock slows with the move and never stops: the Sun keeps changing through the flight. */
  assert.equal(flightHush(0), 1);
  assert.ok(Math.abs(flightHush(1) - 1) < 1e-12);
  assert.ok(flightHush(0.05) > 0.97, "eases in with the camera");
  for (let t = 0; t <= 1; t += 0.01) assert.ok(flightHush(t) >= FLIGHT_TEMPO - 1e-12);
  /* The camera turns after the world left, crosses at the middle, turns to meet the next and comes back, never past its reach and without a jolt. */
  assert.equal(flightTurn(0), 0);
  assert.ok(Math.abs(flightTurn(FLIGHT_SWAP)) < 1e-12 && Math.abs(flightTurn(1)) < 1e-12);
  assert.ok(flightTurn(0.25) > 0.9 && flightTurn(0.75) < -0.9, "after the one, then to the other");
  for (let i = 1; i <= STEPS; i += 1) {
    const turn = flightTurn(i / STEPS);
    assert.ok(Math.abs(turn) <= 1);
    assert.ok(
      Math.abs(turn - flightTurn((i - 1) / STEPS)) < 0.01,
      `turns smoothly at ${i / STEPS}`,
    );
  }
});

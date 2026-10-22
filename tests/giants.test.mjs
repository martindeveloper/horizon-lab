import assert from "node:assert/strict";
import test from "node:test";

import { createTranslator } from "next-intl";

import { convert, stefanBoltzmann } from "@horizon/toolkit/science";

import { resolveHole, pathForHole } from "../src/features/black-hole/routing.ts";
import { UP_CLOSE } from "../src/features/giants/components/card-specs.ts";
import { rungCard } from "../src/features/giants/components/format.ts";
import {
  ACTIVITY,
  createForecast,
  flareLight,
  toView,
  turnAt,
  weatherAt,
} from "../src/features/giants/lib/model/activity.ts";
import { RUNG_FACTS, drawn, radiusMetres } from "../src/features/giants/lib/model/catalogue.ts";
import {
  glideAt,
  glideFrom,
  glideSeconds,
  glideTowards,
} from "../src/features/giants/lib/model/glide.ts";
import {
  bodyAt,
  cameraAt,
  createLadder,
  framedRadius,
  nearestRung,
  placeBodies,
} from "../src/features/giants/lib/model/ladder.ts";
import { LOOKS } from "../src/features/giants/lib/model/looks.ts";
import {
  OVERVIEW_AXIS,
  blendPlaced,
  namesEnd,
  overviewBaseline,
  placeOverview,
  scaleLines,
} from "../src/features/giants/lib/model/overview.ts";
import { granulesAcross } from "../src/features/giants/lib/model/physics.ts";
import { METRES, RULERS, rulerFor } from "../src/features/giants/lib/model/ruler.ts";
import { RUNG_IDS, RUNGS, rungIndex } from "../src/features/giants/lib/model/rungs.ts";
import { TOUR } from "../src/features/giants/lib/model/tour.ts";
import {
  NO_WEATHER,
  fadeWeather,
  weatherShown,
} from "../src/features/giants/lib/model/weather-fade.ts";
import {
  LENSES,
  OVERVIEW_FOOT_PX,
  OVERVIEW_TOP_PX,
} from "../src/features/giants/lib/parameters.ts";
import { useGiants } from "../src/features/giants/lib/store.ts";
import { pathForRung, resolveRung, rungFromPath } from "../src/features/giants/routing.ts";
import { featureMessages } from "./messages-helper.mjs";

const ladder = createLadder(RUNG_IDS.map((id) => radiusMetres(id)));
const phone = { width: 375, height: 640 };
const desktop = { width: 1440, height: 820 };

test("the ladder climbs by size, and its published spreads hold their sizes", () => {
  RUNG_IDS.forEach((id, i) => {
    const { radius, low, high, polar } = radiusMetres(id);
    assert.ok(low <= radius && radius <= high, `${id}: radius inside its spread`);
    assert.ok(polar <= radius, `${id}: no body is taller than it is wide`);
    if (i > 0)
      assert.ok(
        radius > radiusMetres(RUNG_IDS[i - 1]).radius,
        `${id} is larger than the one before`,
      );
  });
});

test("at a whole rung its body stands framed in the middle of the stage, on the horizon", () => {
  for (const stage of [phone, desktop])
    for (let i = 0; i <= ladder.last; i++) {
      const body = placeBodies(ladder, i, stage).find((entry) => entry.index === i);
      assert.ok(body, `rung ${i} in view`);
      assert.ok(Math.abs(body.x - stage.width / 2) < 1e-6 * stage.width);
      assert.ok(Math.abs(body.radius - framedRadius(stage)) < 1e-6 * body.radius);
      assert.ok(
        Math.abs(body.y + body.polar - stage.height * 0.7) < 1e-6 * stage.height,
        "rests on the horizon",
      );
    }
});

test("between two rungs the view only widens, and keeps the smaller body in sight", () => {
  for (let i = 0; i < ladder.last; i++) {
    let scale = 0;
    for (let f = 0; f <= 1.0001; f += 0.05) {
      const t = i + Math.min(f, 1);
      const camera = cameraAt(ladder, t, desktop);
      assert.ok(camera.scale >= scale, `rung ${t}: the scale grows`);
      scale = camera.scale;
      if (f < 0.5) {
        const body = placeBodies(ladder, t, desktop, 0).find((entry) => entry.index === i);
        assert.ok(body && body.x > 0 && body.x < desktop.width, `rung ${i} stays on stage at ${t}`);
      }
    }
  }
  assert.equal(nearestRung(ladder, 3.4), 3);
  assert.equal(nearestRung(ladder, 3.6), 4);
  assert.equal(nearestRung(ladder, -2), 0);
  assert.equal(nearestRung(ladder, 99), ladder.last);
});

test("a tap picks the body under it, and nothing on the empty sky", () => {
  const sun = rungIndex("sun");
  const body = placeBodies(ladder, sun, desktop).find((entry) => entry.index === sun);
  assert.equal(bodyAt(ladder, sun, desktop, body.x, body.y), sun);
  assert.equal(bodyAt(ladder, sun, desktop, body.x, 4), null);
});

test("the overview shows every body at once, in order of size, between the names, the toolbar and the dock", () => {
  /* The dock's cover of the stage's foot, CSS px: a phone's taller dock, a wide screen's. */
  for (const [stage, foot] of [
    [phone, 150],
    [desktop, 130],
  ]) {
    const baseline = overviewBaseline(stage, foot);
    assert.ok(
      baseline + OVERVIEW_FOOT_PX <= stage.height - foot,
      "the axis's values clear the dock",
    );
    const dots = RUNG_IDS.map((_, i) => placeOverview(ladder, OVERVIEW_AXIS, stage, baseline, i));
    dots.forEach((dot, i) => {
      assert.ok(
        dot.x - dot.radius > namesEnd(stage) && dot.x + dot.radius < stage.width,
        `${RUNG_IDS[i]} right of the names, clear of the stage's edge`,
      );
      assert.ok(
        dot.y - dot.polar >= OVERVIEW_TOP_PX && dot.y + dot.polar <= baseline,
        `${RUNG_IDS[i]} below the toolbar, above the baseline`,
      );
      const before = dots[i - 1];
      if (!before) return;
      assert.ok(dot.x > before.x && dot.y < before.y, `${RUNG_IDS[i]} climbs right and up`);
      assert.ok(dot.radius >= before.radius, `${RUNG_IDS[i]} is no smaller a dot`);
      for (const other of dots.slice(0, i))
        assert.ok(
          Math.hypot(dot.x - other.x, dot.y - other.y) > dot.radius + other.radius,
          `${RUNG_IDS[i]} clear of ${RUNG_IDS[other.index]}`,
        );
    });
    /* The glide's ends are the ladder's place and the dot's; a body far off stage starts at its edge. */
    const sun = placeBodies(ladder, rungIndex("sun"), stage).find(
      (b) => b.index === rungIndex("sun"),
    );
    const near = (a, b) => Object.keys(b).every((key) => Math.abs(a[key] - b[key]) < 1e-9);
    assert.ok(near(blendPlaced(sun, dots[sun.index], 0, stage), sun));
    assert.ok(near(blendPlaced(sun, dots[sun.index], 1, stage), dots[sun.index]));
    const far = { ...dots[0], x: 1e9, y: stage.height / 2, radius: 1e7, polar: 1e7 };
    const start = blendPlaced(far, dots[0], 0, stage);
    assert.ok(start.x <= stage.width + start.radius + 1e-6 && start.radius <= stage.height + 1e-6);
  }
});

test("the overview's scale lines mark round radii in the ruler's units, left to right", () => {
  for (const ruler of RULERS) {
    const lines = scaleLines(ruler, OVERVIEW_AXIS);
    assert.ok(lines.length >= 6, `${ruler}: lines across the ladder`);
    lines.forEach((line, i) => {
      assert.ok(line.share >= 0 && line.share <= 1, `${ruler}: on the axis`);
      assert.ok(i === 0 || line.share > lines[i - 1].share, `${ruler}: in order`);
      const power = Math.log10(line.value);
      assert.ok(Math.abs(power - Math.round(power)) < 1e-9, `${ruler}: a power of ten`);
      const metres = line.value * METRES[line.unit];
      assert.ok(metres >= OVERVIEW_AXIS.min && metres <= OVERVIEW_AXIS.max * (1 + 1e-9));
    });
  }
  assert.deepEqual(
    [...new Set(scaleLines("auto", OVERVIEW_AXIS).map((line) => line.unit))],
    ["km", "sun", "au"],
  );
});

test("catalogued radius, temperature and light agree with Stefan–Boltzmann", () => {
  let checked = 0;
  for (const rung of RUNGS) {
    const { radius, teff, luminosity } = RUNG_FACTS[rung.id];
    if (rung.kind !== "star" || !teff || !luminosity || luminosity.status === "derived") continue;
    if (radius.status === "derived") continue;
    const suns = convert(drawn(radius), radius.unit, "Rsun");
    const [cold, hot] = teff.range ?? [teff.value, teff.value];
    const low = stefanBoltzmann.compute({ R: suns, T: cold }) / 1.35;
    const high = stefanBoltzmann.compute({ R: suns, T: hot }) * 1.35;
    assert.ok(
      low <= drawn(luminosity) && drawn(luminosity) <= high,
      `${rung.id}: L, R and T disagree`,
    );
    checked++;
  }
  assert.ok(checked >= 8, `${checked} stars checked`);
});

test("derived figures follow the physics: circumference/c, horizons, densities, convection", () => {
  const sun = RUNG_FACTS.sun;
  assert.ok(Math.abs(sun.lap.value - 14.59) < 0.05, "the Sun's circumference/c is 14.6 s");
  /* M87*'s horizon for 6.5 billion Suns is about 128 au across its radius. */
  const m87 = convert(RUNG_FACTS.m87.radius.value, RUNG_FACTS.m87.radius.unit, "au");
  assert.ok(Math.abs(m87 - 128) < 2, `M87* horizon ${m87} au`);
  assert.ok(Math.abs(sun.density.value - 1.41) < 0.02, "the Sun is 1.41 times as dense as water");
  assert.ok(
    RUNG_FACTS["neutron-star"].teaspoon.value > 1e11,
    "a neutron-star teaspoon outweighs a mountain",
  );
  assert.ok(RUNG_FACTS.betelgeuse.thinness, "Betelgeuse is thinner than air");
  /* Hundreds of granules across the Sun, a handful across a red supergiant. */
  assert.ok(granulesAcross(1, 1, 5772) > 200);
  const betelgeuse = granulesAcross(17, 764, 3600);
  assert.ok(betelgeuse > 3 && betelgeuse < 60, `${betelgeuse} cells across Betelgeuse`);
});

test("every rung's card prints in both languages, a figure in every row", () => {
  for (const locale of ["en", "cs"]) {
    const t = createTranslator({
      locale,
      messages: { giants: featureMessages("giants", locale) },
      namespace: "giants",
    });
    for (const id of RUNG_IDS) {
      const card = rungCard(t, { unit: "auto", locale }, id, (key) => t.has(key));
      assert.ok(card.title && card.badge && card.body, `${locale} ${id}`);
      for (const fact of card.facts) {
        assert.ok(
          fact.value && !fact.value.includes("{"),
          `${locale} ${id}.${fact.id}: ${fact.value}`,
        );
        /* How it ends and what powers it are worded, not figures. */
        if (!["fate", "engine"].includes(fact.id))
          assert.match(fact.value, /\d/, `${locale} ${id}.${fact.id} prints a figure`);
      }
    }
  }
});

test("the ruler reads a round length about a hundred pixels long, in the unit chosen", () => {
  for (const id of RUNG_IDS) {
    const scale = radiusMetres(id).radius / framedRadius(desktop);
    for (const choice of RULERS) {
      const bar = rulerFor(choice, scale);
      assert.ok(bar.px > 96 / 5.01 && bar.px <= 96.0001, `${id} ${choice}: ${bar.px} px`);
      const lead = bar.value / 10 ** Math.floor(Math.log10(bar.value));
      assert.ok(
        [1, 2, 5].some((n) => Math.abs(lead - n) < 1e-9),
        `${bar.value} is 1, 2 or 5 × 10ⁿ`,
      );
    }
  }
  assert.equal(rulerFor("auto", radiusMetres("neutron-star").radius / 300).unit, "km");
  assert.equal(rulerFor("auto", radiusMetres("sun").radius / 300).unit, "sun");
  assert.equal(rulerFor("auto", radiusMetres("ton-618").radius / 300).unit, "au");
  assert.equal(rulerFor("auto", 0), null);
});

test("every rung has an address, and the guide visits rungs that exist", () => {
  for (const id of RUNG_IDS) {
    assert.equal(resolveRung(id), id);
    assert.equal(rungFromPath(pathForRung(id)), id);
  }
  assert.equal(pathForRung("sun"), "/lab/giants");
  assert.equal(resolveRung("pluto"), null);
  for (const step of TOUR) assert.ok(RUNG_IDS.includes(step.rung), step.id);
});

test("flights stay on the ladder and the guide gives the visitor's place back", () => {
  const api = useGiants.getState();
  api.go(-4);
  assert.equal(useGiants.getState().goal, 0);
  api.go(1_000);
  assert.equal(useGiants.getState().goal, RUNG_IDS.length - 1);
  api.publish(rungIndex("arcturus"), rungIndex("arcturus"), 1);
  api.setOrbits(false);
  const before = useGiants.getState().flight;
  api.startGuide();
  assert.equal(useGiants.getState().goal, rungIndex(TOUR[0].rung));
  assert.ok(useGiants.getState().flight > before, "each step is a new flight");
  api.goGuide(3);
  assert.equal(useGiants.getState().orbits, TOUR[3].orbits ?? false);
  api.endGuide();
  assert.equal(useGiants.getState().goal, rungIndex("arcturus"));
  assert.equal(useGiants.getState().orbits, false);
  api.startGuide();
  api.setOverview(true);
  assert.ok(
    useGiants.getState().overview && !useGiants.getState().guideOpen,
    "the overview ends the guide",
  );
  api.goTo("sun");
  assert.ok(!useGiants.getState().overview, "a body picked in the overview is flown back down to");
  assert.equal(useGiants.getState().goal, rungIndex("sun"));
});

const globeOf = (id) => {
  const { seed, spin, tilt, activity } = LOOKS[rungIndex(id)];
  return { kind: activity, globe: { seed, spin, tilt } };
};

test("a flare flashes up within seconds and fades over tens", () => {
  let peak = 0;
  let peakAt = 0;
  for (let t = 0; t < 60; t += 0.05) if (flareLight(t) > peak) [peak, peakAt] = [flareLight(t), t];
  assert.ok(Math.abs(peak - 1) < 1e-3, "its light peaks at 1");
  assert.ok(peakAt < 3, `it peaks after ${peakAt} s`);
  assert.ok(flareLight(peakAt + 15) > 0.05, "it is still fading a quarter of a minute later");
  assert.ok(flareLight(peakAt + 60) < 0.01, "and gone a minute later");
  assert.equal(flareLight(-1), 0);
});

test("the Sun's active regions keep to its spot belts and cross its face from east to west", () => {
  const { kind, globe } = globeOf("sun");
  const [low, high] = ACTIVITY[kind].latitudes;
  for (let t = 0; t < 400; t += 7)
    for (const region of weatherAt(kind, globe, t).regions) {
      const latitude = Math.abs(Math.asin(region.centre[1]));
      assert.ok(
        latitude >= low - 1e-9 && latitude <= high + 1e-9,
        `latitude ${latitude} at ${t} s`,
      );
      assert.ok(region.strength >= 0 && region.strength <= 1);
    }
  const facing = [0, 0, 1];
  const x = (t) => toView(facing, turnAt(globe, t) - turnAt(globe, 0), globe.tilt)[0];
  assert.ok(x(5) > x(0), "the surface moves towards the right, west");
});

test("big flares near the limb launch ejections that leave outwards along their own line", () => {
  for (const id of ["sun", "proxima"]) {
    const { kind, globe } = globeOf(id);
    /** Each ejection's position angle and the fronts seen along it. */
    const flights = new Map();
    for (let t = 0; t < 300; t += 0.5)
      for (const ejection of weatherAt(kind, globe, t).ejections) {
        if (ejection.brightness <= 0) continue;
        const key = ejection.angle.toFixed(6);
        flights.set(key, [...(flights.get(key) ?? []), ejection.front]);
      }
    assert.ok(flights.size >= 3, `${id}: ${flights.size} ejections in five minutes`);
    for (const fronts of flights.values())
      fronts.forEach((front, i) => {
        assert.ok(front >= 1, `${id}: the front starts at the limb`);
        if (i > 0) assert.ok(front > fronts[i - 1], `${id}: the front only moves outwards`);
      });
  }
  for (const id of ["sirius", "rigel", "sirius-b", "neutron-star"]) {
    const { kind, globe } = globeOf(id);
    const weather = weatherAt(kind, globe, 30);
    const lit = [
      ...weather.regions.map((region) => region.strength),
      ...weather.sheets.map((sheet) => sheet.brightness),
      ...weather.ejections.map((ejection) => ejection.brightness),
    ].filter((light) => light > 0);
    assert.equal(lit.length, 0, `${id}: no weather`);
  }
});

/** What the shader shows of a weather: its slots that are lit. */
const shown = (weather) => ({
  ...weather,
  regions: weather.regions.filter((region) => region.strength > 0),
  sheets: weather.sheets.filter((sheet) => sheet.brightness > 0),
  loops: weather.loops.filter((loop) => loop.brightness > 0),
  ejections: weather.ejections.filter((ejection) => ejection.brightness > 0),
  outflows: weather.outflows.filter((cloud) => cloud.gas + cloud.dust > 0),
  flashes: weather.flashes.filter((flash) => flash.strength > 0),
});

test("a forecast reused frame after frame, across stars, says what a fresh one does", () => {
  const forecast = createForecast();
  const stars = ["sun", "proxima", "betelgeuse", "arcturus"].map(globeOf);
  for (let t = 0; t < 240; t += 0.7) {
    /* Stars change hands now and then, as the camera moves on and back. */
    const { kind, globe } = stars[Math.floor(t / 37) % stars.length];
    const reused = shown(forecast.at(kind, globe, t));
    assert.deepEqual(reused, shown(weatherAt(kind, globe, t)), `${kind} at ${t} s`);
  }
});

test("every black hole's card opens it in the Black holes lab", () => {
  const holes = RUNGS.filter((rung) => rung.kind === "horizon");
  assert.ok(holes.length >= 4);
  for (const { id } of holes) {
    const path = UP_CLOSE[id];
    assert.ok(path, `${id} links up close`);
    const preset = resolveHole(path.split("/").pop());
    assert.ok(preset, `${path} is one of the lab's holes`);
    assert.equal(pathForHole(preset), path, `${path} is the preset's own address`);
  }
});

test("the camera eases in and out of a move, alike in either direction, at any frame rate", () => {
  const seconds = glideSeconds(1);
  const fly = (from, to, dt) => {
    let glide = glideAt(from);
    const places = [from];
    for (let t = 0; t < seconds * 1.5; t += dt) {
      glide = glideTowards(glide, to, dt, seconds);
      places.push(glide[2]);
    }
    return places;
  };
  const down = fly(9, 8, 1 / 60);
  const up = fly(8, 9, 1 / 60);
  const speeds = down.slice(1).map((place, i) => Math.abs(place - down[i]) * 60);
  const peak = Math.max(...speeds);
  assert.ok(speeds[0] < 0.05 * peak, "it starts from rest, not at full speed");
  assert.ok(speeds.indexOf(peak) > 0.15 * speeds.length, "it gathers speed before it eases off");
  down.forEach((place, i) => {
    assert.ok(place <= 9 && place >= 8, "it never overshoots from rest");
    assert.ok(Math.abs(place - 8 - (9 - up[i])) < 1e-9, "down mirrors up");
  });
  const arrived = down.findIndex((place) => place - 8 < 0.02) / 60;
  assert.ok(Math.abs(arrived - seconds) < 0.1 * seconds, `arrives in ${arrived} s`);
  const coarse = fly(9, 8, 1 / 20);
  assert.ok(
    Math.abs(coarse[Math.round(20 * seconds * 0.5)] - down[Math.round(60 * seconds * 0.5)]) < 0.02,
    "the same at 20 fps",
  );
  assert.ok(
    glideSeconds(16) > glideSeconds(2) && glideSeconds(2) > seconds,
    "longer flights take longer",
  );
  /* A hand letting go mid-drag hands its speed on. */
  const thrown = glideTowards(glideFrom(5, 2, seconds), 5, 1 / 60, seconds);
  assert.ok(
    thrown[2] > 5 && Math.abs((thrown[2] - 5) * 60 - 2) < 0.3,
    "it carries on at the hand's speed",
  );
});

test("a star's weather comes and goes in time, one star's at once, never cut off", () => {
  const run = (fade, wanted, seconds) => {
    let at = fade;
    const shown = [];
    for (let t = 0; t < seconds; t += 1 / 60) {
      at = fadeWeather(at, wanted, 1 / 60);
      shown.push({ star: at.star, level: weatherShown(at.level) });
    }
    return { at, shown };
  };
  const landed = run(NO_WEATHER, 8, 3);
  assert.equal(landed.at.level, 1, "it wakes fully");
  const steps = landed.shown.slice(1).map((s, i) => s.level - landed.shown[i].level);
  assert.ok(Math.max(...steps) < 0.03, "and gradually, never in a jump");
  assert.ok(steps[0] < 0.001, "starting gently");
  /* Off to another star: the first one's weather fades out before the next one's begins. */
  const moved = run(landed.at, 7, 3);
  const handover = moved.shown.findIndex((s) => s.star === 7);
  assert.ok(
    handover > 0 && moved.shown[handover - 1].level < 0.01,
    "the last star's fades out first",
  );
  assert.ok(
    moved.shown.every((s, i) => i === 0 || Math.abs(s.level - moved.shown[i - 1].level) < 0.05),
    "it fades out over frames, not at once",
  );
  assert.equal(moved.at.star, 7);
});

test("every black hole on the ladder bends the stars", () => {
  assert.equal(LOOKS.filter((look) => look.style === "horizon").length, LENSES);
});

test("a comparison measures one body against its yardstick, and none against itself", async () => {
  const { compare, referenceBody } = await import("../src/features/giants/lib/model/compare.ts");
  const { RUNG_IDS } = await import("../src/features/giants/lib/model/rungs.ts");
  assert.equal(referenceBody("sun", "sun"), null);
  assert.equal(referenceBody("previous", RUNG_IDS[0]), null);
  assert.equal(referenceBody("previous", "sun"), RUNG_IDS[RUNG_IDS.indexOf("sun") - 1]);
  const betelgeuse = compare("betelgeuse", "sun");
  assert.ok(Math.abs(betelgeuse.width / drawn(RUNG_FACTS.betelgeuse.radius) - 1) < 1e-9);
  assert.ok(Math.abs(betelgeuse.volume / betelgeuse.width ** 3 - 1) < 1e-12);
  assert.ok(Math.abs(betelgeuse.light / drawn(RUNG_FACTS.betelgeuse.luminosity) - 1) < 1e-9);
  /* Against Earth a star has a mass ratio but no light to compare. */
  const sun = compare("sun", "earth");
  assert.ok(sun.mass > 3e5 && sun.mass < 3.4e5);
  assert.equal(sun.light, undefined);
});

test("each ladder star falls in the HR band its luminosity class names", async () => {
  const { groupOf } = await import("../src/features/giants/lib/model/compare.ts");
  assert.equal(groupOf("sun"), "mainSequence");
  assert.equal(groupOf("arcturus"), "giants");
  assert.equal(groupOf("betelgeuse"), "supergiants");
  assert.equal(groupOf("sirius-b"), "whiteDwarfs");
  assert.equal(groupOf("r136a1"), undefined);
});

test("a body flattened by its spin says how much wider its equator is than its poles", () => {
  const bulge = (id) => drawn(RUNG_FACTS[id].bulge);
  /* Achernar's flattening is catalogued as 1.35 (equatorial over polar radius). */
  assert.ok(Math.abs(bulge("achernar") - 35) < 1.5);
  assert.ok(bulge("vega") > 10 && bulge("vega") < 15);
  assert.ok(bulge("earth") > 0.3 && bulge("earth") < 0.4);
  assert.ok(bulge("jupiter") > 6 && bulge("jupiter") < 8);
  /* A body with no measured polar radius claims no bulge. */
  assert.equal(RUNG_FACTS.sun.bulge, undefined);
});

test("surface gravity follows GM/R², compared with Earth's the way that reads", () => {
  const g = (id) => drawn(RUNG_FACTS[id].gravity);
  assert.ok(Math.abs(g("sun") - 274) < 0.5);
  assert.ok(Math.abs(g("earth") - 9.8) < 0.01);
  for (const id of RUNG_IDS) {
    const facts = RUNG_FACTS[id];
    if (!facts.gravity) continue;
    /* Exactly one comparison: so many times Earth's, or so many times weaker. */
    assert.ok(Boolean(facts.gravityEarths) !== Boolean(facts.gravityWeaker), id);
    if (facts.gravityWeaker) assert.ok(g(id) < 9.80665, `${id} pulls less than Earth`);
  }
});

test("the Sun's and Earth's cards give their figures in SI, and a rotation limit reads as one", () => {
  const t = createTranslator({
    locale: "en",
    messages: { giants: featureMessages("giants", "en") },
    namespace: "giants",
  });
  const card = (id) =>
    Object.fromEntries(
      rungCard(t, { unit: "auto", locale: "en" }, id, (key) => t.has(key)).facts.map((fact) => [
        fact.id,
        fact.value,
      ]),
    );
  const sun = card("sun");
  assert.match(sun.mass, /10³⁰ kg$/);
  assert.match(sun.radius, /km$/);
  assert.match(sun.luminosity, /10²⁶ W$/);
  assert.match(card("earth").mass, /10²⁴ kg$/);
  /* Betelgeuse's period is known only as P/sin i, an upper limit, printed as its one figure. */
  assert.equal(card("betelgeuse").rotation, "up to 36 years");
  assert.match(card("neutron-star").rotation, /ms$/);
});

test("a grabbed globe turns under the finger, coasts, then goes home the short way", async () => {
  const { letGo, poseRests, restPose, settlePose, turnBy } =
    await import("../src/features/giants/lib/model/grab.ts");
  const { GRAB_HOLD_S } = await import("../src/features/giants/lib/parameters.ts");
  const { globe } = globeOf("sun");
  const radius = 200;
  /* Dragged a tenth of its radius right, the point facing us moves a tenth of a radius right. */
  const pose = restPose();
  turnBy(pose, 20, 0, radius, globe.tilt, 0.016);
  const facing = (p) =>
    toView([0, 0, 1], turnAt({ ...globe, twist: p.twist }, 0) - turnAt(globe, 0), globe.tilt)[0];
  assert.ok(Math.abs(facing(pose) - Math.sin(0.1)) < 1e-9);
  /* Never past a pole, however far it is dragged. */
  turnBy(pose, 0, 10 * radius, radius, globe.tilt, 0.016);
  assert.ok(Math.abs(globe.tilt + pose.pitch - Math.PI / 2) < 1e-9);

  /* Let go at rest: it holds the pose, then heads home. */
  const left = restPose();
  turnBy(left, -radius * (2 * Math.PI - 0.1), 0, radius, globe.tilt, 1);
  letGo(left, false);
  settlePose(left, GRAB_HOLD_S * 0.9, globe.tilt, false);
  assert.ok(Math.abs(left.twist) > 6, "held where the hand left it");
  settlePose(left, GRAB_HOLD_S * 0.2, globe.tilt, false);
  assert.ok(Math.abs(left.twist) <= 0.1, "a turn of almost 360° goes back the short way");
  for (let k = 0; k < 600; k++) settlePose(left, 1 / 60, globe.tilt, false);
  assert.ok(poseRests(left), "home within ten seconds");

  /* Flicked, it keeps turning once let go. */
  const flicked = restPose();
  turnBy(flicked, 40, 0, radius, globe.tilt, 0.02);
  letGo(flicked, true);
  const before = flicked.twist;
  settlePose(flicked, 0.1, globe.tilt, false);
  assert.ok(flicked.twist < before, "it coasts on the way it was flung");

  /* Under reduced motion it neither coasts nor glides: home at once after the hold. */
  const still = restPose();
  turnBy(still, 40, 30, radius, globe.tilt, 0.02);
  letGo(still, true);
  settlePose(still, GRAB_HOLD_S + 0.01, globe.tilt, true);
  assert.ok(poseRests(still));
});

test("the orbits ripple in round the body landed on, and leave before the next body's come", async () => {
  const { NOBODY, handOver } = await import("../src/features/giants/lib/model/hand-over.ts");
  const { ringRadius, ringShown } = await import("../src/features/giants/lib/model/orbit-rings.ts");
  const { ORBIT_FADE_IN_S, ORBIT_FADE_OUT_S } =
    await import("../src/features/giants/lib/parameters.ts");
  const step = (fade, wanted, seconds) => {
    for (let t = 0; t < seconds; t += 1 / 60)
      fade = handOver(fade, wanted, 1 / 60, ORBIT_FADE_IN_S, ORBIT_FADE_OUT_S);
    return fade;
  };
  const rings = 6;
  /* Landing on Betelgeuse: the inner rings come first, and all arrive at their true size. */
  const half = step(NOBODY, 19, ORBIT_FADE_IN_S / 2);
  assert.ok(ringShown(half.level, 0, rings) > ringShown(half.level, rings - 1, rings));
  const landed = step(half, 19, ORBIT_FADE_IN_S);
  for (let k = 0; k < rings; k++) assert.equal(ringShown(landed.level, k, rings), 1);
  assert.equal(ringRadius(100, 1), 100);
  assert.ok(ringRadius(100, 0) < 100, "a ring grows into place");
  /* Flying on to Antares: they fade round Betelgeuse first, outer rings leaving first. */
  const leaving = step(landed, 18, ORBIT_FADE_OUT_S / 2);
  assert.equal(leaving.owner, 19);
  assert.ok(ringShown(leaving.level, rings - 1, rings) < ringShown(leaving.level, 0, rings));
  const handed = step(leaving, 18, ORBIT_FADE_OUT_S);
  assert.equal(handed.owner, 18);
});

test("cautions and technical notes quote the shared catalogue's figures in both languages", async () => {
  const { createTranslator } = await import("next-intl");
  const { featureMessages, leaves } = await import("./messages-helper.mjs");
  const { proseArgs } = await import("../src/lib/facts.ts");
  const { PROSE_FIGURES } = await import("../src/features/giants/lib/model/catalogue.ts");
  for (const locale of ["en", "cs"]) {
    const messages = featureMessages("giants", locale);
    const t = createTranslator({
      locale,
      messages,
      onError(error) {
        throw error;
      },
    });
    /* The notes' own model numbers, as the technical details pass them. */
    const values = { shadowPerRs: "2.6", teaspoonMl: 5, lensDistance: 1 };
    const args = { ...proseArgs(PROSE_FIGURES, locale), ...values };
    for (const [key] of leaves(messages))
      if (
        /^rungs\..*\.caution$|^technicalDetails\.sections\.(limits|horizons|matter)\.body$/.test(
          key,
        )
      )
        assert.doesNotMatch(t(key, args), /[{}]|NaN|undefined/, `${locale}:${key}`);
  }
});

test("every rung and every Stellar Spectra star is named by the shared copy, in both languages", async () => {
  const { createTranslator } = await import("next-intl");
  const { featureMessages } = await import("./messages-helper.mjs");
  const { rungNameKey } = await import("../src/features/giants/lib/model/names.ts");
  const { STAR_IDS } = await import("../src/features/spectroscopy/lib/model/stars.ts");
  for (const locale of ["en", "cs"]) {
    const strict = (feature) =>
      createTranslator({
        locale,
        messages: featureMessages(feature, locale),
        onError(error) {
          throw error;
        },
      });
    const giants = strict("giants");
    for (const id of RUNG_IDS) assert.ok(giants(rungNameKey(id)).length > 0, `${locale}:${id}`);
    /* A star both labs show reads the same in each. */
    const spectra = strict("spectroscopy");
    for (const id of STAR_IDS) {
      const name = spectra(`names.${id}`);
      assert.ok(name.length > 0, `${locale}:${id}`);
      if (RUNG_IDS.includes(id)) assert.equal(giants(rungNameKey(id)), name, `${locale}:${id}`);
    }
  }
});

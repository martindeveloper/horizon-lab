import assert from "node:assert/strict";
import test from "node:test";

import { DRIFT } from "../src/features/sun/lib/drift.ts";
import { LIGHT_IDS } from "../src/features/sun/lib/model/lights.ts";
import { PLACES, PLACE_IDS } from "../src/features/sun/lib/model/places.ts";
import {
  CYCLE_PEAK_PHASE,
  CYCLE_STAGE_IDS,
  ERUPTION_STAGE_IDS,
  cycleStageAt,
  eruptionStageAt,
} from "../src/features/sun/lib/model/stages.ts";
import { TOUR } from "../src/features/sun/lib/model/tour.ts";
import { DEFAULT_VIEW, VIEW_DEFAULTS, VIEW_IDS } from "../src/features/sun/lib/model/views.ts";
import { SUN_PATH } from "../src/features/sun/manifest.ts";
import { pathForView, resolveView, viewRouteParams } from "../src/features/sun/routing.ts";
import { SUN_EQUATIONS } from "../src/space/sun/equations.ts";
import { cycleCountAt, cyclePhaseAt, yearOfCycleCount } from "../src/space/sun/model/cycle.ts";
import { ERUPTION_STAGES, X_POINT_S } from "../src/space/sun/model/parameters.ts";
import { PASSBANDS } from "../src/space/sun/model/passbands.ts";

test("every view has one canonical path, the default at the lab's root", () => {
  assert.equal(pathForView(DEFAULT_VIEW), SUN_PATH);
  assert.equal(pathForView("inside"), `${SUN_PATH}/inside`);
  assert.equal(resolveView(undefined), DEFAULT_VIEW);
  assert.equal(resolveView("Eruption"), "eruption");
  assert.equal(resolveView("moon"), null);
  assert.deepEqual(
    viewRouteParams().map(({ view }) => view),
    VIEW_IDS.filter((id) => id !== DEFAULT_VIEW),
  );
  for (const id of VIEW_IDS) assert.ok(LIGHT_IDS.includes(VIEW_DEFAULTS[id].light), id);
  for (const id of LIGHT_IDS) assert.ok(PASSBANDS[id], `${id} is a passband`);
});

test("the tour, the places and the drift name views, lights, places and formulas that exist", () => {
  for (const step of TOUR) {
    assert.ok(VIEW_IDS.includes(step.view), step.id);
    if (step.light) assert.ok(LIGHT_IDS.includes(step.light), step.id);
    if (step.place) assert.ok(PLACE_IDS.includes(step.place), step.id);
    if (step.equation) assert.ok(SUN_EQUATIONS[step.equation], `${step.id}: ${step.equation}`);
  }
  for (const id of PLACE_IDS) {
    const place = PLACES[id];
    assert.ok(VIEW_IDS.includes(place.view), id);
    if (place.light) assert.ok(LIGHT_IDS.includes(place.light), id);
  }
  for (const shot of DRIFT.shots) {
    assert.ok(VIEW_IDS.includes(shot.view));
    assert.ok(LIGHT_IDS.includes(shot.light));
    if (shot.eruption) assert.ok(shot.eruption[0] < shot.eruption[1]);
  }
});

test("the dock's stages follow the model's boundaries, and a cycle count maps back to its year", () => {
  const order = [];
  for (let s = 0; s <= 1; s += 0.01) {
    const stage = eruptionStageAt(s);
    if (order.at(-1) !== stage) order.push(stage);
  }
  assert.deepEqual(order, [...ERUPTION_STAGE_IDS], "each stage once, in order");
  assert.equal(eruptionStageAt(ERUPTION_STAGES.storage), "rising");
  assert.equal(eruptionStageAt(X_POINT_S), "xpoint");
  assert.equal(eruptionStageAt(ERUPTION_STAGES.rise), "reconnecting");
  assert.equal(eruptionStageAt(ERUPTION_STAGES.breakaway), "loops");

  assert.equal(cycleStageAt(0), "minimum");
  assert.equal(cycleStageAt(CYCLE_PEAK_PHASE), "maximum");
  assert.equal(cycleStageAt(CYCLE_PEAK_PHASE / 2), "rising");
  assert.equal(cycleStageAt(0.7), "declining");
  const seen = new Set();
  for (let phase = 0; phase < 1; phase += 0.01) seen.add(cycleStageAt(phase));
  assert.deepEqual([...seen].sort(), [...CYCLE_STAGE_IDS].sort(), "every stage is reached");

  const epoch = Date.UTC(2024, 4, 11, 12);
  const count = cycleCountAt(epoch);
  assert.ok(Math.abs(yearOfCycleCount(count) - 2024.36) < 0.01, "the count's year");
  assert.equal(cyclePhaseAt(epoch), count - 25);
});

test("a view opens with its own light and clock; a place sets what shows it; the guide gives the visitor's back", async () => {
  const { useSun } = await import("../src/features/sun/lib/store.ts");
  const api = () => useSun.getState();
  api().setView("chromosphere");
  assert.equal(api().light, "halpha");
  assert.equal(api().clock, "minute");
  assert.equal(api().cut, 0);
  api().setView("inside");
  assert.equal(api().cut, 1, "the cut opens inside");
  api().setLight("fe171");
  const flights = api().flight;
  api().goTo("flare");
  assert.equal(api().view, "eruption");
  assert.ok(api().flight > flights, "a place flies");
  assert.equal(api().selection, "flare");
  assert.equal(api().eruption, PLACES.flare.eruption);
  assert.equal(api().eruptionPlaying, false);
  assert.equal(api().panel, "none");
  api().goTo("granule");
  assert.equal(api().clock, "minute");
  api().setCut(2);
  assert.equal(api().cut, 1, "the cut is clamped");

  api().setView("surface");
  api().setLight("he304");
  api().setCut(0.5);
  api().startGuide();
  assert.equal(api().guideOpen, true);
  assert.equal(api().view, TOUR[0].view);
  assert.equal(api().selection, TOUR[0].place ?? null);
  api().goGuide(TOUR.findIndex((step) => step.id === "eruption"));
  assert.equal(api().view, "eruption");
  assert.equal(api().eruptionPlaying, true, "the eruption step plays the eruption");
  api().endGuide();
  assert.equal(api().view, "surface");
  assert.equal(api().light, "he304");
  assert.equal(api().cut, 0.5);
  assert.equal(api().eruptionPlaying, false);

  api().setBloom(false);
  api().select("corona");
  api().startDrift();
  assert.equal(api().drift, "loading");
  assert.equal(api().selection, null);
  assert.equal(api().bloom, true, "the drift shows bloom");
  api().stopDrift();
  assert.equal(api().bloom, false, "and gives the visitor's back");
});

test("every card, caption, hint and note renders its figures in both languages", async () => {
  const { createTranslator } = await import("next-intl");
  const { featureMessages } = await import("./messages-helper.mjs");
  const { proseArgs, staticCard } = await import("../src/lib/facts.ts");
  const { PROSE_FIGURES } = await import("../src/space/sun/catalogue.ts");
  const { PLACE_CARDS } = await import("../src/features/sun/components/card-specs.ts");
  const { CLOCK_RATES } = await import("../src/features/sun/lib/model/clock.ts");
  const { lightLegend } = await import("../src/features/sun/components/format.ts");
  const { createFormatter } = await import("next-intl");
  const clean = (text, where) => assert.doesNotMatch(text, /[{}]|NaN|undefined/, where);
  for (const locale of ["en", "cs"]) {
    const messages = featureMessages("sun", locale);
    const t = createTranslator({
      locale,
      messages,
      onError(error) {
        throw error;
      },
    });
    const distance = { unit: "auto", locale };
    for (const id of PLACE_IDS) {
      const card = staticCard(t, distance, `places.${id}`, PLACE_CARDS[id]);
      assert.ok(card.title && card.body && card.caution, `${locale}: ${id}`);
      assert.ok(card.facts.length >= 2, `${locale}: ${id} prints figures`);
      for (const fact of card.facts) {
        clean(fact.label, `${locale}:${id}:${fact.id}`);
        clean(fact.value, `${locale}:${id}:${fact.id}`);
      }
      clean(t(`places.${id}.where`), `${locale}:${id}`);
    }
    const args = { ...proseArgs(PROSE_FIGURES, locale), views: VIEW_IDS.length, places: 17 };
    for (const step of TOUR) {
      clean(t(`tour.steps.${step.id}.title`, args), `${locale}:${step.id}`);
      clean(t(`tour.steps.${step.id}.body`, args), `${locale}:${step.id}`);
    }
    for (const id of VIEW_IDS) {
      clean(t(`views.${id}`), `${locale}:${id}`);
      clean(t(`viewHints.${id}`, args), `${locale}:${id}`);
    }
    const f = createFormatter({ locale });
    for (const id of LIGHT_IDS) {
      clean(t(`lights.${id}`), `${locale}:${id}`);
      clean(t(`lightNotes.${id}`), `${locale}:${id}`);
      const legend = lightLegend(t, f, distance, id);
      clean(legend, `${locale}:${id}`);
      assert.match(legend, /\d/, `${locale}: ${id} quotes a figure`);
    }
    for (const rate of CLOCK_RATES) clean(t(`clocks.${rate}`), `${locale}:${rate}`);
    for (const id of ERUPTION_STAGE_IDS) clean(t(`stages.eruption.${id}`), `${locale}:${id}`);
    for (const id of CYCLE_STAGE_IDS) clean(t(`stages.cycle.${id}`), `${locale}:${id}`);
    for (const key of Object.keys(messages.technicalDetails.sections))
      clean(t(`technicalDetails.sections.${key}.body`, args), `${locale}:${key}`);
    for (const key of Object.keys(messages.technicalDetails.features))
      clean(t(`technicalDetails.features.${key}`, args), `${locale}:${key}`);
  }
});

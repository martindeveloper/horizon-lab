import assert from "node:assert/strict";
import test from "node:test";

import { createStore } from "zustand/vanilla";

import { coachLeader, placeCoach, placeHolds, playCues, settleCoach } from "@horizon/toolkit/ui";

import { driftSlice } from "../src/lib/drift.ts";
import { helpSlice } from "../src/lib/help.ts";
import { registered } from "../src/lib/simulations.ts";
import { featureMessages, layoutMessages } from "./messages-helper.mjs";

/** A clock the test turns by hand: `run(seconds)` fires what falls due, in time order. */
function manualClock() {
  let now = 0;
  const due = [];
  const clock = (seconds, run) => {
    const entry = { at: now + seconds, run };
    due.push(entry);
    return () => due.splice(due.indexOf(entry), 1);
  };
  clock.run = (seconds) => {
    now += seconds;
    for (const entry of due.filter(({ at }) => at <= now).sort((a, b) => a.at - b.at)) {
      due.splice(due.indexOf(entry), 1);
      entry.run();
    }
  };
  return clock;
}

test("a step's cues play in time order, and stopping the step drops the ones still waiting", () => {
  const clock = manualClock();
  const seen = [];
  const stop = playCues(
    [
      { run: () => seen.push("now") },
      { at: 1, run: () => seen.push("one") },
      { at: 0.5, run: () => seen.push("half") },
      { at: 2, run: () => seen.push("two") },
    ],
    clock,
  );
  assert.deepEqual(seen, ["now"]);
  clock.run(1);
  assert.deepEqual(seen, ["now", "half", "one"]);
  stop();
  clock.run(5);
  assert.deepEqual(seen, ["now", "half", "one"]);
});

test("the callout stands beside its target, clear of the HUD and never over the target", () => {
  const stage = { width: 1200, height: 800 };
  const card = { width: 300, height: 140 };
  const gap = 12;
  const overlaps = (a, b) =>
    a.left < b.left + b.width &&
    b.left < a.left + card.width &&
    a.top < b.top + b.height &&
    b.top < a.top + card.height;
  /* A toolbar button at the top right: below it, held inside the stage. */
  const button = { left: 1100, top: 20, width: 32, height: 32 };
  const high = placeCoach({ target: button, card, stage, obstacles: [], gap });
  assert.equal(high.side, "below");
  assert.equal(high.left + card.width, 1200 - gap, "held off the right edge");
  /* A dock control with a panel open above it: the callout goes beside, not over the panel. */
  const control = { left: 450, top: 700, width: 120, height: 40 };
  const panel = { left: 200, top: 300, width: 360, height: 390 };
  const low = placeCoach({ target: control, card, stage, obstacles: [panel], gap });
  assert.ok(!overlaps(low, panel), `clear of the panel (${low.side})`);
  assert.ok(!overlaps(low, control), "clear of its target");
  /* Nothing to point at: over the open scene, away from the dock. */
  const dock = { left: 0, top: 560, width: 1200, height: 240 };
  const free = placeCoach({ target: null, card, stage, obstacles: [dock], gap });
  assert.equal(free.side, "free");
  assert.ok(!overlaps(free, dock), "clear of the dock");
});

test("with no room to spare, the callout covers the quieted HUD, not what the step opened", () => {
  /* The view pill at the top left with its list open below it, the toolbar at the right, the
     page's header above: nothing beside the pill is clear of the list. */
  const stage = { width: 1000, height: 600 };
  const card = { width: 304, height: 130 };
  const pill = { left: 12, top: 24, width: 130, height: 40 };
  const list = { left: 12, top: 72, width: 320, height: 500, kind: "kept" };
  const toolbar = { left: 600, top: 24, width: 390, height: 40, kind: "quiet" };
  const header = { left: 0, top: 0, width: 1000, height: 14, kind: "over" };
  const place = placeCoach({
    target: pill,
    card,
    stage,
    obstacles: [list, toolbar, header],
    gap: 12,
  });
  const covers = (box) =>
    place.left < box.left + box.width &&
    box.left < place.left + card.width &&
    place.top < box.top + box.height &&
    box.top < place.top + card.height;
  assert.ok(!covers(list), `clear of the open list (${place.side} at ${place.left},${place.top})`);
  assert.ok(!covers(pill), "clear of its target");
});

test("the callout never sinks under the page's footer", () => {
  const stage = { width: 1200, height: 800 };
  const card = { width: 300, height: 150 };
  /* A control in the dock, just above the footer bar that lies over the stage's foot. */
  const control = { left: 300, top: 700, width: 220, height: 40 };
  const dock = { left: 150, top: 640, width: 900, height: 125, kind: "quiet" };
  const footer = { left: 0, top: 772, width: 1200, height: 28, kind: "over" };
  const place = placeCoach({ target: control, card, stage, obstacles: [dock, footer], gap: 12 });
  assert.ok(place.top + card.height <= footer.top, `above the footer (${place.side})`);
  /* Settled beside the control, then grown taller with its words: it no longer holds there. */
  const beside = { left: 532, top: 640, side: "right" };
  const taller = { width: 300, height: 150 };
  assert.ok(
    !placeHolds({ place: beside, card: taller, stage, target: control, obstacles: [dock, footer] }),
  );
});

test("the page's bars keep the callout off them, not away from its target", () => {
  /* The guide button at the top right, the Settings panel open below it, the header above. */
  const stage = { width: 1800, height: 590 };
  const card = { width: 300, height: 150 };
  const button = { left: 1640, top: 44, width: 36, height: 36 };
  const obstacles = [
    { left: 0, top: 0, width: 1800, height: 28, kind: "over" },
    { left: 1605, top: 40, width: 190, height: 40, kind: "quiet" },
    { left: 1485, top: 85, width: 310, height: 500, kind: "quiet" },
  ];
  const place = placeCoach({ target: button, card, stage, obstacles, gap: 12 });
  assert.ok(place.left > stage.width / 2, `beside its target (${place.side} at ${place.left})`);
  assert.ok(place.top >= 28, "below the header");
});

test("within a step the callout stays put until what the step is about comes under it", () => {
  const stage = { width: 1200, height: 800 };
  const card = { width: 300, height: 140 };
  const target = { left: 900, top: 20, width: 32, height: 32 };
  const place = { left: 640, top: 64, side: "below" };
  const holds = (obstacles, size = stage) =>
    placeHolds({ place, card, stage: size, target, obstacles });
  assert.ok(holds([]), "nothing in the way");
  /* A panel closing and quieted HUD sliding in do not move it. */
  assert.ok(holds([{ left: 600, top: 100, width: 300, height: 400, kind: "quiet" }]));
  /* The card the step opens comes up under it: it moves. */
  assert.ok(!holds([{ left: 880, top: 70, width: 300, height: 300, kind: "kept" }]));
  /* The stage shrinks under it: it moves. */
  assert.ok(!holds([], { width: 900, height: 800 }));
});

test("a new step waits for its page, then stands by its target, not where the last step left it", () => {
  const stage = { width: 1200, height: 800 };
  const card = { width: 300, height: 140 };
  const base = { card, stage, obstacles: [], gap: 12 };
  /* Step 0 has nothing to point at: the callout stands over the open scene. */
  const first = settleCoach({
    ...base,
    settled: null,
    step: 0,
    read: true,
    targetId: null,
    target: null,
  });
  assert.equal(first.place.side, "free");
  const settled = first.settle;
  /* Step 1 begins before its page is read: the callout holds still, settling on nothing. */
  const waiting = settleCoach({
    ...base,
    settled,
    step: 1,
    read: false,
    targetId: null,
    target: null,
  });
  assert.equal(waiting.place, settled.place);
  assert.equal(waiting.settle, null);
  /* Read, with its target in the toolbar: it goes there, though the old place would still fit. */
  const button = { left: 1100, top: 20, width: 32, height: 32 };
  const there = settleCoach({
    ...base,
    settled,
    step: 1,
    read: true,
    targetId: "help",
    target: button,
  });
  assert.equal(there.place.side, "below");
  /* And keeps it from then on. */
  const kept = settleCoach({
    ...base,
    settled: there.settle,
    step: 1,
    read: true,
    targetId: "help",
    target: button,
  });
  assert.equal(kept.place, there.settle.place);
  assert.equal(kept.settle, null);
});

test("the leader runs in right angles, and not through what the step opened", () => {
  const card = { left: 100, top: 200, width: 300, height: 100 };
  /* Sharing a column: straight up through the middle of what they share. */
  const pill = { left: 230, top: 100, width: 40, height: 40 };
  assert.deepEqual(coachLeader(card, pill), [
    { x: 250, y: 200 },
    { x: 250, y: 140 },
  ]);
  /* Neither column nor row: out of the card's side, one turn onto the target. */
  const button = { left: 600, top: 40, width: 40, height: 40 };
  assert.deepEqual(coachLeader(card, button), [
    { x: 400, y: 250 },
    { x: 620, y: 250 },
    { x: 620, y: 80 },
  ]);
  /* An open list between them: no leader. One that holds the target does not block. */
  const list = { left: 120, top: 150, width: 300, height: 40 };
  assert.equal(coachLeader(card, pill, [list]), null);
  const panel = { left: 200, top: 90, width: 100, height: 60 };
  assert.ok(coachLeader(card, pill, [panel]));
  assert.equal(
    coachLeader(card, { left: 400, top: 200, width: 20, height: 20 }),
    null,
    "none when they touch",
  );
});

/** A store with a scene field, a panel, a selection, a guide and a camera that logs its moves. */
function tourStore(steps, log = []) {
  const camera = {
    mark: () => {
      log.push("mark");
      return () => log.push("back");
    },
    zoom: (factor) => log.push(`zoom ${factor}`),
    turn: () => log.push("turn"),
  };
  return createStore((set, get) => ({
    view: "home",
    panel: "none",
    selection: null,
    camera,
    guideOpen: false,
    endGuide: () => set({ guideOpen: false, view: "home" }),
    setView: (view) => set({ view }),
    ...helpSlice(set, get, {
      steps,
      save: (s) => ({ view: s.view }),
      restore: (saved) => saved,
    }),
  }));
}

const STEPS = [
  { id: "a", cues: [{ run: (s) => s.setView("far") }] },
  { id: "b", cues: [{ run: (s) => s.camera.zoom(0.5) }] },
  { id: "c" },
];

test("the tour steps through, and the step past the last ends it", () => {
  const store = tourStore(STEPS);
  store.getState().goHelp(1);
  assert.equal(store.getState().helpOpen, false, "no step before it starts");
  store.getState().startHelp();
  assert.equal(store.getState().helpStep, 0);
  store.getState().goHelp(2);
  assert.equal(store.getState().helpStep, 2);
  store.getState().goHelp(-1);
  assert.equal(store.getState().helpStep, 2, "nothing before the first");
  store.getState().goHelp(3);
  assert.equal(store.getState().helpOpen, false);
  assert.equal(store.getState().helpStep, 0);
});

test("ending at any step gives back the scene, the panel and the selection, then flies the camera home", () => {
  for (const at of [0, 1, 2]) {
    const log = [];
    const store = tourStore(STEPS, log);
    store.setState({ view: "near", panel: "objects", selection: "mars" });
    store.getState().startHelp();
    for (let i = 0; i <= at; i++) {
      store.getState().goHelp(i);
      for (const cue of STEPS[i].cues ?? []) cue.run(store.getState());
    }
    store.setState({ panel: "view", selection: null });
    store.getState().endHelp();
    const s = store.getState();
    assert.deepEqual(
      { view: s.view, panel: s.panel, selection: s.selection, open: s.helpOpen },
      { view: "near", panel: "objects", selection: "mars", open: false },
      `ended at step ${at}`,
    );
    assert.equal(log[0], "mark");
    assert.equal(log.at(-1), "back", "the camera flies home last");
    store.getState().endHelp();
    assert.equal(log.filter((entry) => entry === "back").length, 1, "given back once");
  }
});

test("starting the tour ends a guided journey first, and keeps the scene the guide gave back", () => {
  const store = tourStore(STEPS);
  store.setState({ guideOpen: true, view: "guided" });
  store.getState().startHelp();
  assert.equal(store.getState().guideOpen, false);
  store.getState().goHelp(0);
  STEPS[0].cues[0].run(store.getState());
  store.getState().endHelp();
  assert.equal(store.getState().view, "home");
});

test("a drift started from the tour ends it first, so its restore never lands on the drift's setup", () => {
  const store = createStore((set, get) => ({
    view: "home",
    setView: (view) => set({ view }),
    ...helpSlice(set, get, { steps: STEPS, save: (s) => ({ view: s.view }), restore: (v) => v }),
    ...driftSlice(set, get, { open: () => ({ view: "drift" }) }),
  }));
  store.getState().startHelp();
  STEPS[0].cues[0].run(store.getState());
  store.getState().startDrift();
  const s = store.getState();
  assert.deepEqual(
    { open: s.helpOpen, view: s.view, drift: s.drift },
    { open: false, view: "drift", drift: "loading" },
  );
});

/** A camera that only counts: what a tour asks of it, and its way home. */
function countingCamera() {
  const moves = { mark: 0, back: 0, zoom: 0, turn: 0 };
  return {
    moves,
    camera: {
      mark: () => {
        moves.mark++;
        return () => moves.back++;
      },
      zoom: () => moves.zoom++,
      turn: () => moves.turn++,
    },
  };
}

/** The store's own values, without its actions, the camera, its machine's fields and the flight counter. */
function sceneOf(state) {
  const skip = new Set(["camera", "flight", "turn", "helpOpen", "helpStep", "savedBeforeHelp"]);
  return structuredClone(
    Object.fromEntries(
      Object.entries(state).filter(([key, value]) => typeof value !== "function" && !skip.has(key)),
    ),
  );
}

/** Every simulation's store module exports one store with a tour; this finds it. */
async function tourOf(slug) {
  const { HELP } = await import(`../src/features/${slug}/lib/help.ts`);
  const exports = await import(`../src/features/${slug}/lib/store.ts`);
  const store = Object.values(exports).find(
    (value) => typeof value?.getState === "function" && "startHelp" in value.getState(),
  );
  return { steps: HELP, store };
}

for (const { id: slug } of registered) {
  test(`${slug}: its tour moves the scene and gives it all back`, async () => {
    const { steps, store } = await tourOf(slug);
    assert.ok(store, "its store carries the tour");
    assert.ok(steps.length >= 4, "a tour of several controls");
    const fresh = store.getInitialState();
    for (const end of ["finish", "close"]) {
      store.setState(fresh, true);
      const { moves, camera } = countingCamera();
      store.setState({ camera });
      const before = sceneOf(store.getState());
      store.getState().startHelp();
      let driven = 0;
      const last = end === "finish" ? steps.length - 1 : Math.floor(steps.length / 2);
      for (let i = 0; i <= last; i++) {
        store.getState().goHelp(i);
        assert.equal(store.getState().helpStep, i);
        const was = JSON.stringify(sceneOf(store.getState()));
        const moved = moves.zoom + moves.turn;
        for (const cue of steps[i].cues ?? []) cue.run(store.getState());
        if (JSON.stringify(sceneOf(store.getState())) !== was || moves.zoom + moves.turn !== moved)
          driven++;
      }
      if (end === "finish") {
        assert.ok(driven >= steps.length / 2, `most steps move the scene (${driven})`);
        store.getState().goHelp(steps.length);
      } else store.getState().endHelp();
      assert.equal(store.getState().helpOpen, false);
      assert.deepEqual(sceneOf(store.getState()), before, `given back after ${end}`);
      assert.deepEqual([moves.mark, moves.back], [1, 1], "the camera flies home once");
    }
    store.setState(fresh, true);
  });

  test(`${slug}: every step of its tour has words in both languages`, async () => {
    const { steps } = await tourOf(slug);
    for (const locale of ["en", "cs"]) {
      const { help } = featureMessages(slug, locale);
      /* The steps every simulation has take the shared words where the pack says nothing. */
      const shared = layoutMessages(null, locale).help.steps;
      const words = (id, field) => help?.[id]?.[field] ?? shared[id]?.[field];
      for (const { id } of steps) {
        assert.equal(typeof words(id, "title"), "string", `${locale}: help.${id}.title`);
        assert.equal(typeof words(id, "body"), "string", `${locale}: help.${id}.body`);
      }
    }
  });
}

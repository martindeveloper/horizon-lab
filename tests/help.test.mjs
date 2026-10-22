import assert from "node:assert/strict";
import test from "node:test";

import { createStore } from "zustand/vanilla";

import { coachLeader, placeCoach, playCues } from "@horizon/toolkit/ui";

import { helpSlice } from "../src/lib/help.ts";
import { registered } from "../src/lib/simulations.ts";
import { featureMessages } from "./messages-helper.mjs";

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

test("the leader runs from the callout's edge to the target's", () => {
  const leader = coachLeader(
    { left: 100, top: 200, width: 300, height: 100 },
    { left: 230, top: 100, width: 40, height: 40 },
  );
  assert.deepEqual(leader, { from: { x: 250, y: 200 }, to: { x: 250, y: 140 } });
  assert.equal(
    coachLeader(
      { left: 0, top: 0, width: 10, height: 10 },
      { left: 10, top: 0, width: 5, height: 5 },
    ),
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
      for (const { id } of steps) {
        assert.equal(typeof help?.[id]?.title, "string", `${locale}: help.${id}.title`);
        assert.equal(typeof help?.[id]?.body, "string", `${locale}: help.${id}.body`);
      }
    }
  });
}

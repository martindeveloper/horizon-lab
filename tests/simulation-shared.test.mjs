import assert from "node:assert/strict";
import test from "node:test";

import { createStore } from "zustand/vanilla";

import { DisposalScope } from "../packages/toolkit/src/rendering/disposal.ts";
import { defaultSceneAntialias } from "../packages/toolkit/src/scene/host.ts";
import { carryPose, handoffPath, leaveFor, takeHandoff } from "../src/lib/handoff.ts";
import { bridgeAntialias, bridgeStore } from "../src/lib/scene-bridge.ts";
import { withSpaceMessages } from "../src/space/messages.ts";
import { framingView, viewOf } from "../src/space/solar-system/model/framing.ts";
import { TODAY } from "../src/space/solar-system/model/moment.ts";
import { positionOf } from "../src/space/solar-system/model/position.ts";

test("a crossing between the simulations is read once, by its addressee, with the pose left", () => {
  const pose = { azimuth: 1.2, inclination: 0.4, distance: 72 };
  const open = { min: 0, max: Infinity };
  leaveFor("deep-field");
  assert.equal(takeHandoff("orrery", open), null);
  /* The side being left adds its camera's pose; the side arrived at never does. */
  carryPose("deep-field", { azimuth: 9, inclination: 9, distance: 9 });
  carryPose("orrery", pose);
  assert.deepEqual(takeHandoff("deep-field", open), { to: "deep-field", pose });
  assert.equal(takeHandoff("deep-field", open), null, "cleared once taken");
  carryPose("orrery", pose);
  assert.equal(takeHandoff("deep-field", open), null, "no crossing, nothing carried");
  /* A pose from inside the other side's range is held to the arrival's. */
  leaveFor("deep-field");
  carryPose("orrery", { ...pose, distance: 1e-6 });
  assert.deepEqual(takeHandoff("deep-field", { min: 0.5, max: 10 })?.pose, {
    ...pose,
    distance: 0.5,
  });
  /* Both name the solar system's views alike; each has its own default. */
  assert.equal(handoffPath("orrery", "giants"), "/lab/orrery");
  assert.equal(handoffPath("orrery", "oort"), "/lab/orrery/oort");
  assert.equal(handoffPath("deep-field", "giants"), "/lab/deep-field/giants");
});

test("the store bridge acts once on each turn and flight, never on the engine's own writes", () => {
  const store = createStore((set) => ({
    view: "a",
    flight: 0,
    turn: null,
    ready: false,
    setReady: (ready) => set({ ready }),
  }));
  const scope = new DisposalScope();
  const seen = { turns: 0, flights: [], frames: 0 };
  const bridge = bridgeStore(store, scope, {
    invalidate: () => (seen.frames += 1),
    turn: () => (seen.turns += 1),
    fly: (s) => seen.flights.push(s.view),
  });
  store.setState({ turn: { azimuth: 1, inclination: 0 } });
  store.setState({ view: "b", flight: 1 });
  /* The HUD following the zoom writes the view inside a frame: no flight back. */
  bridge.frame(() => store.setState({ view: "c" }));
  store.setState({ flight: 2 });
  assert.equal(seen.turns, 1);
  assert.deepEqual(seen.flights, ["b", "c"]);
  assert.equal(seen.frames, 3, "changes outside a frame ask for one");
  assert.equal(bridge.ready(), true);
  assert.equal(bridge.ready(), false, "once");
  scope.dispose();
  store.setState({ view: "d", flight: 3 });
  assert.deepEqual(seen.flights, ["b", "c"], "disposed, it listens no more");
});

test("a scene draws with MSAA, or none on tight devices, until the visitor picks another", () => {
  assert.equal(defaultSceneAntialias(false), "msaa");
  assert.equal(defaultSceneAntialias(true), "off");
  const store = createStore((set) => ({
    antialias: null,
    setAntialias: (antialias) => set({ antialias }),
  }));
  const host = {
    antialias: defaultSceneAntialias(true),
    setAntialias: (m) => (host.antialias = m),
  };
  const scope = new DisposalScope();
  bridgeAntialias(store, scope, host);
  assert.equal(store.getState().antialias, "off", "the device's default is published");
  store.getState().setAntialias("fxaa");
  assert.equal(host.antialias, "fxaa");
  scope.dispose();
  store.getState().setAntialias("msaa");
  assert.equal(host.antialias, "fxaa", "disposed, it listens no more");
});

test("the shared space copy merges under a simulation's own, and is never written twice", () => {
  const merged = withSpaceMessages(
    { units: { au: "au" }, names: { sun: "Sun" } },
    { app: "Orrery", names: { pluto: "Pluto" } },
  );
  assert.deepEqual(merged, {
    units: { au: "au" },
    names: { sun: "Sun", pluto: "Pluto" },
    app: "Orrery",
  });
  assert.throws(
    () => withSpaceMessages({ names: { sun: "Sun" } }, { names: { sun: "Slunce" } }),
    /in the shared space copy and the simulation/,
  );
});

test("each body has the view that frames it, and a tap flies there only when out of frame", () => {
  const planet = (id) => viewOf({ kind: "planet", id });
  assert.deepEqual(["mercury", "venus", "earth", "mars"].map(planet), [
    "inner",
    "inner",
    "inner",
    "inner",
  ]);
  assert.deepEqual(["jupiter", "saturn", "uranus"].map(planet), ["giants", "giants", "giants"]);
  assert.equal(planet("neptune"), "kuiper");
  assert.equal(viewOf({ kind: "named", id: "sedna" }), "scattered");
  assert.equal(viewOf({ kind: "population", id: "oort" }), "oort");
  /* Jupiter framed (the camera within 0.4–8 of its orbit): stay; from close by Earth: fly out. */
  assert.equal(framingView({ kind: "planet", id: "jupiter" }, 1, 30), null);
  assert.equal(framingView({ kind: "planet", id: "jupiter" }, 1, 1), "giants");
  assert.equal(framingView({ kind: "population", id: "kuiper" }, 1, 6), null);
});

test("selections sit where the scene draws them today", () => {
  const now = new Date("2026-10-18T00:00:00Z");
  assert.deepEqual(positionOf({ kind: "sun" }, TODAY, now), [0, 0, 0]);
  const earth = positionOf({ kind: "planet", id: "earth" }, TODAY, now);
  assert.ok(Math.abs(Math.hypot(...earth) - 1) < 0.02, "Earth about 1 au out");
  const sedna = positionOf({ kind: "named", id: "sedna" }, TODAY, now);
  assert.ok(Math.hypot(...sedna) > 70, "Sedna far out");
  assert.equal(positionOf({ kind: "population", id: "kuiper" }, TODAY, now), null);
});

test("leaving a simulation starts the next visit fresh: guides, selections and panels reset", async () => {
  const { freshVisit } = await import("../src/components/simulations/use-fresh-visit.ts");
  const { useDeepField } = await import("../src/features/deep-field/lib/store.ts");
  const { useOrrery } = await import("../src/features/orrery/lib/store.ts");
  const { useBlackHole } = await import("../src/features/black-hole/lib/store.ts");
  const { useSpectroscopy } = await import("../src/features/spectroscopy/lib/store.ts");

  useDeepField.getState().patchShow({ halo: true });
  useDeepField.getState().startGuide();
  useOrrery.getState().startGuide();
  useBlackHole.getState().startGuide();
  useSpectroscopy.getState().toggleCompare("Fe");
  useSpectroscopy.getState().startGuide();
  for (const store of [useDeepField, useOrrery, useBlackHole, useSpectroscopy]) {
    assert.equal(store.getState().guideOpen, true);
    freshVisit(store)();
    const s = store.getState();
    assert.equal(s.guideOpen, false);
    assert.deepEqual(
      Object.fromEntries(Object.entries(s).filter(([, v]) => typeof v !== "function")),
      Object.fromEntries(
        Object.entries(store.getInitialState()).filter(([, v]) => typeof v !== "function"),
      ),
    );
  }
  assert.equal(useDeepField.getState().show.halo, false, "switches go back too");
  assert.equal(useDeepField.getState().showBeforeGuide, null);
  assert.equal(useBlackHole.getState().orbitBeforeGuide, null);
  assert.deepEqual(useSpectroscopy.getState().compare, [], "marked elements go back too");
});

import assert from "node:assert/strict";
import test from "node:test";

import { createStore } from "zustand/vanilla";

import { MOONS } from "@horizon/toolkit/bodies";
import { DisposalScope, startEngine } from "@horizon/toolkit/rendering";
import { defaultSceneAntialias } from "@horizon/toolkit/scene";
import { AU_KM } from "@horizon/toolkit/science";

import { carryPose, handoffPath, leaveFor, takeHandoff } from "../src/lib/handoff.ts";
import { bridgeRender, bridgeStore } from "../src/lib/scene-bridge.ts";
import { withSpaceMessages } from "../src/space/messages.ts";
import { framingView, viewOf } from "../src/space/solar-system/model/framing.ts";
import { TODAY } from "../src/space/solar-system/model/moment.ts";
import { positionOf } from "../src/space/solar-system/model/position.ts";
import { hasSurface, hostOf, solarPick } from "../src/space/solar-system/model/selection.ts";
import { solarLabelPick } from "../src/space/solar-system/scene/solar-system.ts";

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

test("the store's render settings reach the engine: the level now, later ones after paint, AA at once", async () => {
  assert.equal(defaultSceneAntialias(false), "msaa");
  assert.equal(defaultSceneAntialias(true), "off");
  const store = createStore((set) => ({
    antialias: null,
    quality: "standard",
    bloom: false,
    lens: false,
    setAntialias: (antialias) => set({ antialias }),
  }));
  const host = {
    tight: true,
    antialias: "off",
    bloom: [],
    lens: [],
    setAntialias: (m) => (host.antialias = m),
    setBloom: (b) => host.bloom.push(b),
    setLens: (l) => host.lens.push(l),
  };
  const levels = [];
  const scope = new DisposalScope();
  const settle = () => new Promise((done) => setTimeout(done, 5));
  bridgeRender(store, scope, host, (level) => levels.push(level));
  assert.deepEqual(levels, ["standard"], "the engine starts at the store's level");
  assert.equal(store.getState().antialias, "off", "the device's default is published");
  assert.deepEqual(host.bloom, [{ enabled: false }], "the bloom switch reaches the host at once");
  assert.deepEqual(host.lens, [{ enabled: false }], "so does the lens switch");
  store.getState().setAntialias("fxaa");
  assert.equal(host.antialias, "fxaa");
  store.setState({ bloom: true });
  store.setState({ bloom: true });
  assert.deepEqual(
    host.bloom,
    [{ enabled: false }, { enabled: true }],
    "only a change is passed on",
  );
  store.setState({ lens: true });
  store.setState({ bloom: false });
  assert.deepEqual(host.lens, [{ enabled: false }, { enabled: true }], "each switch on its own");
  assert.deepEqual(host.bloom.at(-1), { enabled: false });
  store.setState({ quality: "max" });
  store.setState({ quality: "economy" });
  assert.deepEqual(levels, ["standard"], "a new level waits for the control to answer");
  await settle();
  assert.deepEqual(levels, ["standard", "economy"], "quick changes arrive as the last");
  /* A reset clears the choice; the device's default comes back, not the last mode. */
  store.setState({
    antialias: null,
    quality: "standard",
    bloom: false,
    lens: false,
  });
  assert.equal(store.getState().antialias, "off");
  assert.equal(host.antialias, "off");
  assert.deepEqual(host.bloom.at(-1), { enabled: false });
  assert.deepEqual(host.lens.at(-1), { enabled: false });
  await settle();
  assert.deepEqual(levels, ["standard", "economy", "standard"]);
  store.setState({ quality: "max" });
  scope.dispose();
  await settle();
  store.getState().setAntialias("msaa");
  assert.equal(host.antialias, "off", "disposed, it listens no more");
  assert.equal(levels.length, 3, "a level pending at disposal never arrives");
});

test("space scenes: Standard keeps each device's old budgets, the other levels move them", async () => {
  const { spaceQuality, sceneTier } = await import("../src/space/quality.ts");
  const { orreryQuality } = await import("../src/features/orrery/lib/quality.ts");
  const { deepFieldQuality } = await import("../src/features/deep-field/lib/quality.ts");
  /* What phones and desktops drew before the levels existed. */
  assert.deepEqual(spaceQuality("standard", true).resolution, { dprCap: 1.25, fps: 48 });
  assert.deepEqual(spaceQuality("standard", false).resolution, { dprCap: 1.5, fps: Infinity });
  assert.equal(orreryQuality("standard", true).sky.milkyWay, 12_000);
  assert.equal(orreryQuality("standard", false).maps.budget, 64e6);
  assert.equal(deepFieldQuality("standard", true).cosmos.share, 0.6);
  /* Economy and Cinematic pin a tier whatever the device; Max goes past both, phones too. */
  for (const tight of [true, false]) {
    assert.equal(sceneTier("economy", tight), "light");
    assert.equal(sceneTier("cinema", tight), "full");
    assert.equal(sceneTier("max", tight), "max");
  }
  /* Max holds a low-memory device's buffer and resident maps to what it can keep. */
  assert.ok(
    spaceQuality("max", true).resolution.dprCap < spaceQuality("max", false).resolution.dprCap,
  );
  assert.ok(orreryQuality("max", true).maps.budget < orreryQuality("max", false).maps.budget);
  assert.equal(
    orreryQuality("max", true).maps.anisotropy,
    orreryQuality("max", false).maps.anisotropy,
  );
  const counts = (q) => Object.values(orreryQuality(q, false).swarms).reduce((a, b) => a + b);
  assert.ok(counts("economy") < counts("standard") && counts("standard") < counts("max"));
  assert.equal(spaceQuality("economy", false).resolution.fps, 30);
  /* The level sizes the effects, never switches them: a longer, finer star up the levels. */
  const lens = (q) => spaceQuality(q, false).lens;
  /* Lights are found in cells of the same size of the frame, whatever the chain's scale. */
  for (const q of ["economy", "standard", "max"])
    assert.equal(spaceQuality(q, false).bloom.scale / 2 ** lens(q).level, 1 / 32);
  assert.ok(
    lens("economy").reach < lens("standard").reach && lens("standard").reach < lens("max").reach,
  );
  assert.deepEqual(
    spaceQuality("standard", true).lens,
    lens("economy"),
    "tight devices keep the light tier",
  );
});

test("the black hole's bloom and lens follow the exposure, so a darker scene glows and spikes alike", async () => {
  const { bloomSettings, lensSettings, BLACK_HOLE_LENS } =
    await import("../src/features/black-hole/lib/quality.ts");
  const bright = lensSettings("standard", false, 1);
  const dim = lensSettings("standard", false, 0.5);
  assert.equal(bright.threshold, BLACK_HOLE_LENS.threshold);
  assert.equal(dim.threshold, 2 * bright.threshold, "the threshold is in radiance before exposure");
  assert.deepEqual(
    dim.mask,
    bloomSettings("standard", false, 0.5),
    "the spikes read the bloom's mask",
  );
  /* The level sizes the star; touch or battery operation takes the small one. */
  assert.ok(lensSettings("economy", false, 1).reach < lensSettings("max", false, 1).reach);
  assert.deepEqual(
    {
      level: lensSettings("standard", true, 1).level,
      reach: lensSettings("standard", true, 1).reach,
    },
    {
      level: lensSettings("economy", false, 1).level,
      reach: lensSettings("economy", false, 1).reach,
    },
  );
  /* Lights are found in cells of the same share of the frame, whatever the chain's scale. */
  for (const q of ["economy", "standard", "max"]) {
    const s = lensSettings(q, false, 1);
    assert.equal(s.mask.scale / 2 ** s.level, 1 / 32);
  }
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

test("every moon opens from its name or its globe, flies in close, and sits on its orbit", () => {
  const now = new Date("2026-10-18T00:00:00Z");
  for (const moon of MOONS) {
    const sel = { kind: "moon", id: moon.id };
    const host = hostOf(moon.id);
    assert.deepEqual(solarLabelPick(moon.id), sel, `${moon.id} name`);
    assert.deepEqual(solarPick(sel), sel, `${moon.id} globe`);
    assert.ok(hasSurface(sel), `${moon.id} close-up`);
    assert.equal(
      framingView(sel, 1, 1),
      framingView(host, 1, 1),
      `${moon.id} framed as its planet`,
    );
    const at = positionOf(sel, TODAY, now);
    const centre = positionOf(host, TODAY, now);
    const km = Math.hypot(at[0] - centre[0], at[1] - centre[1], at[2] - centre[2]) * AU_KM;
    const [near, far] = [moon.aKm * (1 - moon.e), moon.aKm * (1 + moon.e)];
    assert.ok(km > near * 0.999 && km < far * 1.001, `${moon.id} ${km} km from its planet`);
  }
  assert.equal(solarPick({ kind: "moon", id: "nix" }), null, "only catalogued moons");
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
  assert.equal(useDeepField.getState().savedBeforeGuide, null);
  assert.equal(useBlackHole.getState().orbitBeforeGuide, null);
  assert.deepEqual(useSpectroscopy.getState().compare, [], "marked elements go back too");
});

const flush = () => new Promise((resolve) => setImmediate(resolve));

test("lazy engines clean up late arrivals once and suppress failures after navigation", async () => {
  let resolve;
  let report;
  let signal;
  let disposed = 0;
  const errors = [];
  const lifetime = startEngine(
    (abort, onError) => {
      signal = abort;
      report = onError;
      return new Promise((done) => {
        resolve = done;
      });
    },
    (error) => errors.push(error),
  );
  await flush();
  lifetime.dispose();
  assert.equal(signal.aborted, true);
  resolve({
    dispose() {
      disposed++;
    },
  });
  await flush();
  report(new Error("late failure"));
  lifetime.dispose();
  assert.equal(disposed, 1);
  assert.deepEqual(errors, []);
});

test("lazy engine failures are reported and synchronous cancellation never starts work", async () => {
  const error = new Error("GPU unavailable");
  const errors = [];
  const failed = startEngine(
    async () => {
      throw error;
    },
    (value) => errors.push(value),
  );
  await flush();
  assert.deepEqual(errors, [error]);
  failed.dispose();
  let started = false;
  const cancelled = startEngine(
    async () => {
      started = true;
    },
    () => {},
  );
  cancelled.dispose();
  await flush();
  assert.equal(started, false);
  let disposed = 0;
  const ready = startEngine(
    async () => ({
      dispose() {
        disposed++;
      },
    }),
    () => {},
  );
  await flush();
  ready.dispose();
  ready.dispose();
  assert.equal(disposed, 1);
});

test("opening a tour from a hotspot restores the original orbit setting", async () => {
  const { useBlackHole } = await import("../src/features/black-hole/lib/store.ts");
  const original = useBlackHole.getState();
  try {
    for (const autoRotate of [true, false]) {
      useBlackHole.setState({ autoRotate });
      useBlackHole.getState().setActivePin("horizon");
      assert.equal(useBlackHole.getState().autoRotate, false);
      useBlackHole.getState().startGuide();
      assert.equal(useBlackHole.getState().activePin, null);
      useBlackHole.getState().endGuide();
      assert.equal(useBlackHole.getState().autoRotate, autoRotate);
    }
  } finally {
    useBlackHole.setState(original, true);
  }
});

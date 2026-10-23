import assert from "node:assert/strict";
import test from "node:test";

import { Group, PerspectiveCamera, Raycaster, Vector2, Vector3 } from "three";
import { createStore } from "zustand/vanilla";

import { MOONS, keplerPosition } from "@horizon/toolkit/bodies";
import { TAU, wrapSigned } from "@horizon/toolkit/math";
import { DisposalScope, startEngine } from "@horizon/toolkit/rendering";
import { TAP_REACH_PX, defaultSceneAntialias } from "@horizon/toolkit/scene";
import { AU_KM, RAD_PER_DEG } from "@horizon/toolkit/science";

import { slotsIn, toolsShown } from "../src/components/simulations/toolbar-fold.ts";
import { carryPose, handoffPath, leaveFor, takeHandoff } from "../src/lib/handoff.ts";
import { bridgeRender, bridgeStore } from "../src/lib/scene-bridge.ts";
import { withSpaceMessages } from "../src/space/messages.ts";
import { tracerGeometry } from "../src/space/solar-system/graphics/tracers.ts";
import { framingView, viewOf } from "../src/space/solar-system/model/framing.ts";
import { TODAY, momentAt } from "../src/space/solar-system/model/moment.ts";
import { CLEAR_DONE, MODEL_START } from "../src/space/solar-system/model/parameters.ts";
import { positionOf } from "../src/space/solar-system/model/position.ts";
import { hasSurface, hostOf, solarPick } from "../src/space/solar-system/model/selection.ts";
import {
  TRACERS,
  binOf,
  tracerElements,
  tracerVisible,
} from "../src/space/solar-system/model/tracers.ts";
import { createSolarKit } from "../src/space/solar-system/scene/kit.ts";
import {
  chooseSolarHit,
  createSolarSystem,
  solarLabelPick,
} from "../src/space/solar-system/scene/solar-system.ts";

test("a toolbar shows every tool while its line has room, else what fits beside More", () => {
  /* A phone's toolbar: 36 px buttons 8 px apart, 2 px padding each side. */
  const pitch = { padding: 4, gap: 8, button: 36 };
  assert.equal(slotsIn(4 + 6 * 36 + 5 * 8, pitch), 6, "exactly six fit");
  assert.equal(slotsIn(4 + 6 * 36 + 5 * 8 - 1, pitch), 5, "a pixel short holds one fewer");
  assert.equal(slotsIn(0, pitch), 0);
  assert.equal(toolsShown(6, 6), 6, "all fit: no More");
  assert.equal(toolsShown(7, 6), 5, "one short: five beside More");
  assert.equal(toolsShown(7, 1), 0, "room for More alone");
  assert.equal(toolsShown(7, Infinity), 7, "unmeasured shows all");
});

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

test("space quality tiers scale rendering work and constrain low-memory devices", async () => {
  const { spaceQuality, sceneTier } = await import("../src/space/quality.ts");
  const { orreryQuality } = await import("../src/features/orrery/lib/quality.ts");
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
  const { useVoyage } = await import("../src/features/voyage/lib/store.ts");
  const { useGiants } = await import("../src/features/giants/lib/store.ts");
  const { useSun } = await import("../src/features/sun/lib/store.ts");

  useDeepField.getState().patchShow({ halo: true });
  useDeepField.getState().startGuide();
  useOrrery.getState().startGuide();
  useBlackHole.getState().startGuide();
  useSpectroscopy.getState().toggleCompare("Fe");
  useSpectroscopy.getState().startGuide();
  useVoyage.getState().setDrive("sail");
  useVoyage.getState().startGuide();
  useGiants.getState().setOrbits(true);
  useGiants.getState().startGuide();
  useSun.getState().setLight("halpha");
  useSun.getState().goTo("flare");
  useSun.getState().startGuide();
  for (const store of [
    useDeepField,
    useOrrery,
    useBlackHole,
    useSpectroscopy,
    useVoyage,
    useGiants,
    useSun,
  ]) {
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
  assert.equal(useBlackHole.getState().savedBeforeGuide, null);
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

/** The real solar system with a stub for painted sprites' 2D canvas (no browser, no WebGL). */
function withSolarScene(run) {
  const original = globalThis.document;
  globalThis.document = {
    createElement: () => ({
      getContext: () => ({
        createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
        putImageData() {},
        createRadialGradient: () => ({ addColorStop() {} }),
        fillRect() {},
      }),
    }),
  };
  globalThis.window ??= globalThis;
  globalThis.window.matchMedia ??= () => ({ matches: true, addEventListener() {} });
  const scope = new DisposalScope();
  try {
    const camera = new PerspectiveCamera(48, 1.6, 1e-9, 1e7);
    const kit = createSolarKit({
      scope,
      camera,
      viewport: { width: 1600, height: 1000 },
      tight: true,
      dpr: { value: 1 },
    });
    const scene = new Group();
    const solar = createSolarSystem(kit, scene, {
      place() {},
      hideAll() {},
      setBodies() {},
      rulers: { anchor: () => ({ x: 0, y: 0, z: 0, on: false }) },
      swarms: { belt: 10, trojans: 10, kuiper: 10, oort: 10 },
    });
    const now = new Date("2026-10-18T00:00:00Z");
    const show = { names: true, trueSize: false, elliptical: true, drift: false, kuiper: true };
    /**
     * Puts the camera at `position` looking at `aim` and settles the scene there, today or at
     * another `moment`, with any `switches` changed.
     */
    const view = (position, aim, sel, moment = TODAY, switches = {}) => {
      camera.position.copy(position);
      camera.lookAt(aim);
      camera.updateMatrixWorld();
      const dist = position.distanceTo(aim);
      const shown = { ...show, ...switches };
      for (let frame = 0; frame < 12; frame += 1) {
        kit.lod.begin(0.1, dist, dist);
        solar.update({ ...moment, dt: 0.1, now, show: shown, sel, playing: false, dist });
      }
      scene.updateMatrixWorld(true); // as a render would
    };
    run({ camera, solar, now, view });
  } finally {
    scope.dispose();
    globalThis.document = original;
  }
}

test("a tap on a selected planet's moon picks the moon, from any side", () => {
  withSolarScene(({ camera, solar, view }) => {
    const sel = { kind: "planet", id: "earth" };
    const globes = [solar.sun, ...solar.planets.planets.map((planet) => planet.body)];
    const raycaster = new Raycaster();
    const shown = (object) => !object || (object.visible && shown(object.parent));
    let tapped = 0;
    // The Orrery's camera circles the Sun: behind the Earth, edge-on through the belt, above.
    for (const distance of [0.6, 1.5, 3, 5])
      for (const lift of [0.05, 0.4, 1.2])
        for (let step = 0; step < 16; step += 1) {
          const turn = (step / 16) * Math.PI * 2;
          const position = new Vector3(Math.sin(turn), 0, Math.cos(turn))
            .multiplyScalar(Math.cos(lift))
            .setY(Math.sin(lift))
            .multiplyScalar(distance);
          view(position, new Vector3(), sel);
          const moon = solar.moons.drawnAt("moon");
          assert.ok(moon, "a selected planet's moon is drawn");
          const ndc = new Vector3().fromArray(moon).project(camera);
          if (Math.abs(ndc.x) > 1 || Math.abs(ndc.y) > 1 || ndc.z > 1) continue;
          raycaster.setFromCamera(new Vector2(ndc.x, ndc.y), camera);
          // Behind a drawn globe (Earth's, or Venus passing in front) the Moon is not seen.
          const far = camera.position.distanceTo(ndc.set(...moon));
          const hidden = globes.some((globe) => {
            const centre = globe.getWorldPosition(new Vector3());
            const ahead = camera.position.distanceTo(centre) < far;
            return globe.visible && ahead && raycaster.ray.distanceToPoint(centre) < globe.scale.x;
          });
          if (hidden) continue;
          const hits = raycaster
            .intersectObjects(solar.pickables, false)
            .filter((c) => shown(c.object));
          const pick = chooseSolarHit(hits, raycaster.ray)?.object.userData.pick;
          const where = `${distance} au, ${lift} rad up, ${turn.toFixed(2)} rad round`;
          assert.deepEqual(pick, { kind: "moon", id: "moon" }, where);
          tapped += 1;
        }
    assert.ok(tapped > 100);
  });
});

test("a tap on a planetesimal finds it where the model has moved it, only while it is drawn", () => {
  withSolarScene(({ camera, solar, now, view }) => {
    const raycaster = new Raycaster();
    const shown = (object) => !object || (object.visible && shown(object.parent));
    const bins = { disk: true, kuiper: true, scattered: true, oort: true, ejected: true };
    /**
     * What a tap picks `px` CSS pixels above the middle of the view (1000 px tall), the camera
     * 3 au from `at` looking at it.
     */
    const tapAt = (at, moment, switches, px = 0) => {
      const aim = new Vector3(...at);
      view(aim.clone().add(new Vector3(0, 1, 3)), aim, null, moment, switches);
      raycaster.setFromCamera(new Vector2(0, (2 * px) / 1000), camera);
      const hits = raycaster
        .intersectObjects(solar.pickables, false)
        .filter((c) => shown(c.object));
      const hit = chooseSolarHit(hits, raycaster.ray);
      return hit ? solarPick(hit.object.userData.pick, hit.instanceId) : null;
    };
    /* Halfway through the clearing, three centuries along the orbits. */
    const moment = momentAt(MODEL_START - (MODEL_START - CLEAR_DONE) / 2, 321.5);
    const index = TRACERS.findIndex((tr) => binOf(tr, moment.mig) === "scattered");
    const sample = { kind: "tracer", index };
    const at = positionOf(sample, moment, now);
    assert.deepEqual(tapAt(at, moment, bins), sample);
    /* A sample is drawn a few pixels across but taps like a planet, within a fingertip. */
    assert.deepEqual(tapAt(at, moment, bins, TAP_REACH_PX - 4), sample, "a near miss");
    assert.notDeepEqual(tapAt(at, moment, bins, TAP_REACH_PX + 4), sample, "past a fingertip");
    const before = positionOf(sample, { ...moment, driftYears: 0 }, now);
    assert.ok(Math.hypot(at[0] - before[0], at[1] - before[1], at[2] - before[2]) > 1);
    assert.notDeepEqual(tapAt(before, moment, bins), sample, "not where it was");
    assert.notDeepEqual(tapAt(at, moment, { ...bins, scattered: false }), sample, "bin hidden");
    /* Once the clearing has flung it out of the system, nothing is there to tap. */
    const gone = TRACERS.findIndex((tr) => !tracerVisible(tr, 1));
    const last = keplerPosition(tracerElements(TRACERS[gone], 1, 0));
    assert.equal(tapAt(last, TODAY, bins)?.kind === "tracer", false);
  });
});

test("re-based in time, the GPU's single-precision phases keep to the model over ten million years", () => {
  const { geometry, drift } = tracerGeometry(4, 3);
  const phases = geometry.getAttribute("orbitC");
  const f = Math.fround;
  const pixel = 0.1; /* au: a pixel with the Kuiper belt framed */
  /** The most astray along its orbit (au) any sample is drawn: rock.vert.glsl's float32 phase. */
  const astray = (mig, years, phaseOf, since) => {
    let worst = 0;
    TRACERS.forEach((tr, i) => {
      const { a, M } = tracerElements(tr, mig, years);
      const n = f(TAU / f(f(a) ** 1.5));
      const drawn = f(f(phaseOf(i)) + f(n * f(since)));
      worst = Math.max(worst, a * Math.abs(wrapSigned(drawn - M * RAD_PER_DEG, TAU)));
    });
    return worst;
  };
  const epochPhase = (i) => phases.getX(i);
  /* A hundred thousand frames of 100 years each, as the Motion switch runs the clock. */
  const frames = 100_000;
  const step = 100;
  const uploads = phases.version;
  let worst = 0;
  for (let k = 1; k <= frames; k += 1) {
    const since = drift.since(1, k * step, pixel);
    if (k % 500 === 0) worst = Math.max(worst, astray(1, k * step, epochPhase, since));
  }
  assert.ok(worst < pixel, `astray by ${worst} au`);
  assert.ok(phases.version - uploads < frames / 20, "phases upload now and then, not each frame");
  /* Without the epoch, ten million years along, the float32 phase misplaces samples by more. */
  const start = tracerGeometry(4, 3).geometry.getAttribute("orbitC");
  assert.ok(astray(1, frames * step, (i) => start.getX(i), frames * step) > pixel);
  /* Once the clearing moves the orbits, the phases follow at once. */
  const mid = MODEL_START - (MODEL_START - CLEAR_DONE) / 2;
  const mig = momentAt(mid).mig;
  const since = drift.since(mig, frames * step, pixel);
  assert.ok(astray(mig, frames * step, epochPhase, since) < pixel);
});

test("a planet's moons spread out as the camera nears it, selected or not", () => {
  withSolarScene(({ solar, now, view }) => {
    const jupiter = new Vector3().fromArray(
      positionOf({ kind: "planet", id: "jupiter" }, TODAY, now),
    );
    const callisto = MOONS.find((m) => m.id === "callisto");
    const spread = (distance) => {
      view(jupiter.clone().multiplyScalar(1 + distance / jupiter.length()), jupiter, null);
      const at = solar.moons.drawnAt("callisto");
      return at ? new Vector3().fromArray(at).distanceTo(jupiter) / (callisto.aKm / AU_KM) : 0;
    };
    assert.ok(spread(1) > 1.5, "magnified 1 au from Jupiter");
    assert.ok(spread(4) <= 1 + 1e-6, "true distances 4 au away");
  });
});

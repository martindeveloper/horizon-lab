import assert from "node:assert/strict";
import test from "node:test";

import {
  Color,
  Group,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Scene,
  SphereGeometry,
} from "three";

import { atViewScale, nearestView } from "@horizon/toolkit/camera";
import { DisposalScope } from "@horizon/toolkit/rendering";
import {
  createAnchoredRulers,
  createFaders,
  createLineVeil,
  createLogZoom,
  createOrbitRig,
  createPointWriter,
  createReadoutClock,
  createTapPicking,
  createViewMoves,
  fade,
  framed,
  lineOf,
  movedBy,
  niceNumber,
  pickLevel,
  pointsGeometry,
  rising,
  scaleBar,
  scaleChanged,
  scaleReadout,
  worldPerPixel,
} from "@horizon/toolkit/scene";

import { close } from "./toolkit-helpers.mjs";

test("scale bars are round numbers in the visitor's unit, 44–140 px long", () => {
  assert.deepEqual([0.7, 1.2, 2.9, 4, 8, 120].map(niceNumber), [0.5, 1, 2, 5, 10, 100]);
  const bar = scaleBar({ fov: 48, dist: 72, width: 1200, height: 800, world: "au", choice: "au" });
  assert.equal(bar.unit, "au");
  assert.ok([1, 2, 5].includes(bar.value / 10 ** Math.floor(Math.log10(bar.value))));
  assert.ok(bar.px >= 44 && bar.px <= 140);
  /* Light-years of world, shown in parsecs on request. */
  const pc = scaleBar({ fov: 48, dist: 9e4, width: 1200, height: 800, world: "ly", choice: "pc" });
  assert.equal(pc.unit, "pc");
});

test("presence bands ease in log space and close at their ends", () => {
  assert.equal(rising(1, 10, 100), 0);
  assert.equal(rising(1000, 10, 100), 1);
  assert.ok(Math.abs(rising(Math.sqrt(1000), 10, 100) - 0.5) < 1e-12);
  const band = fade(10, 100, 1000, 10_000);
  assert.equal(band(5), 0);
  assert.equal(band(300), 1);
  assert.equal(band(20_000), 0);
  /* Framed: invisible when tiny, full when it fills part of the view, gone when it wraps us. */
  assert.equal(framed(0, 0.01, 1), 0);
  assert.equal(framed(0, 0.5, 1), 1);
  assert.equal(framed(0, 5, 1), 0);
  assert.equal(fade(0, 0, 100, 200)(1e-6), 1, "a band open at zero starts full");
  let last = framed(2.5, 2.5, 100);
  for (let r = 2.5; r < 4.5; r += 0.01) {
    const next = framed(r, r, 100);
    assert.ok(Math.abs(next - last) < 0.05, "framing eases in");
    last = next;
  }
  assert.equal(pickLevel(0, 50, [36, 360]), 1);
  assert.equal(pickLevel(1, 32, [36, 360]), 1, "hysteresis holds a level just below its step");
  assert.equal(pickLevel(1, 20, [36, 360]), 0);
  assert.equal(pickLevel(0, 500, [36, 360]), 2, "levels can be skipped");
  assert.equal(pickLevel(2, 320, [36, 360]), 2);
  assert.equal(pickLevel(2, 10, [36, 360]), 0);
});

test("faders show their first state at once, then ease and report busy", () => {
  const faders = createFaders();
  const on = faders.fader(0.5);
  faders.begin(0.1);
  assert.equal(on.to(true), 1);
  faders.begin(0.1);
  const half = on.to(false);
  assert.ok(half > 0 && half < 1);
  assert.equal(faders.busy, true);
  for (let i = 0; i < 10; i += 1) {
    faders.begin(0.1);
    on.to(false);
  }
  assert.equal(on.value, 0);
  assert.equal(faders.busy, false);
});

test("log zoom flights land on target; springs stay inside limits; a cut carries no speed", () => {
  const zoom = createLogZoom(10, { limits: () => ({ min: 1, max: 1e6 }) });
  zoom.fly(10, 1e5);
  let at = 10;
  let last = 0;
  while (zoom.flying) {
    const step = zoom.step(1 / 60, at);
    assert.ok(step.progress === null || step.progress >= last);
    last = step.progress ?? last;
    at = step.distance;
  }
  assert.ok(Math.abs(at / 1e5 - 1) < 1e-12);
  assert.equal(zoom.moving, false);
  assert.equal(zoom.zoomTo(1e9, false), 1e6);
  /* A new target keeps the zoom moving before it leaves, through a frame with no time in it. */
  assert.equal(zoom.moving, true);
  at = zoom.step(0, at).distance;
  assert.equal(zoom.moving, true);
  for (let i = 0; i < 600; i += 1) at = zoom.step(1 / 60, at).distance;
  assert.ok(Math.abs(at - 1e6) / 1e6 < 1e-3);
  /* Someone else jumped the distance by far more than half an e-fold: no speed carried. */
  zoom.settle(at);
  at = zoom.step(1 / 60, 10).distance;
  assert.ok(Math.abs(at / 10 - 1) < 1e-12);
  assert.equal(zoom.moving, false);
});

function orbitRig({ reduced = false, ...hooks } = {}) {
  const camera = new PerspectiveCamera(48, 1.5, 0.05, 1e9);
  const rig = createOrbitRig(camera, {
    pose: { azimuth: 0, inclination: 0.5, distance: 10 },
    limits: () => ({ min: 1, max: 1e6 }),
    reduceMotion: { matches: reduced },
    ...hooks,
  });
  const frame = (dt) => {
    rig.step(dt);
    rig.home();
    rig.applyPose();
  };
  return { rig, camera, frame };
}

test("orbit rigs fly in log distance and turn their angles on the way, by the short side", () => {
  const { rig, camera, frame } = orbitRig();
  rig.flyTo(1000, { azimuth: Math.PI * 1.5, inclination: 0.2 });
  let frames = 0;
  while (rig.flying && frames < 1000) {
    frame(1 / 60);
    frames += 1;
  }
  assert.ok(Math.abs(rig.pose.distance - 1000) < 1e-9);
  /* From 0 to 3π/2 the short way is a quarter turn back. */
  assert.ok(Math.abs(rig.pose.azimuth + Math.PI / 2) < 1e-9, `${rig.pose.azimuth}`);
  assert.ok(Math.abs(rig.pose.inclination - 0.2) < 1e-9);
  assert.ok(Math.abs(camera.position.length() - 1000) < 1e-6, "the camera sits on the pose");
  assert.ok(Math.abs(camera.far - 40_000) < 1e-6);
  /* A flight to where it already is goes nowhere; a turn alone still flies. */
  rig.flyTo(1000);
  assert.equal(rig.flying, false);
  rig.flyTo(1000, { azimuth: 0, inclination: 0.2 });
  assert.equal(rig.flying, true);
});

test("orbit rigs take hooks for the aim, the frame and other owners, and honour reduced motion", () => {
  const reduced = orbitRig({ reduced: true });
  reduced.rig.flyTo(500, { azimuth: 1, inclination: 0.1 });
  assert.equal(reduced.rig.flying, false);
  assert.deepEqual(reduced.rig.pose, { azimuth: 1, inclination: 0.1, distance: 500 });
  reduced.rig.zoomTo(5e7, false);
  assert.equal(reduced.rig.pose.distance, 1e6, "input clamps to the limits");

  let held = true;
  const { rig, camera, frame } = orbitRig({
    follow: () => ({ held, clamp: true }),
    home: (aim) => aim.set(5, 0, 0),
    orient: (_distance, q) => q.set(0, 0, Math.SQRT1_2, Math.SQRT1_2),
    nearFloor: 0.5,
  });
  rig.zoomTo(100, false);
  frame(1 / 60);
  assert.equal(rig.pose.distance, 10, "a held distance only follows its owner");
  held = false;
  frame(1 / 60);
  assert.ok(rig.pose.distance > 10, "released, the zoom moves on");
  assert.equal(rig.aim.x, 5);
  assert.ok(Math.abs(camera.up.x + 1) < 1e-9, "the frame turns the camera's up");
  assert.equal(camera.near, 0.5);
  rig.turnBy({ azimuth: 1, inclination: 0 });
  rig.turnBy({ azimuth: 1, inclination: 0 });
  frame(1 / 60);
  assert.ok(rig.pose.azimuth > 0 && rig.pose.azimuth < Math.PI / 6, "a button step eases in");
  assert.ok(rig.moving, "and keeps frames coming while it does");
  for (let i = 0; i < 120 && rig.moving; i++) frame(1 / 60);
  assert.ok(Math.abs(rig.pose.azimuth - Math.PI / 6) < 1e-9, "two steps of 15° add up");
  const still = orbitRig({ reduced: true }).rig;
  still.turnBy({ azimuth: 1, inclination: 0 });
  assert.ok(Math.abs(still.pose.azimuth - Math.PI / 12) < 1e-9, "with reduced motion it snaps");
});

test("a button step during a turning flight carries on to where the flight lands", () => {
  const { rig, frame } = orbitRig();
  rig.flyTo(1000, { azimuth: 1, inclination: 0.2 });
  frame(1 / 60);
  rig.turnBy({ azimuth: 1, inclination: 0 });
  while (rig.flying) frame(1 / 60);
  assert.ok(Math.abs(rig.pose.azimuth - (1 + Math.PI / 12)) < 1e-9, `${rig.pose.azimuth}`);
});

test("view moves snap or fly to a view's framing, turning only when asked", () => {
  const views = {
    near: { azimuth: 1, inclination: 0.3, distance: 10 },
    far: { azimuth: 2, inclination: 0.4, distance: 1000 },
  };
  const { rig, frame } = orbitRig();
  const moves = createViewMoves(
    rig,
    (id) => views[id],
    (id) => id === "far",
  );
  moves.snapToView("near");
  assert.deepEqual(rig.pose, views.near);
  moves.flyToView("far");
  while (rig.flying) frame(1 / 60);
  assert.ok(Math.abs(rig.pose.azimuth - 2) < 1e-9 && Math.abs(rig.pose.distance - 1000) < 1e-6);
  moves.flyToView("near");
  while (rig.flying) frame(1 / 60);
  assert.equal(rig.pose.azimuth, 2, "a flight that does not turn keeps the angles");
  const reduced = orbitRig({ reduced: true });
  createViewMoves(reduced.rig, (id) => views[id]).flyToView("far");
  assert.deepEqual(reduced.rig.pose, views.far, "reduced motion lands framed as the view is");
});

test("the nearest view is chosen in log space; a quarter e-fold still counts as at it", () => {
  const views = [{ d: 1 }, { d: 100 }, { d: 10_000 }];
  assert.equal(nearestView(views, (v) => v.d, 9).d, 1);
  assert.equal(nearestView(views, (v) => v.d, 11).d, 100);
  assert.equal(atViewScale(120, 100), true);
  assert.equal(atViewScale(140, 100), false);
  assert.throws(() => nearestView([], (v) => v, 1), /No views/);
});

test("a tap is a press that barely moved; a pinch never ends in one", () => {
  const scope = new DisposalScope();
  const on = {};
  const canvas = {
    addEventListener: (type, listener) => (on[type] = listener),
    removeEventListener: () => {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }),
  };
  const taps = [];
  createTapPicking({ scope, camera: new PerspectiveCamera() }, canvas, {
    pickables: [],
    blocked: () => false,
    labels: () => [],
    labelPick: () => undefined,
    onTap: (target) => taps.push(target),
  });
  const touch = (type, pointerId, x = 50) =>
    on[type]({ pointerId, clientX: x, clientY: 50, pointerType: "touch", button: 0 });
  touch("pointerdown", 1);
  touch("pointerup", 1);
  assert.equal(taps.length, 1, "a tap on nothing reports null once");
  touch("pointerdown", 2, 10);
  touch("pointerup", 2, 30);
  assert.equal(taps.length, 1, "a drag is not a tap");
  touch("pointerdown", 3);
  touch("pointerdown", 4, 60);
  touch("pointerup", 3);
  touch("pointerup", 4, 60);
  assert.equal(taps.length, 1, "neither finger of a pinch taps");
  touch("pointerdown", 5);
  touch("pointercancel", 5);
  touch("pointerdown", 6);
  touch("pointerup", 6);
  assert.equal(taps.length, 2, "a cancelled pointer leaves no pinch behind");
  scope.dispose();
});

test("readouts publish on a clock and only when they change", () => {
  const due = createReadoutClock(0.25);
  assert.equal(due(0.1, false), false);
  assert.equal(due(0.2, false), true);
  assert.equal(due(0.01, true), true, "forced");
  assert.equal(movedBy(101, 100, 0.04), false);
  assert.equal(movedBy(110, 100, 0.04), true);
  assert.equal(movedBy(0.01, 0, 0.04, 1), false, "the floor keeps a zero from triggering");
  const viewport = { width: 1200, height: 800 };
  const scale = scaleReadout({ fov: 48 }, viewport, 72, "au", "au");
  assert.equal(scaleChanged(scale, { ...scale }), false);
  assert.equal(scaleChanged(scaleReadout({ fov: 48 }, viewport, 7200, "au", "au"), scale), true);
});

test("anchored rulers run from home or a chosen anchor to every anchor on screen", () => {
  const scope = new DisposalScope();
  const placed = [];
  const place = (key, x, y, z, on, style) => placed.push({ key, on, text: style?.text });
  const rulers = createAnchoredRulers(scope, new Group(), place, {
    keys: ["home", "a", "b"],
    color: 0xffffff,
    pxWorld: () => 0.01,
    distanceText: (length) => `${length}`,
  });
  Object.assign(rulers.anchor("a"), { x: 3, y: 4, z: 0, on: true });
  Object.assign(rulers.anchor("b"), { x: 0, y: 0, z: 2, on: false });
  rulers.drawFrom(null, 10);
  rulers.finish();
  assert.deepEqual(
    placed.filter((p) => p.on).map((p) => p.text),
    ["5"],
    "home to the one anchor on",
  );
  placed.length = 0;
  rulers.anchor("b").on = true;
  rulers.drawFrom("a", 10);
  rulers.finish();
  assert.deepEqual(
    placed
      .filter((p) => p.on)
      .map((p) => p.text)
      .sort(),
    ["5", `${Math.hypot(3, 4, 2)}`],
  );
  assert.throws(() => rulers.anchor("nowhere"), /Unknown ruler anchor/);
  /* A set in light-years labels its lengths in au, under its own keys. */
  placed.length = 0;
  const far = createAnchoredRulers(scope, new Group(), place, {
    keys: ["home", "a"],
    color: 0xffffff,
    pxWorld: () => 0.01,
    distanceText: (au) => `${Math.round(au)}`,
    world: "ly",
    prefix: "far",
  });
  Object.assign(far.anchor("a"), { x: 1, y: 0, z: 0, on: true });
  far.drawFrom(null, 10);
  far.finish();
  assert.deepEqual(
    placed.filter((p) => p.on).map((p) => [p.key, p.text]),
    [["far0", "63241"]],
  );
  scope.dispose();
});

test("point writers grow past their first size and view exactly what was written", () => {
  const w = createPointWriter(2);
  const c = new Color(0.5, 1, 0.25);
  for (let i = 0; i < 5; i += 1) w.put(i, i * 2, i * 3, c, 2);
  assert.equal(w.count, 5);
  const g = w.geometry();
  assert.equal(g.getAttribute("position").count, 5);
  assert.deepEqual(Array.from(g.getAttribute("position").array.slice(12, 15)), [4, 8, 12]);
  assert.deepEqual(Array.from(g.getAttribute("color").array.slice(0, 3)), [1, 2, 0.5]);
  assert.equal(g.getAttribute("size"), undefined);
  const sized = pointsGeometry(new Float32Array(6), new Float32Array(6), new Float32Array([3, 4]));
  assert.equal(sized.getAttribute("position").count, 2);
  assert.equal(sized.getAttribute("size").itemSize, 1);
  assert.deepEqual(Array.from(sized.getAttribute("size").array), [3, 4]);
});

test("worldPerPixel spans the frustum height over the stage", () => {
  close(worldPerPixel(90, 10, 1000), (2 * 10) / 1000);
  close(worldPerPixel(48, 72, 800) * 800, 2 * Math.tan((48 * Math.PI) / 360) * 72);
  close(worldPerPixel(48, 72, 800) * 2, worldPerPixel(48, 144, 800));
});

test("orbit lines do not occlude bodies in the depth buffer", () => {
  const orbit = lineOf(0xffffff, 0.6);
  assert.equal(orbit.material.depthWrite, false);
  orbit.geometry.dispose();
  orbit.material.dispose();
});

test("a line veil fades every line out together and gives the layers' own state back", async () => {
  const { Line, LineBasicMaterial, LineSegments, Mesh, MeshBasicMaterial, Scene } =
    await import("three");
  const scene = new Scene();
  const orbit = lineOf(0xffffff, 0.6).line;
  const shared = new LineBasicMaterial({ color: 0xffffff, opacity: 1, transparent: false });
  const gridA = new LineSegments(orbit.geometry, shared);
  const gridB = new LineSegments(orbit.geometry, shared);
  const web = new Line(orbit.geometry, new LineBasicMaterial({ opacity: 0.3, transparent: true }));
  web.userData.content = true;
  const off = new Line(orbit.geometry, new LineBasicMaterial({ opacity: 0.5 }));
  off.visible = false;
  const body = new Mesh(undefined, new MeshBasicMaterial({ opacity: 0.8, transparent: true }));
  scene.add(orbit, gridA, gridB, web, off, body);

  const veil = createLineVeil(1);
  assert.equal(veil.presence, 1);
  assert.equal(veil.busy, false);
  veil.cover(scene);
  assert.equal(orbit.material.opacity, 0.6, "fully shown, the veil touches nothing");
  veil.uncover();

  /* Half-way down: lines dim by the eased presence, shared materials once, content and meshes never. */
  veil.step(0.5, false);
  assert.equal(veil.busy, true);
  assert.ok(veil.presence > 0.49 && veil.presence < 0.51);
  veil.cover(scene);
  assert.ok(
    orbit.material.opacity < 0.31 && orbit.material.opacity > 0.29,
    `orbit ${orbit.material.opacity}`,
  );
  assert.ok(shared.opacity < 0.51 && shared.opacity > 0.49, "a material two lines share dims once");
  assert.equal(shared.transparent, true, "an opaque line material blends while dimmed");
  assert.equal(web.material.opacity, 0.3, "content lines keep their look");
  assert.equal(body.material.opacity, 0.8, "meshes are not lines");
  assert.equal(off.visible, false);
  veil.uncover();
  assert.equal(orbit.material.opacity, 0.6);
  assert.equal(shared.opacity, 1);
  assert.equal(shared.transparent, false);

  /* Down: lines hide for the render and come back after, except what was hidden already. */
  veil.step(1, false);
  assert.equal(veil.presence, 0);
  assert.equal(veil.busy, false);
  veil.cover(scene);
  assert.equal(orbit.visible, false);
  assert.equal(gridA.visible, false);
  assert.equal(web.visible, true);
  assert.equal(body.visible, true);
  veil.uncover();
  assert.equal(orbit.visible, true);
  assert.equal(gridA.visible, true);
  assert.equal(off.visible, false, "a line the layer hid stays hidden");

  /* Lifting takes the same time and ends exactly shown. */
  veil.step(0.6, true);
  assert.ok(veil.busy);
  veil.step(0.6, true);
  assert.equal(veil.presence, 1);
  assert.equal(veil.busy, false);
});

test("the line veil fades annotation surfaces with the lines and leaves content alone", () => {
  const scene = new Scene();
  const line = lineOf(0xffffff, 0.5).line;
  const content = lineOf(0xffffff, 0.5).line;
  content.userData.content = true;
  const shell = new Mesh(
    new SphereGeometry(1, 4, 2),
    new MeshBasicMaterial({ opacity: 0.3, transparent: true }),
  );
  shell.userData.annotation = true;
  const body = new Mesh(new SphereGeometry(1, 4, 2), new MeshBasicMaterial({ opacity: 1 }));
  scene.add(line, content, shell, body);
  const veil = createLineVeil(1);
  veil.step(0.5, false);
  veil.cover(scene);
  assert.ok(line.material.opacity < 0.5 && shell.material.opacity < 0.3, "halfway down, both dim");
  assert.equal(content.material.opacity, 0.5, "content lines keep their opacity");
  assert.equal(body.material.opacity, 1, "a body is untouched");
  veil.uncover();
  assert.equal(line.material.opacity, 0.5);
  assert.equal(shell.material.opacity, 0.3);
  veil.step(1, false);
  veil.cover(scene);
  assert.equal(line.visible, false, "fully down, lines are hidden");
  assert.equal(shell.visible, false, "and so is the shell");
  assert.equal(body.visible, true);
  veil.uncover();
  assert.equal(shell.visible, true);
});

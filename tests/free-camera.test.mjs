import assert from "node:assert/strict";
import test from "node:test";

import { Object3D, Quaternion, Vector3 } from "three";

import {
  createCameraSnapshot,
  createDriftCamera,
  freeBasis,
  freeFromOrbit,
  orbitFromFree,
  projectWorld,
  revolveFree,
  sampleFreeFlight,
  stepFreeFly,
  turnFree,
  writeCameraMatrix,
  writeCameraSnapshotFromMatrix,
} from "@horizon/toolkit/camera";

import { diskFlowVelocity, RIDE_SPEED_LIMIT } from "../src/features/black-hole/lib/physics.ts";
import { holdPose, tourPose } from "../src/features/black-hole/lib/tour-flight.ts";
import { close } from "./toolkit-helpers.mjs";

const closeVec = (a, b, tolerance = 1e-9) => a.forEach((v, i) => close(v, b[i], tolerance));
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

/** The orbit camera as the observatory built it by hand before free poses: the frame to keep. */
function handOrbitBasis({ azimuth, inclination, distance, roll }) {
  const c = Math.cos(inclination);
  const pos = [
    distance * c * Math.sin(azimuth),
    distance * Math.sin(inclination),
    distance * c * Math.cos(azimuth),
  ];
  const fwd = pos.map((v) => -v / distance);
  let right = [Math.cos(azimuth), 0, -Math.sin(azimuth)];
  let up = cross(right, fwd);
  const [cr, sr] = [Math.cos(roll), Math.sin(roll)];
  [right, up] = [
    right.map((v, i) => cr * v + sr * up[i]),
    up.map((v, i) => cr * v - sr * right[i]),
  ];
  return { pos, right, up, fwd };
}

test("an orbit pose draws the same frame as a free pose, rolled the same way", () => {
  for (const pose of [
    { azimuth: 0.55, inclination: 0.2, distance: 24, roll: 0 },
    { azimuth: -2.4, inclination: 1.3, distance: 6, roll: 0.05 },
    { azimuth: 3.9, inclination: -0.7, distance: 300, roll: -0.4 },
  ]) {
    const hand = handOrbitBasis(pose);
    const free = freeFromOrbit(pose);
    const basis = freeBasis(free.orientation);
    closeVec(free.position, hand.pos);
    closeVec(basis.right, hand.right);
    closeVec(basis.up, hand.up);
    closeVec(basis.fwd, hand.fwd);
  }
});

test("a free pose reads back as the orbit, tilt and look it was written from", () => {
  const pose = {
    azimuth: 2.1,
    inclination: -0.4,
    distance: 37,
    roll: 0.3,
    look: { yaw: 1.2, pitch: -0.5 },
  };
  const back = orbitFromFree(freeFromOrbit(pose, [1, -2, 3]), [1, -2, 3]);
  for (const key of ["azimuth", "inclination", "distance", "roll"]) close(back[key], pose[key]);
  close(back.look.yaw, pose.look.yaw);
  close(back.look.pitch, pose.look.pitch);
  /* A look turns the line of sight off the aim: yaw to the left, pitch up. */
  const aimed = freeBasis(freeFromOrbit({ ...pose, roll: 0, look: undefined }).orientation);
  const left = freeBasis(
    freeFromOrbit({ ...pose, roll: 0, look: { yaw: 0.3, pitch: 0 } }).orientation,
  );
  assert.ok(
    left.fwd.reduce((s, v, i) => s + v * aimed.right[i], 0) < 0,
    "a positive yaw looks left",
  );
});

test("the camera matrix is three's matrixWorld, and projection reads it", () => {
  const pose = freeFromOrbit({
    azimuth: 0.8,
    inclination: 0.3,
    distance: 20,
    roll: 0.2,
    look: { yaw: 0.4, pitch: 0.1 },
  });
  const object = new Object3D();
  object.position.fromArray(pose.position);
  object.quaternion.fromArray(pose.orientation);
  object.updateMatrixWorld();
  closeVec(writeCameraMatrix(new Float64Array(16), pose), object.matrixWorld.elements, 1e-12);
  /* What lies straight ahead lands at the viewport centre, and right of it to the right. */
  const snapshot = createCameraSnapshot();
  writeCameraSnapshotFromMatrix(snapshot, object.matrixWorld.elements, 20, Math.PI / 3);
  const { fwd, right } = freeBasis(pose.orientation);
  const at = (d, side = 0) =>
    projectWorld(
      snapshot,
      ...pose.position.map((p, i) => p + fwd[i] * d + right[i] * side),
      800,
      600,
    );
  const ahead = at(10);
  close(ahead.x, 400);
  close(ahead.y, 300);
  assert.ok(at(10, 1).x > 400);
  /* three's own camera looks the same way. */
  const look = new Vector3(0, 0, -1).applyQuaternion(new Quaternion().fromArray(pose.orientation));
  closeVec(look.toArray(), fwd, 1e-12);
});

test("turning keeps the horizon and stops short of the poles; a glide turns pose and view together", () => {
  let q = freeFromOrbit({ azimuth: 0, inclination: 0, distance: 10 }).orientation;
  q = turnFree(q, 0.4, 0);
  assert.ok(freeBasis(q).fwd[0] < 0, "a positive yaw turns left (toward −x from +z)");
  for (let i = 0; i < 20; i++) q = turnFree(q, 0.1, 0.3);
  const { fwd, right } = freeBasis(q);
  assert.ok(fwd[1] < 1 && fwd[1] > 0.999, "pitch stops just short of straight up");
  close(right[1], 0, 1e-9);
  /* Revolving about the hole's axis carries the attitude round with the position. */
  const pose = freeFromOrbit({
    azimuth: 0.2,
    inclination: 0.1,
    distance: 9,
    look: { yaw: 0.3, pitch: -0.1 },
  });
  const moved = orbitFromFree(revolveFree(pose, -0.5));
  close(moved.azimuth, 0.2 - 0.5);
  close(moved.look.yaw, 0.3);
  close(moved.look.pitch, -0.1);
});

test("a flight about a centre never cuts inside the nearer end, and lands exactly", () => {
  const from = freeFromOrbit({ azimuth: 0, inclination: 0.1, distance: 8 });
  const to = freeFromOrbit({
    azimuth: Math.PI,
    inclination: -0.1,
    distance: 60,
    look: { yaw: 2, pitch: 0 },
  });
  for (const about of [[0, 0, 0], undefined]) {
    let nearest = Infinity;
    for (let t = 0; t <= 1; t += 0.01)
      nearest = Math.min(nearest, Math.hypot(...sampleFreeFlight(t, from, to, { about }).position));
    if (about) assert.ok(nearest >= 8 - 1e-9, `came within ${nearest}`);
    else assert.ok(nearest < 8, "a straight flight across the hole passes closer");
  }
  assert.deepEqual(sampleFreeFlight(1, from, to, { about: [0, 0, 0] }), to);
  assert.deepEqual(sampleFreeFlight(0, from, to), from);
});

test("free flight follows the camera's axes, eases its speed, and keeps to its bounds", () => {
  const pose = freeFromOrbit({ azimuth: 0, inclination: 0, distance: 20 });
  const forward = { right: 0, up: 0, forward: 1 };
  const options = { speed: () => 2, smoothing: 0.25 };
  const velocity = [0, 0, 0];
  let position = pose.position;
  for (let i = 0; i < 120; i++)
    position = stepFreeFly({ ...pose, position }, velocity, forward, 0, 1 / 60, options);
  close(velocity[2], -2, 1e-3);
  /* Two seconds at 2 M/s, less the quarter second the speed takes to come up. */
  close(position[2], 20 - 2 * (2 - 0.25), 0.05);
  /* Reduced motion follows at once; boost speeds up; the constraint has the last word. */
  const still = [0, 0, 0];
  stepFreeFly(pose, still, forward, 1, 0.01, { ...options, reduceMotion: { matches: true } });
  close(still[2], -10);
  const kept = stepFreeFly(pose, [0, 0, -1e4], forward, 0, 1, {
    ...options,
    constrain: (p) => {
      p[2] = Math.max(p[2], 3);
    },
  });
  close(kept[2], 3);
});

test("a drift shot that looks off its aim lands on that look and turns back on the next", () => {
  const shots = [
    {
      azimuth: 1,
      inclination: 0.1,
      distance: 10,
      look: { yaw: 0.4, pitch: -0.1 },
      flight: { duration: 1 },
      hold: 0.5,
    },
    { azimuth: 2, inclination: 0.3, distance: 40, flight: { duration: 1 }, hold: 0.5 },
  ];
  const drift = createDriftCamera(shots, { variance: 0, drift: 0, sway: 0, creep: 0 });
  drift.start({ azimuth: 2, inclination: 0.3, distance: 40, look: { yaw: -0.2, pitch: 0 } });
  close(drift.pose.look.yaw, -0.2, 1e-12);
  let landed = null;
  for (let i = 0; i < 200 && !landed; i++) {
    const step = drift.step(1 / 60);
    if (step.landed) landed = step.pose;
  }
  close(landed.look.yaw, 0.4);
  close(landed.look.pitch, -0.1);
  for (let i = 0; i < 200 && drift.index === 0; i++) drift.step(1 / 60);
  for (let i = 0; i < 200 && drift.flying; i++) drift.step(1 / 60);
  close(drift.pose.look.yaw, 0);
});

test("a guide beat that looks off the hole eases into it, holds it while gliding, and the next turns back", () => {
  const from = { azimuth: 0, inclination: 0.3, distance: 30, roll: 0 };
  const glide = {
    phase: "hold",
    duration: 9,
    yaw: -0.6,
    inclination: 0.1,
    distance: 9,
    look: { yaw: 0.22, pitch: -0.03 },
    drift: -0.02,
  };
  assert.equal(tourPose(glide, from, 0).look.yaw, 0);
  const landed = tourPose(glide, from, 1);
  close(landed.look.yaw, 0.22);
  const held = holdPose(glide, landed, 10);
  assert.ok(held.azimuth < landed.azimuth, "the hold glides the way the beat drifts");
  assert.deepEqual(held.look, landed.look);
  const next = { phase: "wide", duration: 9, yaw: 1, inclination: 0.5, distance: 120 };
  close(tourPose(next, held, 0.5).look.yaw, 0.11);
  close(tourPose(next, held, 1).look.yaw, 0);
  assert.equal(tourPose(next, from, 0.5).look, undefined, "beats at the hole carry no look");
});

test("a camera riding the disk moves with the gas: Kepler's speed through the hovering frame, toward +φ", () => {
  /* Schwarzschild: a circular orbit passes a static observer at √(M / (r − 2M)), half of c at the ISCO. */
  const isco = diskFlowVelocity([0, 0, 6], 0);
  close(Math.hypot(...isco), 0.5, 1e-12);
  /* Seen from +z the gas moves toward −x: the way the scene's azimuth counts backward. */
  assert.ok(isco[0] < 0);
  close(isco[1], 0);
  close(isco[2], 0);
  /* Kerr, equatorial: v = (r² − 2a√r + a²) / (√Δ (r^{3/2} + a)) (Bardeen, Press & Teukolsky 1972). */
  for (const [r, a] of [
    [9, 0.9],
    [4, 0.998],
    [12, -0.6],
  ]) {
    const delta = r * r - 2 * r + a * a;
    const expected = (r * r - 2 * a * Math.sqrt(r) + a * a) / (Math.sqrt(delta) * (r ** 1.5 + a));
    // Boyer–Lindquist r on the equator sits at √(r² + a²) in the scene.
    close(Math.hypot(...diskFlowVelocity([Math.sqrt(r * r + a * a), 0, 0], a)), expected, 1e-9);
  }
  /* Near the photon orbit the speed nears c, and the ride stays below its limit; the axis is still. */
  close(Math.hypot(...diskFlowVelocity([0, 0, 3.02], 0)), RIDE_SPEED_LIMIT, 1e-12);
  assert.deepEqual(diskFlowVelocity([0, 20, 0], 0.5), [0, 0, 0]);
});

test("a ride eases in with its beat or shot and out after it", () => {
  const from = { azimuth: 0, inclination: 0.3, distance: 30, roll: 0 };
  const ride = { phase: "hold", duration: 9, yaw: -0.6, inclination: 0.1, distance: 9, ride: 1 };
  close(tourPose(ride, from, 0.5).ride, 0.5);
  const landed = tourPose(ride, from, 1);
  assert.equal(holdPose(ride, landed, 30).ride, 1);
  const next = { phase: "wide", duration: 9, yaw: 1, inclination: 0.5, distance: 120 };
  close(tourPose(next, landed, 1).ride, 0);
  assert.equal(tourPose(next, from, 0.5).ride, undefined);

  const drift = createDriftCamera(
    [
      { azimuth: 1, inclination: 0.1, distance: 10, ride: 1, flight: { duration: 1 }, hold: 0.5 },
      { azimuth: 2, inclination: 0.3, distance: 40, flight: { duration: 1 }, hold: 0.5 },
    ],
    { variance: 0, drift: 0, sway: 0, creep: 0 },
  );
  drift.start({ azimuth: 2, inclination: 0.3, distance: 40 });
  const rides = [];
  /* Through the riding shot and on until the next one lands. */
  let landings = 0;
  for (let i = 0; i < 600 && landings < 2; i++) {
    const step = drift.step(1 / 60);
    rides.push(step.pose.ride);
    if (step.landed) landings++;
  }
  assert.equal(Math.max(...rides), 1, "the riding shot lands at full speed");
  close(rides.at(-1), 0, 1e-9);
  assert.ok(
    rides.every((v, i) => i === 0 || Math.abs(v - rides[i - 1]) < 0.05),
    "no jumps",
  );
});

test("a drift's hold can take its orbit rate from where the shot landed", () => {
  const shots = [
    { azimuth: 1, inclination: 0.1, distance: 10, ride: 1, flight: { duration: 1 }, hold: 40 },
    { azimuth: 2, inclination: 0.3, distance: 40, flight: { duration: 1 }, hold: 8 },
  ];
  const seen = [];
  const drift = createDriftCamera(shots, {
    variance: 0,
    drift: 0,
    sway: 0,
    creep: 0,
    holdDrift: (landed, shot) => {
      seen.push(landed.distance);
      return shot.ride ? -0.5 / landed.distance : undefined;
    },
  });
  drift.start({ azimuth: 2, inclination: 0.3, distance: 40 });
  let landed = false;
  for (let i = 0; i < 120 && !landed; i++) landed = drift.step(1 / 60).landed;
  close(seen[0], 10);
  /* Once the orbit has eased in, the hold turns at the landed rate: −0.05 rad/s at 10. */
  for (let i = 0; i < 60 * 25; i++) drift.step(1 / 60);
  const before = drift.pose.azimuth;
  for (let i = 0; i < 60; i++) drift.step(1 / 60);
  close(drift.pose.azimuth - before, -0.05, 2e-3);
});

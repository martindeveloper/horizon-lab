import assert from "node:assert/strict";
import test from "node:test";

import { orreryQuality } from "../src/features/orrery/lib/quality.ts";
import { canCloseUp, useOrrery } from "../src/features/orrery/lib/store.ts";
import {
  CLOSE_UP_FILL,
  CLOSE_UP_SWING,
  aimAt,
  closeUpLimits,
  closeUpPose,
  sampleCloseUp,
  sunwardCloseUpPose,
} from "../src/space/close-up-flight.ts";
import { AIR, AIR_BODIES, airUniforms } from "../src/space/solar-system/graphics/air.ts";
import {
  closeUpMapWidth,
  MOON_FILL,
  moonFraming,
  moonSwing,
} from "../src/space/solar-system/scene/close-up-framing.ts";

const near = (actual, expected, tolerance, label = "") =>
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${label} ${actual} is not within ${tolerance} of ${expected}`,
  );
const cameraDir = ({ azimuth, inclination }) => [
  Math.cos(inclination) * Math.sin(azimuth),
  Math.sin(inclination),
  Math.cos(inclination) * Math.cos(azimuth),
];

test("arrival frames the body and lights it three-quarters from the Sun", () => {
  const mars = [1.2, 0.02, -0.9];
  const radius = 2.27e-5;
  const halfTan = Math.tan((48 * Math.PI) / 360);
  const pose = closeUpPose(mars, radius, halfTan, 0);
  near(radius / pose.distance, halfTan * CLOSE_UP_FILL, 1e-12, "apparent size");
  const toSun = [-mars[0], 0, -mars[2]].map((v) => v / Math.hypot(mars[0], mars[2]));
  const dir = cameraDir(pose);
  const cosine = dir[0] * toSun[0] + dir[2] * toSun[2];
  near(cosine, Math.cos(CLOSE_UP_SWING) * Math.cos(pose.inclination), 1e-9, "phase angle");
  // The Sun has no sunward side: the current azimuth stays.
  assert.equal(closeUpPose([0, 0, 0], 0.00465, halfTan, 1.234).azimuth, 1.234);
  const limits = closeUpLimits(radius, radius * 2.3);
  assert.ok(limits.min > radius && limits.max > pose.distance);
});

test("the flight pans first and dives after, and ends exactly on its poses", () => {
  const from = { azimuth: 0.6, inclination: 0.52, distance: 6.5 };
  const to = { azimuth: 2.4, inclination: 0.3, distance: 1e-4 };
  const start = sampleCloseUp(0, from, to, true);
  const end = sampleCloseUp(1, from, to, true);
  assert.deepEqual(start.pose, from);
  assert.equal(start.aim, 0);
  near(end.pose.distance, to.distance, 1e-15);
  near(end.pose.azimuth, to.azimuth, 1e-12);
  assert.equal(end.aim, 1);
  // Centred on the body while the dive is still well short of it.
  const mid = sampleCloseUp(0.55, from, to, true);
  assert.equal(mid.aim, 1);
  assert.ok(mid.pose.distance > 1e-3, `already ${mid.pose.distance} at mid-flight`);
  let last = Infinity;
  for (let t = 0; t <= 1; t += 0.05) {
    const { distance } = sampleCloseUp(t, from, to, true).pose;
    assert.ok(distance <= last * (1 + 1e-12), "distance only shrinks on the way in");
    last = distance;
  }
  // Out: pulls back before panning home.
  const out = sampleCloseUp(0.3, to, from, false);
  assert.equal(out.aim, 0);
  assert.ok(out.pose.distance > to.distance * 10, "already pulling back");
});

test("a slow dive and pull back keep the body in frame and leave and land at rest", () => {
  /* From a wide view aimed at the Sun down to Mars, and back: the zoom outruns the pan. */
  const mars = [1.2, 0.02, -0.9];
  const sun = [0, 0, 0];
  const wide = { azimuth: 0.6, inclination: 1.2, distance: 9 };
  const close = { azimuth: 2.4, inclination: 0.3, distance: 3e-5 };
  /* The body's offset from the middle of the view, as a tangent of the angle off it. */
  const off = (aim, distance) => Math.hypot(...aim.map((v, k) => v - mars[k])) / distance;
  for (const entering of [true, false]) {
    const [from, to] = entering ? [wide, close] : [close, wide];
    const [fromAim, toAim] = entering ? [sun, mars] : [mars, sun];
    const most = Math.max(off(fromAim, from.distance), off(toAim, to.distance));
    const zoom = (t) => Math.log(sampleCloseUp(t, from, to, entering, 1).pose.distance);
    const speeds = [];
    for (let t = 0; t <= 1 + 1e-9; t += 0.01) {
      const { aim, pose } = sampleCloseUp(t, from, to, entering, 1);
      const at = aimAt(
        mars,
        { look: fromAim.map((v, k) => v - mars[k]), distance: from.distance },
        { look: toAim.map((v, k) => v - mars[k]), distance: to.distance },
        pose.distance,
        aim,
      );
      assert.ok(off(at, pose.distance) <= most + 1e-9, `body off the frame at ${t.toFixed(2)}`);
      if (t > 0) speeds.push(Math.abs(zoom(t) - zoom(t - 0.01)));
    }
    const peak = Math.max(...speeds);
    /* No hard braking or lurch: the zoom starts and ends far below its peak pace. */
    assert.ok(speeds[0] < peak * 0.01 && speeds.at(-1) < peak * 0.01, "leaves and lands at rest");
    const ends = aimAt(
      mars,
      { look: fromAim.map((v, k) => v - mars[k]), distance: from.distance },
      { look: toAim.map((v, k) => v - mars[k]), distance: to.distance },
      to.distance,
      1,
    );
    ends.forEach((v, k) => near(v, toAim[k], 1e-12, "lands on its aim"));
  }
  /* The clock may run on a visit: as the body travels the aim travels with it, mid-flight. */
  const looks = [
    { look: [0, 0, 0], distance: 3e-5 },
    { look: sun.map((v, k) => v - mars[k]), distance: 9 },
  ];
  const step = [0.3, -0.01, 0.2];
  const moved = mars.map((v, k) => v + step[k]);
  const here = aimAt(mars, ...looks, 0.05, 0.4);
  aimAt(moved, ...looks, 0.05, 0.4).forEach((v, k) => near(v - here[k], step[k], 1e-12, "travels"));
  /* A camera already orbiting carries its turn into the dive and eases it out, landing as written. */
  const spin = { azimuth: 0.2, inclination: -0.05 };
  const h = 1e-4;
  const turned = sampleCloseUp(h, wide, close, true, 1, spin).pose;
  const still = sampleCloseUp(h, wide, close, true, 1).pose;
  near((turned.azimuth - still.azimuth) / h, spin.azimuth, 1e-3, "leaves turning");
  near((turned.inclination - still.inclination) / h, spin.inclination, 1e-3, "and tilting");
  const landed = sampleCloseUp(1, wide, close, true, 1, spin).pose;
  near(landed.azimuth, close.azimuth, 1e-12, "lands on its azimuth");
  near(landed.inclination, close.inclination, 1e-12, "and its tilt");
  /* A flight interrupted mid-way hands its zoom and its pan on: the next leaves at that
     pace, eases it out, and still lands where it was going. */
  const motion = { distance: -0.8, look: [0.3, 0, -0.1] };
  const zoomed = sampleCloseUp(h, close, wide, false, 1, motion);
  const stillOut = sampleCloseUp(h, close, wide, false, 1);
  near(
    Math.log(zoomed.pose.distance / stillOut.pose.distance) / h,
    motion.distance,
    1e-3,
    "leaves zooming",
  );
  const looksOut = [
    { look: [0, 0, 0], distance: close.distance },
    { look: sun.map((v, k) => v - mars[k]), distance: wide.distance },
  ];
  const panned = aimAt(mars, ...looksOut, close.distance, zoomed.aim, motion.look, zoomed.carry);
  const stillAim = aimAt(mars, ...looksOut, close.distance, stillOut.aim);
  panned.forEach((v, k) =>
    near((v - stillAim[k]) / (close.distance * h), motion.look[k], 1e-3, "leaves panning"),
  );
  const arrived = sampleCloseUp(1, close, wide, false, 1, motion);
  near(arrived.pose.distance, wide.distance, 1e-9, "lands on its distance");
  aimAt(mars, ...looksOut, wide.distance, arrived.aim, motion.look, arrived.carry).forEach((v, k) =>
    near(v, sun[k], 1e-9, "and on its aim"),
  );
});

test("the drift's swing frames the body with its moon, side-on, and comes back", () => {
  const halfTan = Math.tan((48 * Math.PI) / 360);
  const base = { azimuth: 0.4, inclination: 0.3, distance: 4.3e-5 };
  // The Moon 60 Earth radii out, nearly behind the body from the arrival pose; Phobos close in.
  for (const moon of [
    [-6e-4, -2e-4, -2.2e-3],
    [5e-5, 1e-6, -3e-5],
  ]) {
    const pose = moonFraming(moon, base, halfTan);
    assert.ok(pose.distance >= base.distance, "never nearer than the hold");
    assert.ok(Math.abs(pose.inclination) <= 0.6 + 1e-12, "never down a pole");
    const camera = cameraDir(pose).map((v) => v * pose.distance);
    const toMoon = moon.map((v, k) => v - camera[k]);
    const toBody = camera.map((v) => -v);
    const cos =
      (toMoon[0] * toBody[0] + toMoon[1] * toBody[1] + toMoon[2] * toBody[2]) /
      (Math.hypot(...toMoon) * Math.hypot(...toBody));
    const off = Math.tan(Math.acos(Math.min(1, cos)));
    assert.ok(off <= halfTan * MOON_FILL + 1e-9, "the moon is inside the free view");
    assert.ok(off > halfTan * 0.1, "and clear of the body");
  }
  const marks = [0.22, 0.42, 0.62, 0.82];
  assert.equal(moonSwing(0, marks), 0);
  assert.equal(moonSwing(0.5, marks), 1);
  assert.equal(moonSwing(1, marks), 0);
});

test("the atmosphere shell: thin shells of scattering air on the bodies that have it, sampled by tier", () => {
  assert.deepEqual([...AIR_BODIES].sort(), ["earth", "mars", "titan", "venus"]);
  for (const id of AIR_BODIES) {
    const air = AIR[id];
    assert.ok(air.shell > 0 && air.shell <= 0.2, `${id}: a shell of a few percent`);
    assert.ok(
      air.scale.every((h) => h > 0 && h < air.shell),
      `${id}: the air lies within the shell`,
    );
    assert.ok(
      [...air.rayleigh, ...air.mie].every((depth) => depth >= 0),
      `${id}: no negative depth`,
    );
    assert.ok(air.g > 0 && air.g < 1, `${id}: haze scatters forward`);
    assert.ok(air.deep > 0 && air.deep <= 1, `${id}: the Sun's path counts in part or whole`);
    const u = airUniforms(air);
    assert.ok(u.planet < 1 && u.planet > 0.8, `${id}: the body sits inside the unit shell`);
    /* The coefficients keep each column's depth: coefficient × scale height, in the body's own radii. */
    const unit = 1 + air.shell;
    u.rayleigh.forEach((k, i) =>
      near(k * u.scale[0] * unit, air.rayleigh[i] * unit, 1e-9, `${id} rayleigh ${i}`),
    );
    u.mie.forEach((k, i) => near(k * u.scale[1] * unit, air.mie[i] * unit, 1e-9, `${id} mie ${i}`));
  }
  /* Earth's air is bluest: Rayleigh scattering rises with frequency. */
  assert.ok(
    AIR.earth.rayleigh[2] > AIR.earth.rayleigh[1] && AIR.earth.rayleigh[1] > AIR.earth.rayleigh[0],
  );
  /* The quality level sets how finely the shell is marched, never whether it draws. */
  const steps = (q, tight = false) => orreryQuality(q, tight).closeUp.airSteps;
  assert.ok(steps("economy") < steps("standard") && steps("standard") < steps("max"));
  assert.equal(steps("standard", true), steps("economy"), "tight devices keep the light tier");
  assert.ok(steps("economy") >= 4, "even the lightest march resolves the limb");
});

test("close-up maps: detailed where there is detail, lighter on small devices", () => {
  assert.equal(closeUpMapWidth("earth", false), 2048);
  assert.equal(closeUpMapWidth("earth", true), 1024);
  assert.ok(closeUpMapWidth("neptune", false) <= 1024);
  for (const id of ["sun", "jupiter", "venus", "pluto", "halley"])
    assert.ok(closeUpMapWidth(id, true) <= 1024, id);
});

test("store: close-ups need a globe, today and the solar map; leaving is automatic", () => {
  const api = useOrrery.getState;
  const mars = { kind: "planet", id: "mars" };
  const phobos = { kind: "moon", id: "phobos" };
  useOrrery.setState({ yearsAgo: 0, guideOpen: false, closeUp: null });
  api().select({ kind: "population", id: "asteroids" });
  api().enterCloseUp();
  assert.equal(api().closeUp, null, "a population has no globe");
  api().select(mars);
  assert.ok(canCloseUp(api()));
  api().enterCloseUp();
  assert.deepEqual(api().closeUp, mars);
  api().select(mars);
  assert.deepEqual(api().closeUp, mars, "same body keeps it");
  api().select(phobos);
  assert.deepEqual(api().closeUp, mars, "its moon's card keeps the camera at the planet");
  api().enterCloseUp();
  assert.deepEqual(api().closeUp, phobos, "then flies on to the moon");
  api().leaveCloseUp();
  assert.deepEqual([api().closeUp, api().selection], [mars, mars], "back goes to the planet");
  api().leaveCloseUp();
  assert.equal(api().closeUp, null, "and then to the map");
  api().select(phobos);
  api().enterCloseUp();
  api().leaveCloseUp(true);
  assert.equal(api().closeUp, null, "or straight to the map");
  api().select(mars);
  api().enterCloseUp();
  api().select({ kind: "planet", id: "jupiter" });
  assert.equal(api().closeUp, null, "another system ends it");
  api().enterCloseUp();
  api().setYearsAgo(4e9);
  assert.equal(api().closeUp, null, "maps show today's surfaces");
  api().enterCloseUp();
  assert.equal(api().closeUp, null, "not offered in the deep past");
  api().setYearsAgo(0);
  api().enterCloseUp();
  api().setView("oort");
  assert.equal(api().closeUp, null, "a view change ends it");
});

test("store: one clock; play only toggles, and a seek or a close-up keeps it", () => {
  const api = useOrrery.getState;
  useOrrery.setState({ yearsAgo: 0, playing: false, guideOpen: false, closeUp: null, clock: null });
  api().togglePlay();
  assert.deepEqual([api().playing, api().yearsAgo], [true, 0], "playing at today stays today");
  api().setYearsAgo(4e9);
  assert.equal(api().playing, true, "a seek keeps time running");
  api().togglePlay();
  api().setYearsAgo(0);
  assert.equal(api().playing, false, "and keeps it paused");
  api().togglePlay();
  api().select({ kind: "planet", id: "mars" });
  api().enterCloseUp();
  assert.equal(api().playing, true, "a close-up holds the clock without pausing it");
  api().leaveCloseUp(true);
});

test("a close-up that follows a body round the Sun keeps the same three-quarter light", () => {
  /* In the world frame, the camera's angle off the Sun as seen from the body. */
  const body = [10, 0, 0];
  const pose = closeUpPose(body, 1, 0.4, 0);
  const dir = [
    Math.cos(pose.inclination) * Math.sin(pose.azimuth),
    Math.sin(pose.inclination),
    Math.cos(pose.inclination) * Math.cos(pose.azimuth),
  ];
  const fromSun = Math.acos(-dir[0]);
  /* Up toward the Sun: the elevation is the complement of that angle, the framing the same. */
  const sunward = sunwardCloseUpPose(1, 0.4);
  near(Math.PI / 2 - sunward.inclination, fromSun, 1e-12);
  near(sunward.distance, pose.distance, 1e-12);
});

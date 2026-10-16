import assert from "node:assert/strict";
/**
 * Close-ups: the arrival framing and lighting, the cinematic flight's shape,
 * and the store rules that start and end one.
 */
import test from "node:test";

import {
  CLOSE_UP_FILL,
  CLOSE_UP_SWING,
  closeUpLimits,
  closeUpMapWidth,
  closeUpPose,
  sampleCloseUp,
} from "../src/features/orrery/lib/scene/close-up-flight.ts";
import { canCloseUp, useOrrery } from "../src/features/orrery/lib/store.ts";

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

test("close-up maps: detailed where there is detail, lighter on small devices", () => {
  assert.equal(closeUpMapWidth("earth", false), 2048);
  assert.equal(closeUpMapWidth("earth", true), 1024);
  assert.ok(closeUpMapWidth("neptune", false) <= 1024);
  for (const id of ["sun", "jupiter", "venus", "pluto", "halley"])
    assert.ok(closeUpMapWidth(id, true) <= 1024, id);
});

test("store: close-ups need a globe, today and the solar map; leaving is automatic", () => {
  const api = useOrrery.getState;
  useOrrery.setState({ yearsAgo: 0, viewRealm: "solar", guideOpen: false, closeUp: false });
  api().select({ kind: "population", id: "asteroids" });
  api().enterCloseUp();
  assert.equal(api().closeUp, false, "a population has no globe");
  api().select({ kind: "planet", id: "mars" });
  assert.ok(canCloseUp(api()));
  api().enterCloseUp();
  assert.equal(api().closeUp, true);
  api().select({ kind: "planet", id: "mars" });
  assert.equal(api().closeUp, true, "same body keeps it");
  api().select({ kind: "planet", id: "jupiter" });
  assert.equal(api().closeUp, false, "another body ends it");
  api().enterCloseUp();
  api().setYearsAgo(4e9);
  assert.equal(api().closeUp, false, "maps show today's surfaces");
  api().enterCloseUp();
  assert.equal(api().closeUp, false, "not offered in the deep past");
  api().setYearsAgo(0);
  api().enterCloseUp();
  api().setView("galaxy");
  assert.equal(api().closeUp, false, "a view change ends it");
});

import assert from "node:assert/strict";
import test from "node:test";

import { PerspectiveCamera, Vector3 } from "three";

import { DisposalScope } from "@horizon/toolkit/rendering";

import { createCameraRig } from "../src/features/orrery/lib/scene/camera-rig.ts";
import { createCloseUpController } from "../src/features/orrery/lib/scene/close-up-controller.ts";
import { useOrrery } from "../src/features/orrery/lib/store.ts";
import { momentAt } from "../src/space/solar-system/model/moment.ts";
import {
  L2_KM,
  OBSERVATORIES,
  WEBB_HALO_DAYS,
  WEBB_TRACK_END,
  observatoryOffset,
  observatoryPosition,
} from "../src/space/solar-system/model/observatories.ts";
import { SPACECRAFT, spacecraftFrame } from "../src/space/spacecraft/models.ts";

const AU_KM = 149_597_870.7;
const M_PER_AU = AU_KM * 1e3;
const R_EARTH_KM = 6378.1366;
const DATE = new Date("2026-10-22T12:00:00Z");
const MINUTE_MS = 60_000;
/** An Earth on the scene's +x axis: Webb's turning frame lines up with the scene's. */
const EARTH_X = [1, 0, 0];

const km = (v) => Math.hypot(...v) * AU_KM;
const offsetAt = (id, ms, earth = EARTH_X) =>
  observatoryOffset(id, new Date(DATE.getTime() + ms), earth, [0, 0, 0]);
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const unit = (v) => v.map((x) => x / Math.hypot(...v));
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
/* Earth's pole in the scene frame: the J2000 equator's north, tilted from ecliptic north. */
const EPSILON = (23.4392794 * Math.PI) / 180;
const POLE = [0, Math.cos(EPSILON), -Math.sin(EPSILON)];

/** Heights above the equator over `minutes`, sampled every `step` minutes, km. */
function heights(id, minutes, step) {
  const out = [];
  for (let t = 0; t <= minutes; t += step) out.push(km(offsetAt(id, t * MINUTE_MS)) - R_EARTH_KM);
  return out;
}

/** Minutes until the craft is back nearest where it started, past half an orbit's guess. */
function periodMinutes(id, guess, step) {
  const start = offsetAt(id, 0);
  let best = Infinity;
  let at = 0;
  for (let t = guess / 2; t <= guess * 1.5; t += step) {
    const p = offsetAt(id, t * MINUTE_MS);
    const gap = Math.hypot(p[0] - start[0], p[1] - start[1], p[2] - start[2]);
    if (gap < best) [best, at] = [gap, t];
  }
  return at;
}

test("Hubble circles in low Earth orbit about once every hour and a half, tilted 28.5° to the equator", () => {
  const h = heights("hubble", 200, 1);
  assert.ok(Math.min(...h) > 400 && Math.max(...h) < 600, `${Math.min(...h)}–${Math.max(...h)} km`);
  const period = periodMinutes("hubble", 95, 0.05);
  assert.ok(period > 92 && period < 97, `${period} min`);
  const normal = unit(cross(offsetAt("hubble", 0), offsetAt("hubble", 20 * MINUTE_MS)));
  const tilt = (Math.acos(dot(normal, POLE)) * 180) / Math.PI;
  assert.ok(Math.abs(tilt - 28.47) < 0.1, `${tilt}° to the equator`);
});

test("Earth's bulge turns Hubble's orbit westward by several degrees a day", () => {
  /* The ascending node: where the orbit crosses the equator going north. */
  const node = (ms) => {
    const normal = unit(cross(offsetAt("hubble", ms), offsetAt("hubble", ms + 20 * MINUTE_MS)));
    return unit(cross(POLE, normal));
  };
  const a = node(0);
  const b = node(86_400_000);
  /* Positive about the pole is eastward. */
  const turn = (Math.atan2(dot(cross(a, b), POLE), dot(a, b)) * 180) / Math.PI;
  assert.ok(turn < -5 && turn > -8, `${turn}° a day`);
});

test("Chandra swings from inside the radiation belts to a third of the way to the Moon every few days", () => {
  const h = heights("chandra", 4 * 24 * 60, 5);
  const [low, high] = [Math.min(...h), Math.max(...h)];
  assert.ok(low > 5_000 && low < 20_000, `perigee ${low} km`);
  assert.ok(high > 120_000 && high < 150_000, `apogee ${high} km`);
  const period = periodMinutes("chandra", 63.5 * 60, 1) / 60;
  assert.ok(period > 60 && period < 67, `${period} h`);
});

test("Webb stays about 1.5 million km out, beyond Earth from the Sun, circling L2 every six months", () => {
  assert.ok(Math.abs(L2_KM / 1.5e6 - 1) < 0.02, `L2 at ${L2_KM} km`);
  assert.ok(WEBB_HALO_DAYS > 170 && WEBB_HALO_DAYS < 190, `${WEBB_HALO_DAYS} days round L2`);
  const span = WEBB_TRACK_END.getTime() - DATE.getTime();
  const mean = [0, 0, 0];
  const samples = 400;
  for (let i = 0; i < samples; i++) {
    /* Earth anywhere round the Sun: Webb turns with it, staying on its night side. */
    const angle = (i / samples) * 2 * Math.PI * 7;
    const earth = [Math.cos(angle), 0, Math.sin(angle)];
    const at = offsetAt("webb", (span * i) / samples, earth);
    const distance = km(at);
    assert.ok(distance > 1.1e6 && distance < 1.9e6, `${distance} km from Earth`);
    assert.ok(dot(unit(at), earth) > 0.7, "beyond Earth, away from the Sun");
    const still = offsetAt("webb", (span * i) / samples);
    for (let k = 0; k < 3; k++) mean[k] += (still[k] * AU_KM) / samples;
  }
  /* Averaged over its loops, Webb sits near the L2 point, along the Sun–Earth line. */
  const fromL2 = Math.hypot(mean[0] - L2_KM, mean[1], mean[2]);
  assert.ok(fromL2 < 0.15 * L2_KM, `its loops centre ${fromL2} km from L2`);
});

test("every observatory flies a model scaled by a sourced width, turned to the Sun", () => {
  for (const { id, model } of OBSERVATORIES) {
    const { face, radius } = SPACECRAFT[model];
    assert.equal(face.toward, "sun", id);
    /* The framing takes in most of the craft without leaving it a speck. */
    const frame = spacecraftFrame(model);
    assert.ok(frame > radius / 3 && frame < radius, `${id}: ${frame} m framed of ${radius} m`);
  }
});

test("store: an observatory's close-up keeps Earth's system, goes back to Earth and needs today", () => {
  const api = useOrrery.getState;
  const earth = { kind: "planet", id: "earth" };
  const hubble = { kind: "observatory", id: "hubble" };
  useOrrery.setState({ yearsAgo: 0, guideOpen: false, closeUp: null, selection: null });
  api().select(earth);
  api().enterCloseUp();
  api().select(hubble);
  assert.deepEqual(api().closeUp, earth, "Hubble's card keeps the camera at Earth");
  api().enterCloseUp();
  assert.deepEqual(api().closeUp, hubble, "then flies on to it");
  api().select({ kind: "moon", id: "moon" });
  assert.deepEqual(api().closeUp, hubble, "the Moon is of its system too");
  api().select(hubble);
  api().leaveCloseUp();
  assert.deepEqual([api().closeUp, api().selection], [earth, earth], "back goes to Earth");
  api().select({ kind: "observatory", id: "webb" });
  api().setYearsAgo(2e9);
  assert.deepEqual([api().closeUp, api().selection], [null, null], "they exist only now");
  api().findObservatory("chandra");
  assert.equal(api().yearsAgo, 0, "finding one returns to today");
  assert.deepEqual(api().closeUp, earth, "where Earth's close-up shows its orbit");
  assert.deepEqual(api().selection, { kind: "observatory", id: "chandra" });
  api().leaveCloseUp(true);
  api().select(null);
});

test("the Orrery flies to Hubble at its true size, lit three-quarters, and back to where it left", () => {
  globalThis.window ??= globalThis;
  globalThis.window.matchMedia ??= () => ({ matches: false, addEventListener() {} });
  const fetch = globalThis.fetch;
  /* Earth's detailed map below the craft is not this test's: offline, it stays as it is. */
  globalThis.fetch = () => Promise.reject(new Error("offline"));
  try {
    const camera = new PerspectiveCamera(48, 1.5, 1e-12, 1e6);
    const reduceMotion = { matches: false };
    let closeUp = null;
    const rig = createCameraRig(camera, { reduceMotion, closeUp: () => closeUp?.current ?? null });
    const start = { azimuth: 0.4, inclination: 0.5, distance: 4 };
    rig.snap(start);
    const moment = momentAt(0, 0);
    const kit = {
      scope: new DisposalScope(),
      camera,
      viewport: { width: 1200, height: 800 },
      tight: false,
      looks: {
        surfaceOf: () => undefined,
        air: () => null,
        release() {},
        hold() {},
        mapWidth: () => Infinity,
      },
    };
    closeUp = createCloseUpController(kit, {
      rig,
      reduceMotion,
      invalidate() {},
      locate: (sel, out) => out.fromArray(observatoryPosition(sel.id, moment, DATE)),
      objectsOf: () => [],
      hostOf: () => [],
      reachOf: () => 0,
      onTakeCamera() {},
      onRelease() {},
      upload() {},
      quality: () => ({ light: true, anisotropy: 1, airSteps: 8 }),
    });
    const run = (seconds) => {
      for (let t = 0; t < seconds; t += 1 / 60) {
        rig.step(1 / 60);
        rig.home();
        closeUp.step(1 / 60);
        rig.applyPose();
      }
    };
    closeUp.start({ kind: "observatory", id: "hubble" });
    run(6);
    assert.equal(closeUp.current?.phase, "on");
    const at = new Vector3().fromArray(observatoryPosition("hubble", moment, DATE));
    assert.ok(rig.aim.distanceTo(at) * M_PER_AU < 1e-3, "the aim is on Hubble to a millimetre");
    const metres = rig.pose.distance * M_PER_AU;
    const frame = spacecraftFrame("hubble");
    assert.ok(metres > frame * 2 && metres < frame * 10, `framed from ${metres} m`);
    /* Three-quarter light: the camera stands on the Sun's side, off the Sun–craft line. */
    const toSun = at.clone().negate().normalize();
    const cos = camera.position.clone().sub(rig.aim).normalize().dot(toSun);
    assert.ok(cos > 0.2 && cos < 0.9, `camera-to-Sun cosine ${cos}`);

    closeUp.leave();
    run(6);
    assert.equal(closeUp.current, null);
    assert.ok(Math.abs(rig.pose.distance / start.distance - 1) < 1e-6, `${rig.pose.distance} au`);
    assert.ok(rig.aim.length() < 1e-9, "the aim is back on the Sun");
  } finally {
    globalThis.fetch = fetch;
  }
});

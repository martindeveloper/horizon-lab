import assert from "node:assert/strict";
import test from "node:test";

import { PerspectiveCamera } from "three";

import { createCameraRig } from "../src/features/deep-field/lib/scene/camera-rig.ts";
import { createProbeCloseUp } from "../src/features/deep-field/lib/scene/probe-close-up.ts";
import { useDeepField } from "../src/features/deep-field/lib/store.ts";
import { useSun } from "../src/features/sun/lib/store.ts";
import { PROBE_ANCHOR_IDS, anchorRadius } from "../src/features/voyage/lib/model/anchors.ts";
import { SOURCES } from "../src/lib/sources.ts";
import { PROBES, PROBE_SPACECRAFT, probePosition } from "../src/space/solar-system/model/probes.ts";
import { SPACECRAFT, SPACECRAFT_IDS, spacecraftFrame } from "../src/space/spacecraft/models.ts";

const M_PER_AU = 149_597_870_700;

test("every probe flies a model, each scaled by a sourced width that fits within it", () => {
  for (const probe of PROBES) assert.ok(SPACECRAFT[PROBE_SPACECRAFT[probe.id]], probe.id);
  for (const id of SPACECRAFT_IDS) {
    const { face, radius } = SPACECRAFT[id];
    assert.equal(face.across.unit, "m");
    assert.ok(SOURCES[face.across.source], `${id}: ${face.across.source}`);
    /* A craft is metres across (an observatory's sunshield or arrays a few tens), and reaches
       past its own face. */
    assert.ok(face.across.value > 1 && face.across.value < 25, id);
    assert.ok(radius > face.across.value / 2, id);
  }
});

test("Voyage parks a few metres off a probe, not hundreds of kilometres", () => {
  for (const id of PROBE_ANCHOR_IDS) {
    const metres = anchorRadius(id) * 1e3;
    assert.ok(metres > 1 && metres < 10, `${id}: ${metres} m`);
  }
});

test("a probe's close-up opens from its card and lets go with another selection or view", () => {
  const api = useDeepField.getState;
  api().select({ kind: "reach", id: "heliopause" });
  api().enterCloseUp();
  assert.equal(api().closeUp, null, "the heliopause has no close-up");
  api().select({ kind: "reach", id: "voyager1" });
  api().enterCloseUp();
  assert.equal(api().closeUp, "voyager1");
  api().select({ kind: "reach", id: "pioneer10" });
  assert.equal(api().closeUp, null, "another selection leaves it");
  api().enterCloseUp();
  api().setView("galaxy");
  assert.equal(api().closeUp, null, "a view flight leaves it");
  api().select(null);
});

test("Parker's close-up opens from its card in the Sun lab and only there", () => {
  const api = useSun.getState;
  api().goTo("corona");
  api().enterCloseUp();
  assert.equal(api().closeUp, false);
  api().goTo("parker");
  api().enterCloseUp();
  assert.equal(api().closeUp, true);
  api().goTo("wind");
  assert.equal(api().closeUp, false, "another place leaves it");
  api().select(null);
});

test("Deep Field flies to a probe at its true size, lit three-quarters, and back to where it left", () => {
  const camera = new PerspectiveCamera(48, 1.6, 1e-12, 1e6);
  const reduceMotion = { matches: false };
  const rig = createCameraRig(camera, { state: () => ({ selection: null }), reduceMotion });
  const start = { azimuth: 0.9, inclination: 0.42, distance: 520 };
  rig.snap(start);
  const year = 2026.8;
  const probeAt = (id, out) => probePosition(id, year, out);
  const closeUp = createProbeCloseUp(rig, camera, { probeAt, reduceMotion });
  const run = (want, seconds) => {
    for (let t = 0; t < seconds; t += 1 / 60) {
      closeUp.step(1 / 60, want);
      rig.step(1 / 60);
      rig.home();
      rig.applyPose();
    }
  };

  run("voyager1", 6);
  assert.equal(closeUp.busy, false);
  const at = probeAt("voyager1", [0, 0, 0]);
  const aimOff = Math.hypot(rig.aim.x - at[0], rig.aim.y - at[1], rig.aim.z - at[2]) * M_PER_AU;
  assert.ok(aimOff < 1e-3, `the aim is on the probe (${aimOff} m off)`);
  const metres = rig.pose.distance * M_PER_AU;
  const frame = spacecraftFrame("voyager");
  assert.ok(metres > frame * 2 && metres < frame * 10, `framed from ${metres} m`);
  /* Three-quarter light: the camera stands on the Sun's side, off the Sun–probe line. */
  const toSun = at.map((v) => -v / Math.hypot(...at));
  const off = camera.position.clone().sub(rig.aim).normalize();
  const cos = off.x * toSun[0] + off.y * toSun[1] + off.z * toSun[2];
  assert.ok(cos > 0.2 && cos < 0.9, `camera-to-Sun cosine ${cos}`);

  run(null, 6);
  assert.equal(closeUp.busy, false);
  assert.ok(Math.abs(rig.pose.distance / start.distance - 1) < 1e-6, `${rig.pose.distance} au`);
  assert.ok(rig.aim.length() < 1e-6, "the aim is back on the Sun");
});

test("A drift's probe visit pulls away on the drift's own flight, the probe kept in view until the aim is home", () => {
  const camera = new PerspectiveCamera(48, 1.6, 1e-12, 1e6);
  const reduceMotion = { matches: false };
  const rig = createCameraRig(camera, { state: () => ({ selection: null }), reduceMotion });
  rig.snap({ azimuth: 0.9, inclination: 0.42, distance: 520 });
  const probeAt = (id, out) => probePosition(id, 2026.8, out);
  const style = () => ({
    pace: 4,
    lead: 1,
    scripted: { motion: { azimuth: 0.02, inclination: 0 } },
  });
  const closeUp = createProbeCloseUp(rig, camera, { probeAt, reduceMotion, style });
  const frame = (want) => {
    closeUp.step(1 / 60, want);
    rig.step(1 / 60);
    rig.home();
    rig.applyPose();
  };
  for (let t = 0; t < 16; t += 1 / 60) frame("voyager1");
  assert.equal(closeUp.current?.phase, "on");

  /* The drift flies the pose out to the Oort cloud; the store has let the probe go. */
  const landing = { azimuth: 1.4, inclination: 0.5, distance: 6e4 };
  const from = rig.pose.distance;
  closeUp.release(landing);
  assert.deepEqual(closeUp.current, { phase: "out", released: landing });
  const at = probeAt("voyager1", [0, 0, 0]);
  const halfFov = (camera.fov * Math.PI) / 360;
  for (let i = 1; i <= 600; i++) {
    const t = i / 600;
    rig.pose.distance = from * (landing.distance / from) ** t;
    rig.settle();
    frame(null);
    assert.equal(
      rig.pose.distance,
      from * (landing.distance / from) ** t,
      "the drift owns the pose",
    );
    const toProbe = camera.position.clone().negate().add({ x: at[0], y: at[1], z: at[2] });
    const ahead = rig.aim.clone().sub(camera.position);
    assert.ok(toProbe.angleTo(ahead) < halfFov, `the probe stays in view at ${t.toFixed(2)}`);
  }
  assert.ok(rig.aim.length() < 1e-6, "landed, the aim is home on the Sun");
  closeUp.end();
  frame(null);
  assert.equal(closeUp.current, null);
  assert.ok(rig.aim.length() < 1e-6, "the ladder takes the aim back without a jump");
  assert.ok(Math.abs(rig.pose.distance / landing.distance - 1) < 1e-6, "and keeps the landing");
});

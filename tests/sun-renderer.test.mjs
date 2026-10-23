import assert from "node:assert/strict";
import test from "node:test";

import { Group, Texture } from "three";

import { DisposalScope } from "@horizon/toolkit/rendering";

import { sunQuality } from "../src/features/sun/lib/quality.ts";
import { createAtmosphereLayer } from "../src/features/sun/lib/scene/atmosphere-layer.ts";
import { createFieldLayer } from "../src/features/sun/lib/scene/field-layer.ts";
import { createSunLooks } from "../src/features/sun/lib/scene/looks.ts";
import { createSunModel, SEEDED_GROUPS } from "../src/space/sun/frame.ts";

test("CME rendering fades independently of its position and clears after the eruption", () => {
  const scope = new DisposalScope();
  const scene = new Group();
  const layer = createAtmosphereLayer(scope, scene, createSunLooks(), {
    ramp: scope.own(new Texture()),
    response: scope.own(new Texture()),
    sunlight: [1, 1, 1],
  });
  const model = createSunModel(7, { seeded: SEEDED_GROUPS });
  const input = { time: 0, cyclePhase: 25.4, light: "fe171", fieldLineCount: 0 };
  const settings = { corona: { k: [1, 1, 1], f: 1, e: 1 } };
  try {
    const uniforms = layer.mesh.material.uniforms;
    for (const [stage, presence] of [
      [0.5, 0],
      [0.6, 0.5],
      [0.7, 1],
      [0.5, 0],
    ]) {
      const frame = model.frameAt({ ...input, eruptionScrub: stage });
      layer.update(frame, settings);
      assert.equal(uniforms.uEruption.value.w, frame.eruption.cmeFront);
      assert.ok(uniforms.uEruption.value.w > 1);
      assert.ok(Math.abs(uniforms.uCmePresence.value - presence) < 1e-12);
    }
    const quiet = createSunModel(5).frameAt({ ...input, cyclePhase: 25, eruptionScrub: null });
    assert.equal(quiet.eruption, null);
    layer.update(quiet, settings);
    assert.equal(uniforms.uCmePresence.value, 0);
  } finally {
    scope.dispose();
  }
  assert.equal(scene.children.length, 0);
});

test("ribbons redraw reused model geometry and apply lower quality without a clock tick", () => {
  const scope = new DisposalScope();
  const scene = new Group();
  const layer = createFieldLayer(scope, scene, createSunLooks(), {
    ramp: scope.own(new Texture()),
    response: scope.own(new Texture()),
  });
  const model = createSunModel(7, { seeded: SEEDED_GROUPS });
  const input = {
    time: 0,
    cyclePhase: 25.4,
    light: "fe171",
    eruptionScrub: null,
    fieldLineCount: 128,
  };
  try {
    layer.setQuality(sunQuality("max", false));
    const frame = model.frameAt(input);
    layer.update(frame, true);
    const mesh = scene.getObjectByName("Field lines");
    const geometry = mesh.geometry;
    const detailedCount = geometry.instanceCount;
    layer.setQuality(sunQuality("economy", false));
    layer.update(frame, true);
    assert.equal(mesh.geometry, geometry, "the existing capacity can be reused");
    assert.ok(geometry.instanceCount < detailedCount / 2, "the lower budget applies immediately");

    model.frameAt({ ...input, eruptionScrub: 0.3 });
    layer.update(frame, true);
    const lines = frame.eruption.lines;
    const start = geometry.getAttribute("aStart");
    const before = start.array.slice(0, geometry.instanceCount * 3);
    const version = start.version;
    model.frameAt({ ...input, eruptionScrub: 0.8 });
    layer.update(frame, true);
    assert.equal(frame.eruption.lines, lines, "the model reuses its lines");
    assert.ok(start.version > version, "the renderer uploads the changed geometry");
    assert.notDeepEqual(start.array.slice(0, geometry.instanceCount * 3), before);
    const updated = start.version;
    layer.update(frame, false);
    assert.equal(start.version, updated, "visibility does not rebuild geometry");
    assert.equal(mesh.visible, false);
    layer.update(frame, true);
    assert.equal(mesh.visible, true);
  } finally {
    scope.dispose();
  }
  assert.equal(scene.children.length, 0, "disposing releases the layer");
});

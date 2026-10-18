import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { rolldown } from "rolldown";
import { Group, PerspectiveCamera } from "three";

import shaderLoader from "@horizon/toolkit/shaders/loader";

import { createSolarActivityLifecycle } from "../src/features/orrery/lib/scene/solar-activity-lifecycle.ts";

const flush = () => new Promise((resolve) => setImmediate(resolve));

test("Off does not load or construct the effect, even while other scene frames continue", async () => {
  let loads = 0;
  const lifecycle = createSolarActivityLifecycle(
    async () => {
      loads++;
      throw new Error("must not load");
    },
    assert.fail,
    assert.fail,
  );
  lifecycle.setEnabled(false);
  for (let frame = 0; frame < 100; frame++) lifecycle.current?.update(1 / 30, false, false);
  await flush();
  assert.equal(loads, 0);
  assert.equal(lifecycle.current, null);
  lifecycle.setEnabled(true);
  lifecycle.setEnabled(false);
  await flush();
  assert.equal(loads, 0, "synchronous cancellation never even imports the chunk");
  lifecycle.dispose();
});

test("late loads cannot resurrect an effect after Off, re-enable, or navigation", async () => {
  const pending = [];
  let constructed = 0,
    disposed = 0,
    invalidated = 0;
  const errors = [];
  const factory = () => {
    constructed++;
    return {
      update() {},
      dispose() {
        disposed++;
      },
    };
  };
  const lifecycle = createSolarActivityLifecycle(
    () => new Promise((resolve, reject) => pending.push({ resolve, reject })),
    () => invalidated++,
    (error) => errors.push(error),
  );
  lifecycle.setEnabled(true);
  await flush();
  lifecycle.setEnabled(false);
  lifecycle.setEnabled(true);
  await flush();
  pending[0].resolve(factory);
  await flush();
  assert.equal(constructed, 0, "old request must not bake a texture or allocate geometry");
  pending[1].resolve(factory);
  await flush();
  assert.equal(constructed, 1);
  assert.equal(invalidated, 1, "ready effect wakes the otherwise sleeping renderer");
  assert.ok(lifecycle.current);
  lifecycle.setEnabled(false);
  assert.equal(lifecycle.current, null);
  assert.equal(disposed, 1, "Off disposes immediately");
  lifecycle.setEnabled(true);
  await flush();
  lifecycle.dispose();
  pending[2].resolve(factory);
  await flush();
  assert.equal(constructed, 1);
  lifecycle.dispose();
  lifecycle.setEnabled(true);
  assert.equal(disposed, 1);
  assert.equal(lifecycle.current, null);
  assert.deepEqual(errors, []);
});

test("active loading failures are reported, but disabled requests stay silent", async () => {
  const pending = [];
  const errors = [];
  const lifecycle = createSolarActivityLifecycle(
    () => new Promise((_, reject) => pending.push(reject)),
    assert.fail,
    (error) => errors.push(error),
  );
  lifecycle.setEnabled(true);
  await flush();
  lifecycle.setEnabled(false);
  pending[0](new Error("stale request"));
  await flush();
  assert.deepEqual(errors, []);
  lifecycle.setEnabled(true);
  await flush();
  const error = new Error("active request");
  pending[1](error);
  await flush();
  assert.deepEqual(errors, [error]);
  assert.equal(lifecycle.current, null);
  lifecycle.dispose();
});

// Import the real renderer factory in Node using the application's GLSL loader.
// No canvas, WebGL context, browser, or server is created by these resource tests.
async function rendererFactory() {
  const bundle = await rolldown({
    input: fileURLToPath(
      new URL("../src/features/orrery/lib/scene/solar-activity.ts", import.meta.url),
    ),
    platform: "node",
    plugins: [
      {
        name: "resource-test-imports",
        resolveId(id) {
          if (id === "three") return { id: import.meta.resolve("three"), external: true };
        },
        load(id) {
          if (!id.endsWith(".glsl")) return;
          return shaderLoader.call(
            { resourcePath: id, rootContext: process.cwd(), addDependency() {}, cacheable() {} },
            readFileSync(id, "utf8"),
          );
        },
      },
    ],
  });
  try {
    const { output } = await bundle.generate({ format: "esm" });
    const compiled = await import(
      `data:text/javascript;base64,${Buffer.from(output[0].code).toString("base64")}`
    );
    return compiled.createSolarActivity;
  } finally {
    await bundle.close();
  }
}

test("repeated On/Off detaches the actual scene node and disposes all three GPU resources", async () => {
  const createSolarActivity = await rendererFactory();
  const sun = new Group();
  const camera = new PerspectiveCamera();
  camera.position.set(0, 0, 3);
  const lifecycle = createSolarActivityLifecycle(
    async () => () => createSolarActivity({ camera, tight: true }, sun),
    () => {},
    assert.fail,
  );
  for (let cycle = 0; cycle < 3; cycle++) {
    lifecycle.setEnabled(true);
    await flush();
    assert.equal(sun.children.length, 1);
    const mesh = sun.children[0];
    const released = [];
    for (const [name, resource] of Object.entries({
      geometry: mesh.geometry,
      material: mesh.material,
      texture: mesh.material.uniforms.densityMap.value,
    }))
      resource.addEventListener("dispose", () => released.push(name));
    lifecycle.current.update(1 / 30, true, true);
    assert.equal(mesh.visible, true);
    const time = mesh.material.uniforms.activityTime.value;
    assert.ok(time > 0);
    lifecycle.setEnabled(false);
    assert.equal(sun.children.length, 0, "no hidden object remains in scene traversal");
    assert.deepEqual(released.sort(), ["geometry", "material", "texture"]);
    for (let frame = 0; frame < 100; frame++) lifecycle.current?.update(1 / 30, true, true);
    assert.equal(mesh.material.uniforms.activityTime.value, time, "Off never advances dynamics");
    lifecycle.setEnabled(false);
    assert.equal(released.length, 3, "each resource is disposed exactly once");
  }
  lifecycle.dispose();
});

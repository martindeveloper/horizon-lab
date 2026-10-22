import assert from "node:assert/strict";
import test from "node:test";

import { LinearSRGBColorSpace } from "three";

import { createCompositePass } from "../packages/toolkit/src/rendering/composite-pass.ts";
import { createOffscreenFrame } from "../packages/toolkit/src/rendering/offscreen-frame.ts";

test("composites retain scene depth by default and allow full-screen callers to omit it", () => {
  const renderer = { outputColorSpace: LinearSRGBColorSpace };
  for (const antialias of ["off", "fxaa", "msaa"]) {
    const scene = createCompositePass(renderer, { antialias });
    const image = createCompositePass(renderer, { antialias, depthBuffer: false });
    try {
      assert.equal(scene.target.depthBuffer, true);
      assert.equal(image.target.depthBuffer, false);
      assert.equal(image.target.samples, antialias === "msaa" ? 4 : 0);
    } finally {
      scene.dispose();
      image.dispose();
    }
  }
});

test("nested image filters preserve their destination, resize, restore on errors and release resources", () => {
  const destination = { name: "canvas" };
  let bound = destination;
  let width = 320;
  let height = 180;
  const draws = [];
  const renderer = {
    outputColorSpace: LinearSRGBColorSpace,
    getDrawingBufferSize: (size) => size.set(width, height),
    getRenderTarget: () => bound,
    setRenderTarget: (target) => {
      bound = target;
    },
    render: (scene) => draws.push({ destination: bound, mesh: scene.children[0] }),
  };
  const outer = createOffscreenFrame(renderer, { fragmentShader: "", depthBuffer: false });
  const inner = createOffscreenFrame(renderer, { fragmentShader: "" });
  try {
    const draw = () => {
      assert.equal(bound, inner.target, "the scene renders once into the inner frame");
    };
    outer.render(() => inner.render(draw));
    assert.equal(draws[0].destination, outer.target, "composite resolves into the final filter");
    assert.equal(draws[1].destination, destination, "final filter resolves onto the canvas");
    assert.equal(bound, destination);
    assert.equal(outer.target.depthBuffer, false);
    assert.equal(inner.target.depthBuffer, true);
    width = 640;
    height = 360;
    outer.render(() => inner.render(draw));
    for (const frame of [outer, inner]) {
      assert.equal(frame.target.width, width);
      assert.equal(frame.target.height, height);
    }
    const uniforms = draws.at(-1).mesh.material.uniforms;
    assert.deepEqual(uniforms.uTexel.value.toArray(), [1 / width, 1 / height]);
    assert.equal(uniforms.uImage.value, outer.target.texture);
    assert.throws(
      () =>
        outer.render(() =>
          inner.render(() => {
            throw new Error("draw failed");
          }),
        ),
      /draw failed/,
    );
    assert.equal(bound, destination, "an error cannot strand the next frame offscreen");

    let releases = 0;
    outer.target.addEventListener("dispose", () => releases++);
    draws.at(-1).mesh.material.addEventListener("dispose", () => releases++);
    draws.at(-1).mesh.geometry.addEventListener("dispose", () => releases++);
    outer.dispose();
    outer.dispose();
    assert.equal(releases, 3);
    const before = draws.length;
    outer.render(() => assert.fail("disposed filter must not draw"));
    assert.equal(draws.length, before);
  } finally {
    outer.dispose();
    inner.dispose();
  }
});

/**
 * Opt-in WebGL regression tests; these execute the production GLSL, not a CPU copy.
 * HORIZON_TEST_BROWSER=/path/to/chromium node --import tsx \
 *   --import ./tests/glsl-register.mjs --test tests/browser/giants-granulation.test.mjs
 * Without the environment variable, use the locally installed Chrome. No server is started.
 */
import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import { chromium } from "playwright-core";

import granulation from "../../src/space/sun/graphics/shaders/granulation.glsl";

let browser;
let page;
const SIZE = 512;

before(async () => {
  browser = await chromium.launch({
    headless: true,
    ...(process.env.HORIZON_TEST_BROWSER
      ? { executablePath: process.env.HORIZON_TEST_BROWSER }
      : { channel: "chrome" }),
  });
  page = await browser.newPage();
  await page.evaluate(
    ({ source, size }) => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = size;
      const gl = canvas.getContext("webgl2", { antialias: false, depth: false });
      if (!gl) throw new Error("WebGL 2 is required for the shader regression tests");
      const shader = (kind, text) => {
        const result = gl.createShader(kind);
        gl.shaderSource(result, text);
        gl.compileShader(result);
        if (!gl.getShaderParameter(result, gl.COMPILE_STATUS))
          throw new Error(gl.getShaderInfoLog(result));
        return result;
      };
      const vertex = shader(
        gl.VERTEX_SHADER,
        `#version 300 es
      void main() {
        vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
        gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
      }`,
      );
      const fragment = shader(
        gl.FRAGMENT_SHADER,
        `#version 300 es
      precision highp float;
      uniform float uTime;
      uniform float uFine;
      uniform float uSlice;
      out vec4 colour;
      ${source}
      void main() {
        vec3 p = vec3(gl_FragCoord.xy * (8.0 / ${size}.0) + vec2(3.17, 7.43), uSlice);
        vec3 field = granuleField(p, uTime, uFine);
        colour = vec4(0.5 + 0.5 * field.x, field.yz, 1.0);
      }`,
      );
      const program = gl.createProgram();
      gl.attachShader(program, vertex);
      gl.attachShader(program, fragment);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS))
        throw new Error(gl.getProgramInfoLog(program));
      gl.useProgram(program);
      gl.disable(gl.DITHER);
      gl.viewport(0, 0, size, size);
      const timeUniform = gl.getUniformLocation(program, "uTime");
      const fineUniform = gl.getUniformLocation(program, "uFine");
      const sliceUniform = gl.getUniformLocation(program, "uSlice");
      window.sampleGranules = (time, fine, slice) => {
        gl.uniform1f(timeUniform, time);
        gl.uniform1f(fineUniform, fine);
        gl.uniform1f(sliceUniform, slice);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        const pixels = new Uint8Array(size * size * 4);
        gl.readPixels(0, 0, size, size, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        if (gl.getError() !== gl.NO_ERROR) throw new Error("Granulation draw failed");
        return pixels;
      };
    },
    { source: granulation, size: SIZE },
  );
});

after(async () => {
  await browser?.close();
});

test("resolved granulation retains bright upflows and cool lanes without sharp tile borders", async () => {
  const results = await page.evaluate((size) => {
    return [0.3, 4.7, 20.8].map((slice, index) => {
      const pixels = window.sampleGranules(index * 19, 1, slice);
      let sum = 0,
        squared = 0,
        hot = 0,
        narrow = 0,
        peakStep = 0;
      for (let y = 0; y < size; y++)
        for (let x = 0; x < size; x++) {
          const at = (y * size + x) * 4;
          const temperature = pixels[at] / 127.5 - 1;
          sum += temperature;
          squared += temperature * temperature;
          hot += temperature > 0;
          narrow += pixels[at + 1] > 204;
          if (x > 0) peakStep = Math.max(peakStep, Math.abs(pixels[at] - pixels[at - 4]) / 127.5);
          if (y > 0)
            peakStep = Math.max(peakStep, Math.abs(pixels[at] - pixels[at - size * 4]) / 127.5);
        }
      const n = size * size,
        mean = sum / n;
      return {
        mean,
        deviation: Math.sqrt(squared / n - mean * mean),
        hot: hot / n,
        narrow: narrow / n,
        peakStep,
      };
    });
  }, SIZE);
  for (const result of results) {
    const context = JSON.stringify(result);
    assert.ok(result.deviation > 0.1 && result.deviation < 0.45, context);
    assert.ok(Math.abs(result.mean) < 0.3, context);
    assert.ok(result.hot > 0.35 && result.hot < 0.85, context);
    assert.ok(result.narrow > 0.01 && result.narrow < 0.45, context);
    // At 64 samples per cell, a hard lane network makes much larger one-pixel jumps.
    assert.ok(result.peakStep < 0.18, context);
  }
});

test("granulation evolves continuously without flashing and fine detail does not move the cells", async () => {
  const result = await page.evaluate(() => {
    const frame = window.sampleGranules(23, 1, 4.7);
    const next = window.sampleGranules(23 + 1 / 60, 1, 4.7);
    const later = window.sampleGranules(43, 1, 4.7);
    const coarse = window.sampleGranules(23, 0, 4.7);
    let nextPeak = 0,
      evolution = 0,
      detail = 0,
      movedLanes = 0;
    for (let at = 0; at < frame.length; at += 4) {
      nextPeak = Math.max(nextPeak, Math.abs(frame[at] - next[at]) / 127.5);
      evolution += Math.abs(frame[at] - later[at]) / 127.5;
      detail += Math.abs(frame[at] - coarse[at]) / 127.5;
      movedLanes += frame[at + 1] !== coarse[at + 1] || frame[at + 2] !== coarse[at + 2];
    }
    const n = frame.length / 4;
    return { nextPeak, evolution: evolution / n, detail: detail / n, movedLanes };
  });
  const context = JSON.stringify(result);
  assert.ok(result.nextPeak < 0.025, context);
  assert.ok(result.evolution > 0.025 && result.evolution < 0.4, context);
  assert.ok(result.detail > 0.005 && result.detail < 0.1, context);
  assert.equal(result.movedLanes, 0, context);
});

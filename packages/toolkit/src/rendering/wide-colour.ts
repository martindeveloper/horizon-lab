import { Matrix3, type WebGLRenderer } from "three";

import { xyzToLinearP3, xyzToLinearSrgb, type Gamut, type Xyz } from "../science/color";

/**
 * Wide colour for a WebGL canvas whose shader owns its display pipeline: the canvas's
 * drawing buffer is switched to Display P3, and the shader multiplies its linear radiance by
 * `gamutMatrix` before it tone-maps and encodes, so colours past sRGB reach the screen. A
 * scene of ordinary materials gains nothing from it (they encode sRGB), so only such shaders
 * use it. Switching costs nothing while sRGB: the matrix is the identity.
 *
 * three.js's own Display P3 output (`outputColorSpace` set to a P3 definition) is not used:
 * in r186 its encoder composes the primaries' matrices in the wrong order, so white renders
 * as (0.83, 1, 0.96) and pure red as (0.87, 0.52, 0.13).
 */

/** The gamut a renderer's canvas shows its bytes in. */
export function drawingBufferGamut(renderer: WebGLRenderer): Gamut {
  const gl = renderer.getContext();
  return "drawingBufferColorSpace" in gl && gl.drawingBufferColorSpace === "display-p3"
    ? "p3"
    : "srgb";
}

/**
 * Switches a renderer's canvas to show its bytes in `gamut`, and returns the gamut it took:
 * a browser whose WebGL cannot switch keeps sRGB, so draw for what comes back.
 */
export function setDrawingBufferGamut(renderer: WebGLRenderer, gamut: Gamut): Gamut {
  const gl = renderer.getContext();
  if ("drawingBufferColorSpace" in gl)
    gl.drawingBufferColorSpace = gamut === "p3" ? "display-p3" : "srgb";
  return drawingBufferGamut(renderer);
}

/** A 3 × 3 matrix whose columns are `map` of the unit vectors. */
function matrixOf(map: (xyz: Xyz) => readonly [number, number, number]) {
  const [a, b, c] = [map([1, 0, 0]), map([0, 1, 0]), map([0, 0, 1])];
  return new Matrix3().set(a[0], b[0], c[0], a[1], b[1], c[1], a[2], b[2], c[2]);
}

let srgbToP3: Matrix3 | null = null;

/**
 * Linear sRGB to the linear primaries of `gamut`: the identity for sRGB, so a shader may
 * apply it always; for Display P3 the conversion from the science module's colour matrices.
 * Writes `out` when given.
 */
export function gamutMatrix(gamut: Gamut, out = new Matrix3()): Matrix3 {
  if (gamut !== "p3") return out.identity();
  srgbToP3 ??= new Matrix3().multiplyMatrices(
    matrixOf(xyzToLinearP3),
    matrixOf(xyzToLinearSrgb).invert(),
  );
  return out.copy(srgbToP3);
}

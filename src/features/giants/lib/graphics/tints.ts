/**
 * Each disc's tints as the shader reads them (`giants.frag.glsl`): the light round a star in
 * its face's own colours (`TINT_SHARES`), each against the face by Planck's law, and the face's
 * own band, which every point of the face is measured against. They depend only on the body, so
 * they are worked out once per rung and copied into a disc's row of a small table when a body
 * takes that disc, rather than evaluated per pixel. The table is a texture, not uniforms: the
 * shader's uniforms are near the budget small GPUs give a fragment shader.
 */
import { DataTexture, FloatType, RGBAFormat } from "three";

import { hellandBlackbodyLinear, planckBand } from "@horizon/toolkit/science";

import type { Look } from "../model/looks";
import { FACE_KELVIN_SHARE, MAX_DISCS, PLANCK_KELVIN, TINTS, TINT_SHARES } from "../parameters";

/** RGBA a tint. */
const TEXEL = 4;

/** The temperature at the centre of a body's face, K (`FACE_KELVIN_SHARE`). */
const faceKelvin = (look: Pick<Look, "equatorK" | "poleK">) =>
  FACE_KELVIN_SHARE * 0.5 * (look.equatorK + look.poleK);

/**
 * A rung's tints, RGBA each in `TINTS` order: the light of a surface at that share of its face's
 * temperature, linear, against the face's (glowAt(k T, T) in the shader); alpha, 1 / the face's
 * band, so the shader's surface needs only its own point's band.
 */
function tintsOf(look: Pick<Look, "equatorK" | "poleK">): Float32Array {
  const face = faceKelvin(look);
  const faceBand = 1 / planckBand(face, PLANCK_KELVIN);
  const row = new Float32Array(TINTS.length * TEXEL);
  TINTS.forEach((tint, k) => {
    const kelvin = TINT_SHARES[tint] * face;
    const scale = planckBand(kelvin, PLANCK_KELVIN) * faceBand;
    hellandBlackbodyLinear(kelvin).forEach((channel, c) => (row[k * TEXEL + c] = channel * scale));
    row[k * TEXEL + 3] = faceBand;
  });
  return row;
}

/**
 * The discs' tints: `uniform` for the shader, and `assign` to give disc `slot` rung `rung`'s
 * tints, which uploads the table only when a disc changes hands.
 */
export function discTints(looks: readonly Look[]) {
  const rows = looks.map(tintsOf);
  const width = TINTS.length * TEXEL;
  const data = new Float32Array(width * MAX_DISCS);
  const texture = new DataTexture(data, TINTS.length, MAX_DISCS, RGBAFormat, FloatType);
  /** The rung each disc's row holds (−1: none yet). */
  const holder = new Int32Array(MAX_DISCS).fill(-1);
  function assign(slot: number, rung: number) {
    if (holder[slot] === rung) return;
    holder[slot] = rung;
    data.set(rows[rung]!, slot * width);
    texture.needsUpdate = true;
  }
  return { uniform: { value: texture }, assign, dispose: () => texture.dispose() };
}

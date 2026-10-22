/**
 * Each disc's tints as the shader reads them (`giants.frag.glsl`): the light round a star in
 * its face's own colours (`TINT_SHARES`), each against the face by Planck's law, and the face's
 * own visible radiance, which every point of the face is measured against. They depend only on the body, so
 * they are worked out once per rung and copied into a disc's row of a small table when a body
 * takes that disc, rather than evaluated per pixel. The table is a texture, not uniforms: the
 * shader's uniforms are near the budget small GPUs give a fragment shader.
 */
import { DataTexture, FloatType, RGBAFormat } from "three";

import { stellarContinuum } from "../model/atmosphere";
import type { Look } from "../model/looks";
import { MAX_DISCS, TINTS, TINT_SHARES } from "../parameters";

/** RGBA a tint. */
const TEXEL = 4;

/** Per-star exposure reference, K; this is not the temperature of a hotter optical layer. */
const faceKelvin = (look: Pick<Look, "equatorK" | "poleK">) => 0.5 * (look.equatorK + look.poleK);

/**
 * A rung's tints, RGBA each in `TINTS` order: the light of a surface at that share of its face's
 * temperature, linear, against the face's CIE-integrated visible light; alpha is log Y of
 * the reference continuum, matching the spectrum table used by the surface shader.
 */
function tintsOf(look: Pick<Look, "equatorK" | "poleK">): Float32Array {
  const face = faceKelvin(look);
  const faceBand = stellarContinuum(face)[3];
  const row = new Float32Array(TINTS.length * TEXEL);
  TINTS.forEach((tint, k) => {
    const kelvin = TINT_SHARES[tint] * face;
    const colour = stellarContinuum(kelvin);
    const scale = Math.exp(colour[3] - faceBand);
    colour.slice(0, 3).forEach((channel, c) => (row[k * TEXEL + c] = channel * scale));
    row[k * TEXEL + 3] = faceBand;
  });
  return row;
}

/**
 * The discs' tints: `uniform` for the shader, and `assign` to give disc `slot` rung `rung`'s
 * tints, which uploads the table only when a disc changes hands; `face` a rung's face tint.
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
  /** A rung's face, linear light against its own visible radiance: what the overview's dot shows. */
  const face = (rung: number): [number, number, number] => {
    const row = rows[rung]!;
    return [row[0]!, row[1]!, row[2]!];
  };
  return { uniform: { value: texture }, assign, face, dispose: () => texture.dispose() };
}

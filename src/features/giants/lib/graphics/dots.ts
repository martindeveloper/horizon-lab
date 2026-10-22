/**
 * The overview's dots as the shader reads them (`giants.frag.glsl`): a column per rung, its
 * place on the stage in the first row (centre x, y; equatorial and polar radius, CSS px) and its
 * light in the second (linear; surface style). Every body shows at once, more than the discs'
 * uniforms hold, and those are near the budget small GPUs give a fragment shader: so a small
 * texture, its colours written once and its places as they move.
 */
import { DataTexture, FloatType, RGBAFormat, type Vector3 } from "three";

import type { Placed } from "../model/ladder";
import type { Look } from "../model/looks";
import { BROWN_DWARF_ALKALI, STYLES } from "../parameters";

/** RGBA a dot's texel. */
const TEXEL = 4;

/**
 * A rung's dot colour: a star's face (`face`, through a brown dwarf's alkali lines), a planet's
 * map's mean colour, a horizon's black (the shader rims it in gold).
 */
function colourOf(
  look: Look,
  face: readonly [number, number, number],
  means: { earth: Vector3; jupiter: Vector3 },
): readonly number[] {
  if (look.style === "earth") return means.earth.toArray();
  if (look.style === "jupiter") return means.jupiter.toArray();
  if (look.style === "horizon") return [0, 0, 0];
  if (look.style === "brownDwarf") return face.map((c, k) => c * BROWN_DWARF_ALKALI[k]!);
  return face;
}

export function overviewDots(
  looks: readonly Look[],
  face: (rung: number) => readonly [number, number, number],
  means: { earth: Vector3; jupiter: Vector3 },
) {
  const count = looks.length;
  const data = new Float32Array(count * TEXEL * 2);
  looks.forEach((look, rung) =>
    data.set(
      [...colourOf(look, face(rung), means), STYLES.indexOf(look.style)],
      (count + rung) * TEXEL,
    ),
  );
  const texture = new DataTexture(data, count, 2, RGBAFormat, FloatType);
  texture.needsUpdate = true;
  /** A body's dot where `body` places it. */
  function place(body: Placed) {
    data.set([body.x, body.y, body.radius, body.polar], body.index * TEXEL);
    texture.needsUpdate = true;
  }
  return { uniform: { value: texture }, place, dispose: () => texture.dispose() };
}

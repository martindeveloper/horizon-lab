/**
 * The sky's star points as every host draws them: one soft, additively blended disc per
 * star, sized by magnitude at the device's pixel ratio, with `fade` (presence) and `tint`
 * (extinction) uniforms a host sets. The Milky Way's grains use the same material.
 */
import { AdditiveBlending, Color, ShaderMaterial } from "three";

import STAR_FRAG from "./shaders/star.frag.glsl";
import STAR_VERT from "./shaders/star.vert.glsl";

export function starMaterial(dpr: { value: number }) {
  return new ShaderMaterial({
    uniforms: {
      dpr,
      fade: { value: 1 },
      tint: { value: new Color("#ffffff") },
    },
    vertexShader: STAR_VERT,
    fragmentShader: STAR_FRAG,
    vertexColors: true,
    transparent: false,
    depthWrite: false,
    depthTest: false,
    blending: AdditiveBlending,
    toneMapped: false,
  });
}

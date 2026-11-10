/**
 * Lightning's layer over Earth (lightning.frag.glsl): light added under the air shell, on the
 * globe's own sphere at the cloud tops. Only the near side draws and nothing is tested against
 * depth, so it cannot fight the surface a few kilometres under it. The engine writes the Sun's
 * direction, the time and the rate, and hides the layer whenever there is nothing to flash.
 */
import { AdditiveBlending, FrontSide, ShaderMaterial, Vector3 } from "three";

import LIGHTNING_FRAG from "./shaders/lightning.frag.glsl";
import LIGHTNING_VERT from "./shaders/lightning.vert.glsl";

export function lightningMaterial() {
  return new ShaderMaterial({
    uniforms: {
      uSun: { value: new Vector3(0, 0, 1) },
      uTime: { value: 0 },
      uDensity: { value: 0 },
      uShown: { value: 0 },
    },
    vertexShader: LIGHTNING_VERT,
    fragmentShader: LIGHTNING_FRAG,
    side: FrontSide,
    transparent: true,
    blending: AdditiveBlending,
    depthTest: false,
    depthWrite: false,
  });
}

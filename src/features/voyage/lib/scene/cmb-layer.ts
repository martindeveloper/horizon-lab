/**
 * The microwave background's shell, centred on the ship: whoever looks sees it 45 billion
 * light-years out in every direction, so flying toward it never brings it nearer. Centred on
 * the ship it shows no parallax, so it is drawn at today's radius, inside the far plane, and
 * only its temperature follows the expansion. At rest it is invisible (2.7 K); a ship fast
 * enough that the Doppler factor ahead lifts that past red heat sees the sky glow
 * (cmb.frag.glsl).
 */
import {
  AdditiveBlending,
  BackSide,
  Mesh,
  ShaderMaterial,
  SphereGeometry,
  type DataTexture,
  type Object3D,
} from "three";

import { CMB_LY } from "@/space/cosmos/model/cosmos";
import { LIGHT_YEAR_KM } from "@horizon/toolkit/science";

import { lutSpecUniform, type MotionUniforms } from "../graphics/looks";
import CMB_FRAG from "../graphics/shaders/cmb.frag.glsl";
import CMB_VERT from "../graphics/shaders/cmb.vert.glsl";
import { cmbKelvin } from "../model/comoving";
import type { ShipMotion } from "../model/ship";
import type { VoyageKit } from "./kit";

/** The background's temperature at which its glow reads at full brightness, kelvin. */
const VISIBLE_K = 1000;

export function createCmbLayer(
  { scope }: VoyageKit,
  parent: Object3D,
  lut: DataTexture,
  motion: MotionUniforms,
) {
  const kelvin = { value: cmbKelvin(1) };
  const material = scope.own(
    new ShaderMaterial({
      uniforms: {
        forward: { value: motion.forward },
        beta: motion.beta,
        gamma: motion.gamma,
        kelvin,
        bbLut: { value: lut },
        bbLutSpec: lutSpecUniform(),
        visibleK: { value: VISIBLE_K },
      },
      vertexShader: CMB_VERT,
      fragmentShader: CMB_FRAG,
      side: BackSide,
      depthTest: false,
      depthWrite: false,
      blending: AdditiveBlending,
      toneMapped: false,
    }),
  );
  const shell = new Mesh(scope.own(new SphereGeometry(1, 48, 24)), material);
  /* Light added behind the band and the stars. */
  shell.renderOrder = -5;
  shell.frustumCulled = false;
  shell.visible = false;
  shell.scale.setScalar(CMB_LY * LIGHT_YEAR_KM);
  parent.add(shell);

  return {
    /** The background's temperature at the ship's instant, kelvin. */
    get kelvin() {
      return kelvin.value;
    },
    /** The shell with the universe at scale `a`, for the ship's motion. */
    update(a: number, motion: ShipMotion) {
      kelvin.value = cmbKelvin(a);
      /* Nothing to see until the factor ahead, γ(1 + β), lifts the background toward red heat. */
      const ahead = kelvin.value * motion.gamma * (1 + motion.beta);
      shell.visible = ahead > VISIBLE_K * 0.25;
    },
  };
}

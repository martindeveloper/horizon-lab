/**
 * The microwave background's shell, centred on the ship: whoever looks sees it 45 billion
 * light-years out in every direction, so flying toward it never brings it nearer. At rest it
 * is invisible (2.7 K); a ship fast enough that the Doppler factor ahead lifts that past red
 * heat sees the sky glow (cmb.frag.glsl). The shell's temperature falls as the universe
 * expands with the clocks.
 */
import {
  AdditiveBlending,
  BackSide,
  Mesh,
  ShaderMaterial,
  SphereGeometry,
  Vector2,
  Vector3,
  type DataTexture,
  type Object3D,
} from "three";

import { LIGHT_YEAR_KM } from "@horizon/toolkit/science";

import { LUT_RANGE_K } from "../graphics/looks";
import CMB_FRAG from "../graphics/shaders/cmb.frag.glsl";
import CMB_VERT from "../graphics/shaders/cmb.vert.glsl";
import { CMB_LY, cmbKelvinAt } from "../model/comoving";
import type { ShipMotion } from "../model/ship";
import type { VoyageKit } from "./kit";

/** The background's temperature at which its glow reads at full brightness, kelvin. */
const VISIBLE_K = 1000;

export function createCmbLayer({ scope }: VoyageKit, parent: Object3D, lut: DataTexture) {
  const forward = new Vector3(0, 0, -1);
  const beta = { value: 0 };
  const gamma = { value: 1 };
  const kelvin = { value: cmbKelvinAt(0) };
  const material = scope.own(
    new ShaderMaterial({
      uniforms: {
        forward: { value: forward },
        beta,
        gamma,
        kelvin,
        bbLut: { value: lut },
        lutRange: { value: new Vector2(LUT_RANGE_K[0], LUT_RANGE_K[1]) },
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
  parent.add(shell);

  return {
    /** The background's temperature at the ship's instant, kelvin. */
    get kelvin() {
      return kelvin.value;
    },
    /** The shell at Earth's time `t` (seconds since today) and the universe's scale `a` then. */
    update(t: number, a: number, motion: ShipMotion) {
      kelvin.value = cmbKelvinAt(t);
      shell.scale.setScalar(CMB_LY * LIGHT_YEAR_KM * a);
      /* Nothing to see until the factor ahead, γ(1 + β), lifts the background toward red heat. */
      const ahead = kelvin.value * motion.gamma * (1 + motion.beta);
      shell.visible = ahead > VISIBLE_K * 0.25;
      if (!shell.visible) return;
      forward.fromArray(motion.forward);
      beta.value = motion.beta;
      gamma.value = motion.gamma;
    },
  };
}

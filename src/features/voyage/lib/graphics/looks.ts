/**
 * Voyage's own materials: the star sky's points, with the blackbody lookup their colours come
 * from. The bodies' materials are the shared solar looks; the Milky Way is the shared band.
 */
import {
  AdditiveBlending,
  Color,
  DataTexture,
  LinearFilter,
  ShaderMaterial,
  SRGBColorSpace,
  Vector2,
  Vector3,
} from "three";

import { blackbodyLut } from "@horizon/toolkit/science";

import type { ShipMotion } from "../model/ship";
import ORBIT_FRAG from "./shaders/orbit.frag.glsl";
import ORBIT_VERT from "./shaders/orbit.vert.glsl";
import STAR_FRAG from "./shaders/star.frag.glsl";
import STAR_VERT from "./shaders/star.vert.glsl";

/** The lookup's temperature range, kelvin: a red dwarf to a star blue-shifted a hundredfold. */
export const LUT_RANGE_K = [1_000, 1_000_000] as const;
const LUT_SIZE = 256;

/** Blackbody colours, log-spaced over `LUT_RANGE_K`, as a one-row texture. */
export function blackbodyTexture() {
  const texture = new DataTexture(
    blackbodyLut(LUT_SIZE, LUT_RANGE_K[0], LUT_RANGE_K[1]),
    LUT_SIZE,
    1,
  );
  texture.colorSpace = SRGBColorSpace;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

/**
 * The most the Doppler factor's D² may brighten a point: a star's point may go far (it is a
 * point), the painted band's soft grains and haze much less, or the sky ahead is a white sheet.
 */
const STAR_PEAK = 16;
export const PAINTED_PEAK = 4;

/** The ship's motion as the shaders read it: one set the engine writes each frame, every material shares. */
export type MotionUniforms = {
  /** The direction of travel, unit. */
  forward: Vector3;
  beta: { value: number };
  gamma: { value: number };
};

export const motionUniforms = (): MotionUniforms => ({
  forward: new Vector3(0, 0, -1),
  beta: { value: 0 },
  gamma: { value: 1 },
});

/** Writes the ship's motion into the shared uniforms. */
export function writeMotion(out: MotionUniforms, motion: ShipMotion) {
  out.forward.fromArray(motion.forward);
  out.beta.value = motion.beta;
  out.gamma.value = motion.gamma;
}

/**
 * An orbit line as the ship sees it: aberrated per vertex with the shared motion, in one
 * colour at an opacity, behind the globes. Each line has its own; the motion is shared.
 */
export function orbitMaterial(motion: MotionUniforms, color: number, opacity: number) {
  return new ShaderMaterial({
    uniforms: {
      color: { value: new Color(color) },
      opacity: { value: opacity },
      forward: { value: motion.forward },
      beta: motion.beta,
      gamma: motion.gamma,
    },
    vertexShader: ORBIT_VERT,
    fragmentShader: ORBIT_FRAG,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  });
}

/**
 * The sky's points: the catalogue's stars, and the painted band's grains and field drawn the
 * same way. `fade` and `tint` are the band's presence and extinction (`createMilkyWay`).
 */
export function starMaterial(
  dpr: { value: number },
  lut: DataTexture,
  motion: MotionUniforms,
  /** The ship from the Sun, parsecs. */
  shipPc: Vector3,
) {
  return new ShaderMaterial({
    uniforms: {
      dpr,
      fade: { value: 1 },
      tint: { value: new Color("#ffffff") },
      peak: { value: STAR_PEAK },
      shipPc: { value: shipPc },
      forward: { value: motion.forward },
      beta: motion.beta,
      gamma: motion.gamma,
      bbLut: { value: lut },
      lutRange: { value: new Vector2(LUT_RANGE_K[0], LUT_RANGE_K[1]) },
      radius: { value: 1 },
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

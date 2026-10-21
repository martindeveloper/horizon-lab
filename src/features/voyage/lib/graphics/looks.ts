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
  Vector3,
} from "three";

import { blackbodyLut } from "@horizon/toolkit/science";

import type { ShipMotion } from "../model/ship";
import ORBIT_FRAG from "./shaders/orbit.frag.glsl";
import ORBIT_VERT from "./shaders/orbit.vert.glsl";
import STAR_FRAG from "./shaders/star.frag.glsl";
import STAR_VERT from "./shaders/star.vert.glsl";

/**
 * The black-body lookup: its temperature range, kelvin (a red dwarf to a star blue-shifted a
 * hundredfold), and its width in texels, as the shaders' `bbLutSpec` reads it.
 */
export const LUT_SPEC = [1_000, 1_000_000, 256] as const;

/** The shaders' `bbLutSpec` uniform. */
export const lutSpecUniform = () => ({ value: new Vector3(...LUT_SPEC) });

/** Blackbody colours, log-spaced over `LUT_SPEC`'s range, as a one-row texture. */
export function blackbodyTexture() {
  const [minK, maxK, size] = LUT_SPEC;
  const texture = new DataTexture(blackbodyLut(size, minK, maxK), size, 1);
  texture.colorSpace = SRGBColorSpace;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

/**
 * The most beaming may brighten the sky, approached softly (beamingSeen): a star's point by
 * its D² may go far (it is a point); a surface, the band's glow and the painted points that
 * stand for it, by its D⁴ much less, or the sky ahead is a white sheet.
 */
const STAR_PEAK = 16;
export const SURFACE_PEAK = 3;

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
 * same way. `fade` and `tint` are the band's presence and extinction (`createMilkyWay`); a
 * star's `handover` attribute marks it as drawn by another layer once `handedOver` rises.
 */
export function starMaterial(
  dpr: { value: number },
  lut: DataTexture,
  motion: MotionUniforms,
  /** The ship from the Sun, parsecs. */
  shipPc: Vector3,
  /** The points stand for a surface (the painted band and field), not for stars. */
  surface = false,
) {
  return new ShaderMaterial({
    defines: surface ? { SURFACE: "" } : {},
    uniforms: {
      dpr,
      fade: { value: 1 },
      tint: { value: new Color("#ffffff") },
      peak: { value: surface ? SURFACE_PEAK : STAR_PEAK },
      shipPc: { value: shipPc },
      forward: { value: motion.forward },
      beta: motion.beta,
      gamma: motion.gamma,
      bbLut: { value: lut },
      bbLutSpec: lutSpecUniform(),
      radius: { value: 1 },
      handedOver: { value: 0 },
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

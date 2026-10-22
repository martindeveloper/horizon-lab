import { Matrix3, Matrix4, Mesh, PlaneGeometry, ShaderMaterial, Vector3 } from "three";

import type { DisposalScope } from "@horizon/toolkit/rendering";

import { DARK_HALO, HALO_DRAW_RADIUS_KPC } from "../model/dark-halo";
import fragmentShader from "./shaders/dark-halo.frag.glsl";
import vertexShader from "./shaders/dark-halo.vert.glsl";

/**
 * False-colour projected NFW density, integrated through a spherical volume.
 * Opacity is deliberately compressed for legibility; not emitted light, optical
 * depth or particles. Core softening and outer fade are rendering choices only.
 * The underlying analytical profile and catalogued figures are unsoftened.
 */
export function darkHaloMaterial() {
  return new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    // This is a projected annotation. A proxy surface must not compete with scene depth.
    depthTest: false,
    opacity: 0.2,
    toneMapped: false,
    uniforms: {
      opacity: { value: 0 },
      cameraLocal: { value: new Vector3() },
      inverseProjection: { value: new Matrix4() },
      viewToHalo: { value: new Matrix3() },
      scaleRatio: { value: HALO_DRAW_RADIUS_KPC / DARK_HALO.rs },
    },
    vertexShader,
    fragmentShader,
  });
}

/**
 * Trace the volume analytically from a screen quad. The old enclosing sphere put
 * its triangles in the depth/clipping pipeline, which could leave polygonal holes
 * when enabled from inside it. The quad has no physical surface or depth.
 * Refresh the ray frame at draw time, after the host fits this pass's camera planes;
 * toggling the overlay must not require a camera movement to initialize it.
 */
export function darkHaloProjection(scope: DisposalScope, material: ShaderMaterial) {
  const halo = new Mesh(scope.own(new PlaneGeometry(2, 2)), material);
  halo.frustumCulled = false;
  // Put the density tint beneath the transparent stars, glows and annotations.
  halo.renderOrder = -1;
  const viewToLocal = new Matrix4();
  const rotation = new Matrix4();
  halo.onBeforeRender = (_renderer, _scene, camera) => {
    viewToLocal.copy(halo.matrixWorld).invert().multiply(camera.matrixWorld);
    material.uniforms.cameraLocal!.value.setFromMatrixPosition(viewToLocal);
    material.uniforms.viewToHalo!.value.setFromMatrix4(rotation.extractRotation(viewToLocal));
    material.uniforms.inverseProjection!.value.copy(camera.projectionMatrixInverse);
  };
  return halo;
}

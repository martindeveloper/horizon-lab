import assert from "node:assert/strict";
import test from "node:test";

import { Group, Matrix4, PerspectiveCamera, Raycaster, Scene, Vector3, Vector4 } from "three";

import { DisposalScope } from "@horizon/toolkit/rendering";
import { LIGHT_YEAR_AU as LY } from "@horizon/toolkit/science";

import { darkHaloMaterial, darkHaloProjection } from "../src/space/galaxy/graphics/dark-halo.ts";
import { close } from "./toolkit-helpers.mjs";

test("halo rays initialize on first draw and follow the active pass without moving the camera", () => {
  const scope = new DisposalScope();
  const material = scope.own(darkHaloMaterial());
  const halo = darkHaloProjection(scope, material);
  const scene = new Scene();
  const parent = new Group();
  parent.rotation.set(0.3, -0.7, 0.2);
  parent.position.set(2e9, -3e9, 5e9);
  parent.scale.setScalar(LY);
  halo.scale.setScalar(1.5e6);
  parent.add(halo);
  scene.add(parent);
  const camera = new PerspectiveCamera(48, 1, 1, 1e12);
  scene.add(camera);
  scene.updateMatrixWorld(true);
  const inverse = new Matrix4().copy(halo.matrixWorld).invert();
  const raycaster = new Raycaster();
  try {
    assert.equal(material.depthTest, false, "the density annotation cannot acquire depth holes");
    assert.equal(material.depthWrite, false, "the annotation cannot occlude scene objects");
    for (const eye of [new Vector3(0.05, 0.02, 0.08), new Vector3(0.4, -0.2, 1.6)]) {
      camera.position.copy(halo.localToWorld(eye.clone()));
      camera.lookAt(halo.getWorldPosition(new Vector3()));
      camera.updateMatrixWorld(true);
      // The second draw changes only the projection, as a resized/reconfigured pass does.
      for (const [aspect, near, far] of [
        [1.8, 1e4, 1e12],
        [0.7, 1e7, 1e16],
      ]) {
        halo.visible = false;
        material.uniforms.cameraLocal.value.set(99, 99, 99);
        camera.aspect = aspect;
        camera.near = near;
        camera.far = far;
        camera.updateProjectionMatrix();
        halo.visible = true;
        halo.onBeforeRender(null, scene, camera, halo.geometry, material, null);
        close(material.uniforms.cameraLocal.value.distanceTo(eye), 0);
        for (const [x, y] of [
          [0, 0],
          [-1, -1],
          [1, 1],
          [0.8, -0.4],
        ]) {
          const view = new Vector4(x, y, 0, 1).applyMatrix4(
            material.uniforms.inverseProjection.value,
          );
          const actual = new Vector3(view.x, view.y, view.z)
            .applyMatrix3(material.uniforms.viewToHalo.value)
            .normalize();
          raycaster.setFromCamera({ x, y }, camera);
          const expected = raycaster.ray.direction.clone().transformDirection(inverse);
          close(actual.distanceTo(expected), 0, 1e-9);
        }
      }
    }
  } finally {
    scope.dispose();
  }
});

import {
  Data3DTexture,
  LinearFilter,
  Mesh,
  RedFormat,
  ShaderMaterial,
  Vector3,
  type Object3D,
} from "three";

import type { SolarKit } from "@/space/solar-system/scene/kit";
import { DisposalScope } from "@horizon/toolkit/rendering";

import FRAG from "../graphics/shaders/solar-activity.frag.glsl";
import VERT from "../graphics/shaders/solar-activity.vert.glsl";
import { SUN_ACTIVITY_MAX_STEPS } from "../model/solar-activity";
import { createSolarActivityDensity } from "../model/solar-activity-density";
import { createSolarActivityDynamics } from "../model/solar-activity-dynamics";
import { createSolarActivityGeometry } from "./solar-activity-geometry";
import type { SolarActivity } from "./solar-activity-lifecycle";

/** Loaded only on enable. Its private scope releases every resource on Off, not just on navigation. */
export function createSolarActivity(
  { camera, tight }: Pick<SolarKit, "camera" | "tight">,
  sun: Object3D,
  /** Ray-march steps through the prominences (`OrreryQuality.activity`). */
  steps: number,
): SolarActivity {
  const scope = new DisposalScope();
  try {
    const dynamics = createSolarActivityDynamics();
    const { data, width, height, depth } = createSolarActivityDensity(tight);
    const texture = scope.own(new Data3DTexture(data, width, height, depth));
    texture.format = RedFormat;
    texture.minFilter = texture.magFilter = LinearFilter;
    texture.needsUpdate = true;
    const uniforms = {
      activityTime: { value: 0 },
      activityMotion: { value: dynamics.values },
      localCamera: { value: new Vector3() },
      activitySteps: { value: Math.min(steps, SUN_ACTIVITY_MAX_STEPS) },
      densityMap: { value: texture },
    };
    const material = scope.own(
      new ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        uniforms,
        transparent: true,
        depthTest: true,
        depthWrite: false,
      }),
    );
    const mesh = new Mesh(scope.own(createSolarActivityGeometry()), material);
    mesh.name = "Illustrative solar prominences";
    mesh.visible = false;
    // Loading can finish after close-up's layer traversal has already run.
    mesh.layers.set(1);
    sun.add(mesh);
    scope.defer(() => mesh.removeFromParent());
    return {
      update(dt, visible, animate) {
        mesh.visible = visible;
        if (!visible) return;
        dynamics.advance(dt, animate);
        uniforms.activityTime.value = dynamics.time;
        sun.worldToLocal(uniforms.localCamera.value.copy(camera.position));
      },
      setSteps(next) {
        uniforms.activitySteps.value = Math.min(next, SUN_ACTIVITY_MAX_STEPS);
      },
      dispose: () => scope.dispose(),
    };
  } catch (error) {
    scope.dispose();
    throw error;
  }
}

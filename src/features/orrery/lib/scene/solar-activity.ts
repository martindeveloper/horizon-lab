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
import { workerTask } from "@horizon/toolkit/worker";

import FRAG from "../graphics/shaders/solar-activity.frag.glsl";
import VERT from "../graphics/shaders/solar-activity.vert.glsl";
import { SUN_ACTIVITY_MAX_STEPS } from "../model/solar-activity";
import { createSolarActivityDensity, type DensityVolume } from "../model/solar-activity-density";
import { createSolarActivityDynamics } from "../model/solar-activity-dynamics";
import { createSolarActivityGeometry } from "./solar-activity-geometry";
import type { SolarActivity } from "./solar-activity-lifecycle";

/** The volume is baked on a worker (`solar-activity-density.worker.ts`); without one, in place. */
const baker = workerTask<boolean, DensityVolume>(
  () =>
    new Worker(new URL("../model/solar-activity-density.worker.ts", import.meta.url), {
      type: "module",
    }),
  createSolarActivityDensity,
);

/**
 * Baked volumes by `tight`, kept: switching the activity on again attaches at once. A failed
 * bake is not kept, so the next switch on tries again.
 */
const baked = new Map<boolean, Promise<DensityVolume>>();

/**
 * The prominence's density volume for a device class, baked off the main thread once. A bake
 * that fails rejects, for the lifecycle to report.
 */
export function solarActivityDensity(tight: boolean) {
  let volume = baked.get(tight);
  if (!volume) {
    const baking = new Promise<DensityVolume>((resolve, reject) =>
      baker.run(tight, resolve, reject),
    );
    baking.catch(() => {
      if (baked.get(tight) === baking) baked.delete(tight);
    });
    baked.set(tight, baking);
    volume = baking;
  }
  return volume;
}

/** Loaded only on enable. Its private scope releases every resource on Off, not just on navigation. */
export function createSolarActivity(
  { camera }: Pick<SolarKit, "camera">,
  sun: Object3D,
  /** Ray-march steps through the prominences (`OrreryQuality.activity`). */
  steps: number,
  /** The baked volume for the kit's device class (`solarActivityDensity`). */
  { data, width, height, depth }: DensityVolume,
): SolarActivity {
  const scope = new DisposalScope();
  try {
    const dynamics = createSolarActivityDynamics();
    const texture = scope.own(new Data3DTexture(data, width, height, depth));
    texture.format = RedFormat;
    texture.minFilter = texture.magFilter = LinearFilter;
    texture.needsUpdate = true;
    const uniforms = {
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

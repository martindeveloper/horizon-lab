import { Mesh, ShaderMaterial, Vector3, type Object3D } from "three";

import type { SolarKit } from "@/space/solar-system/scene/kit";
import type { DensityVolume } from "@/space/sun/graphics/prominence/density";
import { createProminenceGeometry } from "@/space/sun/graphics/prominence/geometry";
import FRAG from "@/space/sun/graphics/prominence/prominence.frag.glsl";
import VERT from "@/space/sun/graphics/prominence/prominence.vert.glsl";
import { prominenceDensity, prominenceTexture } from "@/space/sun/graphics/prominence/volume";
import { DisposalScope } from "@horizon/toolkit/rendering";

import { PROMINENCE_REGIONS, SUN_ACTIVITY_MAX_STEPS } from "../model/solar-activity";
import { createSolarActivityDynamics } from "../model/solar-activity-dynamics";
import type { SolarActivity } from "./solar-activity-lifecycle";

/** The shared hedgerow volume for a device class, baked off the main thread once and kept. */
export const solarActivityDensity = prominenceDensity;

/** The authored regions as the shared geometry places them. */
export const solarActivityBounds = () =>
  PROMINENCE_REGIONS.map(([lat, lon, tilt, height, span, phase]) => ({
    lat,
    lon,
    tilt,
    height,
    halfLength: span * 0.5,
    seed: phase,
  }));

/** Loaded only on enable. Its private scope releases every resource on Off, not just on navigation. */
export function createSolarActivity(
  { camera }: Pick<SolarKit, "camera">,
  sun: Object3D,
  /** Ray-march steps through the prominences (`OrreryQuality.activity`). */
  steps: number,
  /** The baked volume for the kit's device class (`solarActivityDensity`). */
  volume: DensityVolume,
): SolarActivity {
  const scope = new DisposalScope();
  try {
    const dynamics = createSolarActivityDynamics();
    const texture = scope.own(prominenceTexture(volume));
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
    const mesh = new Mesh(scope.own(createProminenceGeometry(solarActivityBounds())), material);
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

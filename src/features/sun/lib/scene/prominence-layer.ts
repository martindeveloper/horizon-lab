/**
 * The frame's prominences as the shared hedgerow volume: one bound per prominence, placed
 * where the frame says, lifted, thinned and drained as it says. The volume is baked off the
 * main thread once (`prominenceDensity`); until it arrives nothing is drawn.
 */
import { Mesh, ShaderMaterial, Vector3, type Camera, type Object3D } from "three";

import {
  createProminenceGeometry,
  type ProminenceBound,
} from "@/space/sun/graphics/prominence/geometry";
import {
  SUN_ACTIVITY_DRAIN_RADII_PER_S,
  SUN_ACTIVITY_ERUPTION_DRAIN,
  SUN_ACTIVITY_FLOW_WRAP,
  SUN_ACTIVITY_MAX_REGIONS,
  SUN_ACTIVITY_MAX_STEPS,
} from "@/space/sun/graphics/prominence/parameters";
import FRAG from "@/space/sun/graphics/prominence/prominence.frag.glsl";
import VERT from "@/space/sun/graphics/prominence/prominence.vert.glsl";
import { prominenceDensity, prominenceTexture } from "@/space/sun/graphics/prominence/volume";
import type { DisposalScope } from "@horizon/toolkit/rendering";

import type { SunQuality } from "../quality";
import type { SunFrame } from "./frame";

/** Model seconds a frame may advance the drain by at most: a jump of the clock is not a flow. */
const MAX_DRAIN_STEP_S = 600;

export function createProminenceLayer(
  scope: DisposalScope,
  scene: Object3D,
  options: { tight: boolean; invalidate: () => void; onError: (error: unknown) => void },
) {
  const motion = new Float32Array(SUN_ACTIVITY_MAX_REGIONS * 4);
  const uniforms = {
    activityMotion: { value: motion },
    localCamera: { value: new Vector3() },
    activitySteps: { value: 40 },
    densityMap: { value: null as ReturnType<typeof prominenceTexture> | null },
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
  let mesh: Mesh | null = null;
  let key = "";
  let ready = false;
  let alive = true;
  scope.defer(() => {
    alive = false;
    mesh?.geometry.dispose();
    mesh?.removeFromParent();
  });
  prominenceDensity(options.tight)
    .then((volume) => {
      if (!alive) return;
      uniforms.densityMap.value = scope.own(prominenceTexture(volume));
      ready = true;
      options.invalidate();
    })
    .catch(options.onError);
  const bounds: ProminenceBound[] = [];
  let lastTime: number | null = null;
  let drained = 0;
  return {
    /** The bounds' anchors, for picking and names. */
    get bounds(): readonly ProminenceBound[] {
      return bounds;
    },
    setQuality(quality: SunQuality) {
      uniforms.activitySteps.value = Math.min(quality.prominenceSteps, SUN_ACTIVITY_MAX_STEPS);
    },
    update(frame: SunFrame, camera: Camera, lit: number) {
      const shown = frame.prominences.slice(0, SUN_ACTIVITY_MAX_REGIONS);
      const next = shown
        .map((p) => [p.lat, p.lon, p.tilt, p.length, p.height].map((v) => v.toFixed(4)).join(","))
        .join(";");
      if (next !== key) {
        key = next;
        bounds.length = 0;
        shown.forEach((p, i) =>
          bounds.push({
            lat: p.lat,
            lon: p.lon,
            tilt: p.tilt,
            height: p.height,
            halfLength: p.length / 2,
            seed: (i + 1) * 0.173,
          }),
        );
        mesh?.geometry.dispose();
        mesh?.removeFromParent();
        mesh = null;
        if (bounds.length > 0) {
          mesh = new Mesh(createProminenceGeometry(bounds), material);
          mesh.name = "Prominences";
          mesh.renderOrder = 2;
          scene.add(mesh);
        }
      }
      if (!mesh) return;
      mesh.visible = ready && lit > 0;
      /* The threads drain at the flow's pace in model time, faster while erupting. */
      const step =
        lastTime === null ? 0 : Math.min(Math.max(frame.time - lastTime, 0), MAX_DRAIN_STEP_S);
      lastTime = frame.time;
      drained = (drained + step * SUN_ACTIVITY_DRAIN_RADII_PER_S) % SUN_ACTIVITY_FLOW_WRAP;
      shown.forEach((p, k) => {
        /* The frame's lift counts heights risen above rest; the volume's counts the height itself. */
        motion[k * 4] = 1 + p.lift;
        motion[k * 4 + 1] = p.fade * lit;
        motion[k * 4 + 2] = 0;
        motion[k * 4 + 3] = drained * (1 + (SUN_ACTIVITY_ERUPTION_DRAIN - 1) * p.erupting);
      });
      /* The bounds live in the body frame: the camera as seen from there. */
      scene.worldToLocal(uniforms.localCamera.value.copy(camera.position));
    },
  };
}

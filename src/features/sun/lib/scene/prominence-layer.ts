/**
 * The frame's prominences as the shared hedgerow volume: one bound per prominence, placed
 * where the frame says, lifted, thinned and drained as it says. The volume is baked off the
 * main thread once (`prominenceDensity`); until it arrives nothing is drawn.
 */
import { Mesh, ShaderMaterial, Vector3, Vector4, type Camera, type Object3D } from "three";

import {
  createProminenceSlots,
  writeProminenceBounds,
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
import { rampColor } from "@/space/sun/model/passbands";
import type { DisposalScope } from "@horizon/toolkit/rendering";

import { lightKind } from "../model/lights";
import type { SunQuality } from "../quality";
import type { SunFrame } from "./frame";
import type { SunLight } from "./settings";

/** Where along a band's ramp a prominence's colour is taken: the cool sheet's moderate brightness. */
const PROMINENCE_RAMP_AT = 0.6;

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
    /** A band's own colour for the emission and its share: none in Hα and the eclipse, which see its red. */
    emissionHue: { value: new Vector4() },
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
  /* One draw with a slot per prominence the frame can hold, written in place as they move. */
  const geometry = scope.own(createProminenceSlots());
  const mesh = new Mesh(geometry, material);
  mesh.name = "Prominences";
  mesh.renderOrder = 2;
  mesh.visible = false;
  scene.add(mesh);
  let ready = false;
  let alive = true;
  scope.defer(() => {
    alive = false;
    mesh.removeFromParent();
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
    /** The light it is seen in: a band shows it in the band's own colour, Hα and the eclipse in its red. */
    setLight(light: SunLight) {
      if (lightKind(light.id) !== "band") return void uniforms.emissionHue.value.set(0, 0, 0, 0);
      const [r, g, b] = rampColor(light.id, PROMINENCE_RAMP_AT);
      uniforms.emissionHue.value.set(r, g, b, 1);
    },
    update(frame: SunFrame, camera: Camera, lit: number) {
      const count = Math.min(frame.prominences.length, SUN_ACTIVITY_MAX_REGIONS);
      let moved = count !== bounds.length;
      for (let i = 0; i < count; i++) {
        const p = frame.prominences[i]!;
        const seed = (i + 1) * 0.173;
        const bound = (bounds[i] ??= { lat: 0, lon: 0, tilt: 0, height: 0, halfLength: 0, seed });
        const halfLength = p.length / 2;
        if (
          bound.lat !== p.lat ||
          bound.lon !== p.lon ||
          bound.tilt !== p.tilt ||
          bound.height !== p.height ||
          bound.halfLength !== halfLength
        ) {
          moved = true;
          bound.lat = p.lat;
          bound.lon = p.lon;
          bound.tilt = p.tilt;
          bound.height = p.height;
          bound.halfLength = halfLength;
        }
      }
      bounds.length = count;
      if (moved) writeProminenceBounds(geometry, bounds);
      /* The threads drain at the flow's pace in model time, faster while erupting. */
      const step =
        lastTime === null ? 0 : Math.min(Math.max(frame.time - lastTime, 0), MAX_DRAIN_STEP_S);
      lastTime = frame.time;
      drained = (drained + step * SUN_ACTIVITY_DRAIN_RADII_PER_S) % SUN_ACTIVITY_FLOW_WRAP;
      mesh.visible = ready && lit > 0 && count > 0;
      if (!mesh.visible) return;
      for (let k = 0; k < count; k++) {
        const p = frame.prominences[k]!;
        /* The frame's lift counts heights risen above rest; the volume's counts the height itself. */
        motion[k * 4] = 1 + p.lift;
        motion[k * 4 + 1] = p.fade * lit;
        motion[k * 4 + 2] = 0;
        motion[k * 4 + 3] = drained * (1 + (SUN_ACTIVITY_ERUPTION_DRAIN - 1) * p.erupting);
      }
      /* The bounds live in the body frame: the camera as seen from there. */
      scene.worldToLocal(uniforms.localCamera.value.copy(camera.position));
    },
  };
}

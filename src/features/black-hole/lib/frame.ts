import { DataTexture, FloatType, RGBAFormat, Vector2, Vector3 } from "three";

import { DISK_OUTER_RADIUS, DISK_PROFILE_SIZE, diskProfilePixels } from "./disk-profile";
import { holeById, SKY_CODE } from "./holes";
import { DISK_INNER_HORIZON_FACTOR } from "./parameters";
import { cameraFloor, horizonOverM, iscoOverM } from "./physics";
import { MAX_DIST } from "./presets";
import { framedRayFov } from "./render-policy";

/**
 * Shader inputs for one frame, shared by the live engine and the headless
 * benchmark so both draw exactly the same scene from the same state.
 */
export type Uniforms = {
  uDiskProfile: { value: DataTexture };
  uResolution: { value: InstanceType<typeof Vector2> };
  uCamPos: { value: InstanceType<typeof Vector3> };
  uCamFwd: { value: InstanceType<typeof Vector3> };
  uCamRight: { value: InstanceType<typeof Vector3> };
  uCamUp: { value: InstanceType<typeof Vector3> };
  uTime: { value: number };
  uSpin: { value: number };
  uInner: { value: number };
  uOuter: { value: number };
  uExposure: { value: number };
  uDiskBright: { value: number };
  uStars: { value: number };
  uTemp: { value: number };
  uFov: { value: number };
  uSteps: { value: number };
  uJet: { value: number };
  uWeather: { value: number };
  uGravity: { value: number };
};

/** The scene settings the shader reads; the store and benchmark scenes both supply them. */
export type SceneSettings = {
  presetId: string;
  spin: number;
  exposure: number;
  diskBrightness: number;
  starIntensity: number;
  tempScale: number;
  /** Off draws the same scene in flat space, for comparison. */
  gravity: boolean;
};

export type CameraPose = {
  azimuth: number;
  inclination: number;
  distance: number;
  roll: number;
};

/** Zoom per wheel unit: gentler far out, and for trackpad pinches. */
export function orbitWheelSensitivity(distance: number, pinch: boolean) {
  return pinch ? 0.0024 : distance < 18 ? 0.0026 : 0.00115;
}

/** Fresh uniforms; the caller owns (and disposes) the disk-profile texture. */
export function createUniforms(): Uniforms {
  return {
    uDiskProfile: {
      value: new DataTexture(
        new Float32Array(DISK_PROFILE_SIZE * 4),
        DISK_PROFILE_SIZE,
        1,
        RGBAFormat,
        FloatType,
      ),
    },
    uResolution: { value: new Vector2(1, 1) },
    uCamPos: { value: new Vector3(0, 0, 24) },
    uCamFwd: { value: new Vector3(0, 0, -1) },
    uCamRight: { value: new Vector3(1, 0, 0) },
    uCamUp: { value: new Vector3(0, 1, 0) },
    uTime: { value: 0 },
    uSpin: { value: 0.82 },
    uInner: { value: 3.2 },
    uOuter: { value: 16.5 },
    uExposure: { value: 1 },
    uDiskBright: { value: 1 },
    uStars: { value: 1 },
    uTemp: { value: 1 },
    uFov: { value: (50 * Math.PI) / 180 },
    uSteps: { value: 140 },
    uJet: { value: 0 },
    uWeather: { value: 0 },
    uGravity: { value: 1 },
  };
}

/** Writes scene uniforms; the Page–Thorne profile is re-integrated only when spin changes. */
export function sceneWriter(uniforms: Uniforms) {
  let profileSpin = NaN;
  return (scene: SceneSettings, time: number, steps: number) => {
    const hole = holeById(scene.presetId);
    uniforms.uTime.value = time;
    uniforms.uSpin.value = scene.spin;
    uniforms.uInner.value = Math.max(
      horizonOverM(scene.spin) * DISK_INNER_HORIZON_FACTOR,
      iscoOverM(scene.spin),
    );
    uniforms.uOuter.value = DISK_OUTER_RADIUS;
    if (profileSpin !== scene.spin) {
      const profile = uniforms.uDiskProfile.value;
      profile.image.data!.set(diskProfilePixels(scene.spin, uniforms.uInner.value));
      profile.needsUpdate = true;
      profileSpin = scene.spin;
    }
    uniforms.uExposure.value = scene.exposure;
    uniforms.uDiskBright.value = scene.diskBrightness;
    uniforms.uStars.value = scene.starIntensity;
    uniforms.uTemp.value = scene.tempScale;
    uniforms.uSteps.value = steps;
    uniforms.uJet.value = hole.jet;
    uniforms.uWeather.value = SKY_CODE[hole.sky];
    uniforms.uGravity.value = scene.gravity ? 1 : 0;
  };
}

/** Camera distance within its bounds: outside the horizon of a hole with this spin. */
export function clampDistance(distance: number, spin: number) {
  return Math.max(cameraFloor(spin), Math.min(MAX_DIST, distance));
}

/** Orbit camera: position, a roll-free basis tilted by `roll`, and the framed field of view. */
export function writeCamera(uniforms: Uniforms, pose: CameraPose, spin: number) {
  const camPos = uniforms.uCamPos.value;
  const camFwd = uniforms.uCamFwd.value;
  const camRight = uniforms.uCamRight.value;
  const camUp = uniforms.uCamUp.value;
  const dist = clampDistance(pose.distance, spin);
  const incl = Math.max(-1.35, Math.min(1.35, pose.inclination));
  const c = Math.cos(incl);
  camPos.set(
    dist * c * Math.sin(pose.azimuth),
    dist * Math.sin(incl),
    dist * c * Math.cos(pose.azimuth),
  );
  camFwd.copy(camPos).multiplyScalar(-1).normalize();
  /* Right follows the azimuth alone, so the image never rolls near the pole. */
  camRight.set(Math.cos(pose.azimuth), 0, -Math.sin(pose.azimuth));
  camUp.crossVectors(camRight, camFwd).normalize();
  if (pose.roll !== 0) {
    const cr = Math.cos(pose.roll);
    const sr = Math.sin(pose.roll);
    const { x, y, z } = camRight;
    camRight.multiplyScalar(cr).addScaledVector(camUp, sr);
    camUp.multiplyScalar(cr);
    camUp.set(camUp.x - x * sr, camUp.y - y * sr, camUp.z - z * sr);
  }
  const far = Math.min(1, Math.max(0, (dist - 48) / 240));
  const near = Math.min(1, Math.max(0, (14 - dist) / 12));
  uniforms.uFov.value = framedRayFov(
    ((50 + far * 18 + near * 34) * Math.PI) / 180,
    uniforms.uResolution.value.x / uniforms.uResolution.value.y,
  );
}

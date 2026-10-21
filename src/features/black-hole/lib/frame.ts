import {
  DataTexture,
  FloatType,
  LinearFilter,
  Matrix4,
  RGBAFormat,
  SRGBColorSpace,
  Vector2,
  Vector3,
} from "three";

import {
  freeFromOrbit,
  writeCameraMatrix,
  type FreeLook,
  type FreePose,
} from "@horizon/toolkit/camera";
import { clamp, cross3, length3, smoothstep, type Vec3 } from "@horizon/toolkit/math";
import { blackbodyLut } from "@horizon/toolkit/science";

import resolveShader from "./black-hole-resolve.frag.glsl";
import { DISK_OUTER_RADIUS, DISK_PROFILE_SIZE, diskProfilePixels } from "./disk-profile";
import { holeById, SKY_CODE } from "./holes";
import {
  BLACKBODY_LUT_SIZE,
  BLACKBODY_MAX_K,
  BLACKBODY_MIN_K,
  DISK_INNER_HORIZON_FACTOR,
  SPIN_LIMIT,
} from "./parameters";
import {
  blRadius,
  cameraFloor,
  diskFlowVelocity,
  horizonOverM,
  INCLINATION_LIMIT,
  iscoOverM,
  MAX_DIST,
} from "./physics";
import { framedRayFov } from "./render-policy";
import { toneExposure } from "./tone";

/**
 * Shader inputs for one frame, shared by the live engine and the headless
 * benchmark so both draw exactly the same scene from the same state.
 */
type Uniforms = {
  uDiskProfile: { value: DataTexture };
  /** Black-body colours; sampled as linear light, since the texels are sRGB-encoded. */
  uBlackbody: { value: DataTexture };
  uResolution: { value: InstanceType<typeof Vector2> };
  /** Camera to world, column-major: right, up, back (−forward) and the position in M. */
  uCamera: { value: InstanceType<typeof Matrix4> };
  /** The camera's velocity through the hovering observer's frame, units of c; zero hovers. */
  uCamVelocity: { value: InstanceType<typeof Vector3> };
  uTime: { value: number };
  uSpin: { value: number };
  uInner: { value: number };
  uOuter: { value: number };
  /** The tone map's exposure (`toneExposure`). */
  uExposure: { value: number };
  uDiskBright: { value: number };
  uStars: { value: number };
  uTemp: { value: number };
  uFov: { value: number };
  uSteps: { value: number };
  uJet: { value: number };
  uWeather: { value: number };
  uGravity: { value: number };
  /** The lens vignette's depth: how much the frame's corners darken, less from far away. */
  uVignette: { value: number };
};

/** The scene settings the shader reads; the store and benchmark scenes both supply them. */
type SceneSettings = {
  presetId: string;
  spin: number;
  exposure: number;
  diskBrightness: number;
  starIntensity: number;
  tempScale: number;
  /** Off draws the same scene in flat space, for comparison. */
  gravity: boolean;
};

/**
 * The orbit camera about the hole; `look` turns it off the hole (a free shot), at it by default,
 * and `ride` (0–1) moves it with the disk gas at its radius instead of hovering.
 */
export type CameraPose = {
  azimuth: number;
  inclination: number;
  distance: number;
  roll: number;
  look?: FreeLook;
  ride?: number;
};

/** Unrolled camera frame: right points at the approaching side, fwd into the scene. */
export type Basis = { right: Vec3; up: Vec3; fwd: Vec3 };

/** The frame looking along `fwd` from `azimuth`; right follows the azimuth alone, so the image never rolls near the pole. */
function rollFreeBasis(azimuth: number, fwd: Vec3): Basis {
  const right: Vec3 = [Math.cos(azimuth), 0, -Math.sin(azimuth)];
  return { right, up: cross3(right, fwd), fwd };
}

/** Basis of the camera at (px, py, pz) without roll, as the guide's drawings and the critical curve need it. */
export function orbitBasis(px: number, py: number, pz: number): Basis {
  const d = Math.hypot(px, py, pz) || 1;
  return rollFreeBasis(Math.atan2(px, pz), [-px / d, -py / d, -pz / d]);
}

/** Zoom per wheel unit: gentler far out, and for trackpad pinches. */
export function orbitWheelSensitivity(distance: number, pinch: boolean) {
  return pinch ? 0.0024 : distance < 18 ? 0.0026 : 0.00115;
}

/**
 * How the fullscreen pass clears, which GPU it asks for, and how it finishes a bloomed frame
 * (the resolve shader, sharing the uniforms its display pipeline reads), for the engine and
 * the bench alike.
 */
export function passOptions(uniforms: Uniforms) {
  return {
    clearColor: 0x08080b,
    powerPreference: "low-power",
    hdr: {
      fragmentShader: resolveShader,
      uniforms: {
        uResolution: uniforms.uResolution,
        uExposure: uniforms.uExposure,
        uVignette: uniforms.uVignette,
      },
    },
  } as const;
}

/** The black-body lookup: one row, filtered between texels, decoded to linear light by the GPU. */
function blackbodyTexture() {
  const texture = new DataTexture(
    blackbodyLut(BLACKBODY_LUT_SIZE, BLACKBODY_MIN_K, BLACKBODY_MAX_K),
    BLACKBODY_LUT_SIZE,
    1,
  );
  texture.colorSpace = SRGBColorSpace;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

/** Fresh uniforms; the caller owns (and disposes) their textures (`uniformTextures`). */
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
    uBlackbody: { value: blackbodyTexture() },
    uResolution: { value: new Vector2(1, 1) },
    uCamera: { value: new Matrix4().makeTranslation(0, 0, 24) },
    uCamVelocity: { value: new Vector3() },
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
    uVignette: { value: 0.1 },
  };
}

/** The uniforms' textures, for their owner to dispose and to re-upload after a lost context. */
export const uniformTextures = (uniforms: Uniforms) => [
  uniforms.uDiskProfile.value,
  uniforms.uBlackbody.value,
];

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
    uniforms.uExposure.value = toneExposure(scene.exposure);
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

/** The free pose an orbit pose draws: off the pole, outside the horizon, turned by its look. */
export function cameraOf(pose: CameraPose, spin: number): FreePose {
  return freeFromOrbit({
    ...pose,
    distance: clampDistance(pose.distance, spin),
    inclination: clamp(pose.inclination, -INCLINATION_LIMIT, INCLINATION_LIMIT),
  });
}

/** A free camera's position kept within the distance bounds, in place. */
export function clampPosition(position: FreePose["position"], spin: number) {
  const r = Math.hypot(...position);
  if (r === 0) {
    position[2] = clampDistance(0, spin);
    return;
  }
  const scale = clampDistance(r, spin) / r;
  position[0] *= scale;
  position[1] *= scale;
  position[2] *= scale;
}

/** The camera's distance from the hole, M. */
export function cameraDistance(uniforms: Uniforms) {
  const m = uniforms.uCamera.value.elements;
  return Math.hypot(m[12], m[13], m[14]);
}

/**
 * Free camera: the matrix, its motion (`ride` of the way to moving with the disk gas), the lens
 * vignette for its distance and the framed field of view.
 */
export function writeCamera(uniforms: Uniforms, pose: FreePose, spin: number, ride = 0) {
  const m = uniforms.uCamera.value.elements;
  writeCameraMatrix(m, pose);
  const flow = ride > 0 ? diskFlowVelocity(pose.position, spin) : null;
  if (flow) uniforms.uCamVelocity.value.set(...flow).multiplyScalar(Math.min(ride, 1));
  else uniforms.uCamVelocity.value.set(0, 0, 0);
  const dist = length3(pose.position);
  /* The vignette eases off with the camera's Boyer–Lindquist radius: a tenth of the way to the
     corners' black up close, under half that from 160 M out. */
  const { r: rc } = blRadius(pose.position, clamp(spin, -SPIN_LIMIT, SPIN_LIMIT));
  uniforms.uVignette.value = 0.1 * (1 - 0.55 * smoothstep(40, 160, rc));
  const far = Math.min(1, Math.max(0, (dist - 48) / 240));
  const near = Math.min(1, Math.max(0, (14 - dist) / 12));
  uniforms.uFov.value = framedRayFov(
    ((50 + far * 18 + near * 34) * Math.PI) / 180,
    uniforms.uResolution.value.x / uniforms.uResolution.value.y,
  );
}

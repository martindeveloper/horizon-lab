import type { BenchTarget } from "@horizon/toolkit/bench";
import { createOrbitInput } from "@horizon/toolkit/camera";
import { createFullscreenPass } from "@horizon/toolkit/rendering";
import { fullscreenVertex } from "@horizon/toolkit/shaders";

import { BENCH_SCENES, benchMotion, benchPose } from "./lib/bench-scenes";
import fragmentShader from "./lib/black-hole.frag.glsl";
import {
  createUniforms,
  orbitWheelSensitivity,
  PASS_OPTIONS,
  sceneWriter,
  writeCamera,
  type CameraPose,
} from "./lib/frame";
import { holeById, paramsFromPreset } from "./lib/holes";
import { MAX_DIST, MIN_DIST } from "./lib/physics";
import { BLACK_HOLE_QUALITY } from "./lib/quality";

/**
 * Headless benchmark target: the observatory's shader, uniforms, camera and
 * orbit input exactly as the engine drives them, without the store, tours UI
 * or frame loop. Frames render at the requested size, not the app's
 * quality-scaled buffer, so results compare per pixel.
 */
export const benchTarget: BenchTarget = {
  id: "black-hole",
  scenes: BENCH_SCENES,
  mount(sceneId, { canvas, width, height }) {
    const scene = BENCH_SCENES.find((s) => s.id === sceneId);
    if (!scene) throw new Error(`Unknown black-hole scene: ${sceneId}`);
    const uniforms = createUniforms();
    const pass = createFullscreenPass({
      canvas,
      vertexShader: fullscreenVertex,
      fragmentShader,
      uniforms,
      ...PASS_OPTIONS,
    });
    pass.resize(width, height);
    uniforms.uResolution.value.set(width, height);
    const settings = paramsFromPreset(holeById(scene.presetId), scene.quality, false);
    const steps = BLACK_HOLE_QUALITY[scene.quality].steps;
    const writeScene = sceneWriter(uniforms);

    // Input scenes steer the camera with the app's own orbit input.
    let pose: CameraPose = benchPose(scene);
    const input =
      scene.motion?.kind === "input"
        ? createOrbitInput(canvas, {
            getPose: () => pose,
            onChange: (next) => {
              pose = { ...pose, ...next };
            },
            distance: { min: MIN_DIST, max: MAX_DIST },
            wheelSensitivity: orbitWheelSensitivity,
          })
        : null;
    let spin = settings.spin;

    const gl = canvas.getContext("webgl2");
    if (!gl) throw new Error("WebGL 2 is unavailable");
    return {
      gl,
      render(frame) {
        if (scene.script && !input) {
          const motion = benchMotion(scene, frame.progress, frame.progress * scene.script.duration);
          pose = motion.pose;
          spin = motion.spin;
        }
        writeCamera(uniforms, pose, spin);
        writeScene({ ...settings, spin, gravity: true }, frame.time, steps);
        pass.render();
      },
      describe: () => ({
        azimuth: pose.azimuth,
        inclination: pose.inclination,
        distance: uniforms.uCamPos.value.length(),
        spin,
        steps,
        fovDeg: (uniforms.uFov.value * 180) / Math.PI,
      }),
      dispose() {
        input?.dispose();
        pass.dispose();
        uniforms.uDiskProfile.value.dispose();
      },
    };
  },
};

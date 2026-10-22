import { timedDrift } from "@/lib/drift";
import type { BenchTarget } from "@horizon/toolkit/bench";
import { createDriftCamera, createOrbitInput } from "@horizon/toolkit/camera";
import { createFullscreenPass } from "@horizon/toolkit/rendering";
import { fullscreenVertex } from "@horizon/toolkit/shaders";

import { BENCH_SCENES, benchMotion, benchPose, bundledAudioMap } from "./lib/bench-scenes";
import fragmentShader from "./lib/black-hole.frag.glsl";
import { driftFor } from "./lib/drift";
import {
  cameraDistance,
  createUniforms,
  orbitWheelSensitivity,
  passOptions,
  sceneWriter,
  uniformTextures,
  writeOrbitCamera,
  type CameraPose,
} from "./lib/frame";
import { holeById, paramsFromPreset } from "./lib/holes";
import { gasTurnRate } from "./lib/parameters";
import { MAX_DIST, MIN_DIST } from "./lib/physics";
import { BLACK_HOLE_QUALITY, bloomSettings, lensSettings, recordPixels } from "./lib/quality";
import { toneExposure } from "./lib/tone";
import { createTraceCache } from "./lib/trace-cache";

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
    const traces = createTraceCache(uniforms, { parallel: false });
    const pass = createFullscreenPass({
      canvas,
      vertexShader: fullscreenVertex,
      fragmentShader,
      uniforms: { ...uniforms, ...traces.uniforms },
      defines: traces.defines,
      ...passOptions(uniforms),
      supersample: true,
    });
    pass.resize(width, height);
    uniforms.uResolution.value.set(width, height);
    const settings = paramsFromPreset(holeById(scene.presetId), false);
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
    /* Drift scenes fly the hole's programme exactly as written, in order, with the engine's hold
       rule, cut to the opening shot as the page's curtain does. */
    const programme = driftFor(settings.diskBrightness);
    const timed = timedDrift(programme, bundledAudioMap(programme));
    const drift =
      scene.motion?.kind === "drift"
        ? createDriftCamera(timed.shots, {
            ...timed.programme.camera,
            variance: 0,
            order: "sequence",
            opening: () => 0,
            cut: true,
            holdDrift: (landed, shot) =>
              shot.ride ? -gasTurnRate(landed.distance, spin) * shot.ride : undefined,
          })
        : null;
    if (drift) drift.start(pose);
    const exposure = toneExposure(settings.exposure);
    const bloom = scene.bloom ? bloomSettings(scene.quality, false, exposure) : null;
    const lens = scene.lens ? lensSettings(scene.quality, false, exposure) : null;
    const gamut = scene.wideColour ? "p3" : "srgb";
    const antialias = scene.antialias ?? "off";
    /* A desktop's record cap, or none where the scene times the march itself. */
    const maxRecord = scene.retrace ? 0 : recordPixels(false);

    const gl = canvas.getContext("webgl2");
    if (!gl) throw new Error("WebGL 2 is unavailable");
    return {
      gl,
      render(frame) {
        if (drift) {
          const { look, ride, ...orbit } = drift.step(frame.dt).pose;
          pose = { ...orbit, look, ride };
        } else if (scene.script && !input) {
          const motion = benchMotion(scene, frame.progress, frame.progress * scene.script.duration);
          pose = motion.pose;
          spin = motion.spin;
        }
        writeOrbitCamera(uniforms, pose, spin);
        writeScene({ ...settings, spin, gravity: true }, frame.time, steps);
        traces.prepare(pass.renderer, maxRecord);
        pass.render({ antialias, bloom, lens, gamut });
      },
      describe: () => ({
        azimuth: pose.azimuth,
        inclination: pose.inclination,
        distance: cameraDistance(uniforms),
        spin,
        steps,
        fovDeg: (uniforms.uFov.value * 180) / Math.PI,
        bloom: bloom !== null,
        lens: lens !== null,
        wideColour: gamut === "p3",
        antialias,
      }),
      dispose() {
        input?.dispose();
        traces.dispose();
        pass.dispose();
        for (const texture of uniformTextures(uniforms)) texture.dispose();
      },
    };
  },
};

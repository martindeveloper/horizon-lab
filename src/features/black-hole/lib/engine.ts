import {
  createOrbitInput,
  sampleOrbitFlight,
  writeCameraSnapshot,
  type CameraSnapshot,
} from "@horizon/toolkit/camera";
import { prefersReducedMotion } from "@horizon/toolkit/environment";
import { lerp, smootherstep } from "@horizon/toolkit/math";
import {
  createEngineHost,
  createFullscreenPass,
  observePowerPreference,
  DisposalScope,
} from "@horizon/toolkit/rendering";
import { fullscreenVertex } from "@horizon/toolkit/shaders";

import fragmentShader from "./black-hole.frag.glsl";
import {
  clampDistance,
  createUniforms,
  orbitWheelSensitivity,
  sceneWriter,
  writeCamera,
} from "./frame";
import { MAX_DIST, MIN_DIST, type Quality } from "./presets";
import { BLACK_HOLE_QUALITY, renderBudget, renderScale } from "./quality";
import { useBlackHole } from "./store";
import { tourFor } from "./tours";

export type BlackHoleEngine = { dispose: () => void };

/** Feature orchestration only: physics, uniforms, tours and application state. */
export function createBlackHoleEngine(
  canvas: HTMLCanvasElement,
  host: HTMLElement,
  snapshot: CameraSnapshot,
  onFirstFrame?: () => void,
  onError?: (error: unknown) => void,
): BlackHoleEngine {
  const resources = new DisposalScope();
  try {
    const uniforms = createUniforms();
    const profile = resources.own(uniforms.uDiskProfile.value);
    const writeScene = sceneWriter(uniforms);

    const pass = resources.own(
      createFullscreenPass({
        canvas,
        vertexShader: fullscreenVertex,
        fragmentShader,
        uniforms,
        clearColor: 0x08080b,
        powerPreference: "low-power",
        supersample: true,
      }),
    );
    const reduce = prefersReducedMotion();

    let azimuth = useBlackHole.getState().azimuth;
    let incl = useBlackHole.getState().inclination;
    let dist = useBlackHole.getState().distance;
    let time = 0;
    let stage = 0;
    let announced = false;
    let lastGuideOpen = false;
    let lastGuideBeat = -1;
    let tourT = 0;
    let tourFromAz = azimuth;
    let tourFromIncl = incl;
    let tourFromDist = dist;
    let tourFromRoll = 0;
    let roll = 0;
    let holding = false;
    let holdT = 0;
    let holdAz = 0;
    let holdIncl = 0;
    let holdDist = 0;

    const input = resources.own(
      createOrbitInput(canvas, {
        getPose: () => ({ azimuth, inclination: incl, distance: dist }),
        onChange: (pose) => {
          azimuth = pose.azimuth;
          incl = pose.inclination;
          dist = clampDistance(pose.distance, useBlackHole.getState().spin);
          useBlackHole.getState().setAzimuth(azimuth);
          useBlackHole.getState().setInclination(incl);
          useBlackHole.getState().setDistance(dist);
        },
        enabled: () => !useBlackHole.getState().guideOpen,
        distance: { min: MIN_DIST, max: MAX_DIST },
        wheelSensitivity: orbitWheelSensitivity,
      }),
    );
    const power = resources.own(observePowerPreference());
    let constrained = power.state.coarsePointer || power.state.onBattery;
    const engine = resources.own(
      createEngineHost({
        canvas,
        host,
        resolution: () => {
          const quality = useBlackHole.getState().quality;
          return {
            scale: renderScale(
              quality,
              host.clientWidth,
              host.clientHeight,
              window.devicePixelRatio || 1,
              constrained,
            ),
            dprCap: renderBudget(quality, constrained, false).dprCap,
            dpr: stage < 2 ? 1 : window.devicePixelRatio || 1,
            warmupScale: stage === 0 ? 0.38 : stage === 1 ? 0.68 : 1,
          };
        },
        onResize: (width, height) => {
          pass.resize(width, height);
          canvas.style.width = "100%";
          canvas.style.height = "100%";
          uniforms.uResolution.value.set(width, height);
        },
        ...(onError !== undefined ? { onError } : {}),
      }),
    );
    function announceFirstFrame() {
      if (announced) return;
      announced = true;
      onFirstFrame?.();
    }
    function applyCamera() {
      const state = useBlackHole.getState();
      if (!state.guideOpen && !input.active) {
        azimuth = state.azimuth;
        incl = state.inclination;
        dist = state.distance;
      }
      dist = clampDistance(dist, state.spin);
      writeCamera(uniforms, { azimuth, inclination: incl, distance: dist, roll }, state.spin);
      writeCameraSnapshot(
        snapshot,
        uniforms.uCamPos.value,
        uniforms.uCamFwd.value,
        uniforms.uCamRight.value,
        uniforms.uCamUp.value,
        dist,
        uniforms.uFov.value,
      );
    }

    function stepCount(quality: Quality): number {
      const full = BLACK_HOLE_QUALITY[quality].steps;
      if (stage === 0) return Math.min(48, full);
      if (stage === 1) return Math.min(full, Math.max(80, Math.round(full * 0.72)));
      return full;
    }

    function tick(stepDt: number) {
      const state = useBlackHole.getState();
      if (state.guideOpen) {
        if (!lastGuideOpen || state.guideBeat !== lastGuideBeat) {
          lastGuideOpen = true;
          lastGuideBeat = state.guideBeat;
          tourFromAz = azimuth;
          tourFromIncl = incl;
          tourFromDist = dist;
          tourFromRoll = roll;
          tourT = 0;
          holding = false;
        }
        const beat = tourFor(state.presetId)[state.guideBeat];
        const from = { azimuth: tourFromAz, inclination: tourFromIncl, distance: tourFromDist };
        // The card's timer may land first; the flight still finishes unless motion is reduced.
        if (beat && tourT < 1 && !(state.guideArrived && reduce)) {
          tourT = Math.min(1, tourT + stepDt / Math.max(beat.duration, 0.4));
          const pose = sampleOrbitFlight(tourT, from, beat);
          azimuth = pose.azimuth;
          incl = pose.inclination;
          dist = clampDistance(pose.distance, state.spin);
          roll = lerp(tourFromRoll, beat.roll ?? 0, smootherstep(tourT));
          if (tourT >= 1 && !state.guideArrived) useBlackHole.getState().setGuideArrived(true);
        } else if (beat && state.guideArrived) {
          if (!holding) {
            const end = sampleOrbitFlight(1, from, beat);
            holding = true;
            tourT = 1;
            holdT = 0;
            holdAz = end.azimuth;
            holdIncl = end.inclination;
            holdDist = end.distance;
            roll = beat.roll ?? 0;
          }
          // Hold: a slow orbit that eases in, and a push that settles.
          if (!state.animationPaused && !reduce) holdT += stepDt;
          const drift = beat.drift ?? 0.008 * Math.sign(beat.yaw);
          const ramp = 3;
          const settle = 1 - (1 + holdT / 18) * Math.exp(-holdT / 18);
          azimuth = holdAz + drift * (holdT - ramp * (1 - Math.exp(-holdT / ramp)));
          incl = holdIncl;
          dist = clampDistance(holdDist * (1 - (beat.creep ?? 0.05) * settle), state.spin);
        }
      } else {
        if (lastGuideOpen) {
          lastGuideOpen = false;
          lastGuideBeat = -1;
          holding = false;
          useBlackHole.getState().setAzimuth(azimuth);
          useBlackHole.getState().setInclination(incl);
          useBlackHole.getState().setDistance(dist);
        }
        if (roll !== 0) {
          roll *= Math.exp(-stepDt / 0.7);
          if (Math.abs(roll) < 1e-4) roll = 0;
          engine.markDirty();
        }
      }

      if (!state.animationPaused && state.autoRotate && !input.active && !state.guideOpen) {
        azimuth += 0.045 * stepDt;
        useBlackHole.getState().setAzimuth(azimuth);
      }
      const nextConstrained = power.state.coarsePointer || power.state.onBattery;
      if (nextConstrained !== constrained) {
        constrained = nextConstrained;
        engine.refresh();
      }
      if (!state.animationPaused) time += stepDt;
      writeScene(state, time, stepCount(state.quality));

      applyCamera();

      pass.render({ antialias: state.antialiasing });

      if (stage === 0) {
        announceFirstFrame();
        stage = 1;
        engine.refresh();
      } else if (stage === 1) {
        stage = 2;
        engine.refresh();
      } else announceFirstFrame();
    }
    applyCamera();
    pass.compile();
    engine.start({
      render: tick,
      onRestored: () => {
        profile.needsUpdate = true;
      },
      paused: () => {
        const state = useBlackHole.getState();
        return (
          state.mapOpen ||
          (state.animationPaused &&
            !engine.dirty &&
            stage >= 2 &&
            !(state.guideOpen && (!state.guideArrived || tourT < 1)))
        );
      },
      fps: () => {
        const state = useBlackHole.getState();
        const busy = input.active || (state.guideOpen && (!state.guideArrived || tourT < 1));
        return renderBudget(state.quality, constrained, busy).fps;
      },
    });
    resources.defer(
      useBlackHole.subscribe((state, previous) => {
        if (state.animationPaused || previous.animationPaused || state.mapOpen !== previous.mapOpen)
          engine.invalidate();
        else engine.markDirty();
        if (state.quality !== previous.quality) engine.refresh();
        if (state.guideOpen && !previous.guideOpen) input.cancel();
      }),
    );
    return { dispose: () => resources.dispose() };
  } catch (error) {
    resources.dispose();
    throw error;
  }
}

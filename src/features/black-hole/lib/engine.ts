import {
  createDriftRun,
  createOrbitInput,
  writeCameraSnapshot,
  type CameraSnapshot,
} from "@horizon/toolkit/camera";
import { REDUCED_MOTION_QUERY, prefersReducedMotion } from "@horizon/toolkit/environment";
import {
  createEngineHost,
  createFullscreenPass,
  observePowerPreference,
  DisposalScope,
} from "@horizon/toolkit/rendering";
import { fullscreenVertex } from "@horizon/toolkit/shaders";

import fragmentShader from "./black-hole.frag.glsl";
import { DRIFT } from "./drift";
import {
  clampDistance,
  createUniforms,
  orbitWheelSensitivity,
  PASS_OPTIONS,
  sceneWriter,
  writeCamera,
  type CameraPose,
} from "./frame";
import type { Quality } from "./holes";
import { MAX_DIST, MIN_DIST } from "./physics";
import { BLACK_HOLE_QUALITY, renderBudget, renderScale } from "./quality";
import { useBlackHole } from "./store";
import { holdPose, tourEnd, tourPose } from "./tour-flight";
import { tourFor } from "./tours";

type BlackHoleEngine = { dispose: () => void };
type State = ReturnType<typeof useBlackHole.getState>;

/** Auto-orbit rate, radians per second. */
const ORBIT_RATE = 0.045;
/** A Dutch tilt left by the guide eases out with this time constant once it closes, in seconds. */
const ROLL_DECAY = 0.7;

/**
 * The first frames trace few steps at low resolution so something shows at once;
 * the next frame steps up, and from the third on the scene draws in full.
 */
function createWarmup() {
  let stage = 0;
  return {
    done: () => stage >= 2,
    /** Share of the resolution and the device pixel ratio to draw at this stage. */
    scale: () => (stage === 0 ? 0.38 : stage === 1 ? 0.68 : 1),
    dpr: (device: number) => (stage < 2 ? 1 : device),
    /** Ray steps for this stage, out of the quality's full budget. */
    steps: (full: number) => {
      if (stage === 0) return Math.min(48, full);
      if (stage === 1) return Math.min(full, Math.max(80, Math.round(full * 0.72)));
      return full;
    },
    /** After a frame: whether the stage moved on, so the resolution must be refreshed. */
    advance: () => {
      if (stage >= 2) return false;
      stage += 1;
      return true;
    },
  };
}

/**
 * Flies the camera into each guide beat from wherever it is, then holds it there with
 * a slow drift. The card's timer may land first; the flight still finishes unless motion
 * is reduced.
 */
function createTourDirector(reduce: boolean) {
  let open = false;
  let beatIndex = -1;
  let t = 0;
  let from: CameraPose = { azimuth: 0, inclination: 0, distance: 0, roll: 0 };
  let landed: CameraPose | null = null;
  let held = 0;
  return {
    /** The current beat's flight is still under way. */
    flying: () => t < 1,
    /** The camera for this frame while the guide is open. */
    step(state: State, camera: CameraPose, dt: number): CameraPose {
      if (!open || state.guideBeat !== beatIndex) {
        open = true;
        beatIndex = state.guideBeat;
        from = { ...camera };
        t = 0;
        landed = null;
      }
      const beat = tourFor(state.presetId)[state.guideBeat];
      if (!beat) return camera;
      if (t < 1 && !(state.guideArrived && reduce)) {
        t = Math.min(1, t + dt / Math.max(beat.duration, 0.4));
        if (t >= 1 && !state.guideArrived) state.setGuideArrived(true);
        return tourPose(beat, from, t);
      }
      if (!state.guideArrived) return camera;
      if (!landed) {
        landed = tourEnd(beat, from);
        t = 1;
        held = 0;
      }
      if (!state.animationPaused && !reduce) held += dt;
      return holdPose(beat, landed, held);
    },
    /** The guide closed; true once, when a tour was running. */
    close() {
      const was = open;
      open = false;
      beatIndex = -1;
      landed = null;
      return was;
    },
  };
}

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
        ...PASS_OPTIONS,
        supersample: true,
      }),
    );
    const reduce = prefersReducedMotion();
    const warmup = createWarmup();
    const tour = createTourDirector(reduce);
    /* The drift (lib/drift.ts) flies the camera itself while the store says it plays. */
    const drift = createDriftRun(DRIFT.shots, {
      ...DRIFT.camera,
      reduceMotion: window.matchMedia(REDUCED_MOTION_QUERY),
    });
    let announced = false;
    let time = 0;

    const opening = useBlackHole.getState();
    /** The camera the frame draws; the store holds the visitor's own pose. */
    const camera: CameraPose = {
      azimuth: opening.azimuth,
      inclination: opening.inclination,
      distance: opening.distance,
      roll: 0,
    };
    function moveCamera(pose: CameraPose, spin: number) {
      camera.azimuth = pose.azimuth;
      camera.inclination = pose.inclination;
      camera.distance = clampDistance(pose.distance, spin);
      camera.roll = pose.roll;
    }
    function storeCamera() {
      const state = useBlackHole.getState();
      state.setAzimuth(camera.azimuth);
      state.setInclination(camera.inclination);
      state.setDistance(camera.distance);
    }

    const input = resources.own(
      createOrbitInput(canvas, {
        getPose: () => camera,
        onChange: (pose) => {
          const state = useBlackHole.getState();
          /* A hand on the camera pauses the drift; it flies on from here when resumed. */
          if (state.drift === "playing") state.pauseDrift();
          moveCamera({ ...pose, roll: camera.roll }, state.spin);
          storeCamera();
        },
        enabled: () => !useBlackHole.getState().guideOpen,
        distance: { min: MIN_DIST, max: MAX_DIST },
        wheelSensitivity: orbitWheelSensitivity,
      }),
    );
    const power = resources.own(observePowerPreference());
    const constrainedNow = () => power.state.coarsePointer || power.state.onBattery;
    let constrained = constrainedNow();
    const engine = resources.own(
      createEngineHost({
        canvas,
        host,
        resolution: () => {
          const quality = useBlackHole.getState().quality;
          const device = window.devicePixelRatio || 1;
          return {
            scale: renderScale(quality, host.clientWidth, host.clientHeight, device, constrained),
            dprCap: renderBudget(quality, constrained, false).dprCap,
            dpr: warmup.dpr(device),
            warmupScale: warmup.scale(),
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
    /** The store's pose wins unless the guide, the drift or the visitor's hand is moving the camera. */
    function applyCamera() {
      const state = useBlackHole.getState();
      if (!state.guideOpen && state.drift === "off" && !input.active) {
        camera.azimuth = state.azimuth;
        camera.inclination = state.inclination;
        camera.distance = state.distance;
      }
      camera.distance = clampDistance(camera.distance, state.spin);
      writeCamera(uniforms, camera, state.spin);
      writeCameraSnapshot(
        snapshot,
        uniforms.uCamPos.value,
        uniforms.uCamFwd.value,
        uniforms.uCamRight.value,
        uniforms.uCamUp.value,
        camera.distance,
        uniforms.uFov.value,
      );
    }
    const stepCount = (quality: Quality) => warmup.steps(BLACK_HOLE_QUALITY[quality].steps);
    const busy = (state: State) =>
      (state.guideOpen && (!state.guideArrived || tour.flying())) || state.drift === "playing";

    function tick(stepDt: number) {
      const state = useBlackHole.getState();
      /* The drift's camera comes back to the visitor where it stopped, roll easing out. */
      const drifted = drift.step(state.drift, camera, stepDt);
      if (drifted.ended) storeCamera();
      if (state.guideOpen) moveCamera(tour.step(state, camera, stepDt), state.spin);
      else if (drifted.pose) {
        moveCamera(drifted.pose, state.spin);
        engine.markDirty();
      } else if (state.drift === "off") {
        if (tour.close()) storeCamera();
        if (camera.roll !== 0) {
          camera.roll *= Math.exp(-stepDt / ROLL_DECAY);
          if (Math.abs(camera.roll) < 1e-4) camera.roll = 0;
          engine.markDirty();
        }
      }
      if (
        !state.animationPaused &&
        state.autoRotate &&
        !input.active &&
        !state.guideOpen &&
        state.drift === "off"
      ) {
        camera.azimuth += ORBIT_RATE * stepDt;
        useBlackHole.getState().setAzimuth(camera.azimuth);
      }
      if (constrainedNow() !== constrained) {
        constrained = constrainedNow();
        engine.refresh();
      }
      if (!state.animationPaused) time += stepDt;
      writeScene(state, time, stepCount(state.quality));
      applyCamera();
      pass.render({ antialias: state.antialiasing });
      if (warmup.advance()) engine.refresh();
      announceFirstFrame();
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
          state.mapOpen || (state.animationPaused && !engine.dirty && warmup.done() && !busy(state))
        );
      },
      fps: () => {
        const state = useBlackHole.getState();
        return renderBudget(state.quality, constrained, input.active || busy(state)).fps;
      },
    });
    resources.defer(
      useBlackHole.subscribe((state, previous) => {
        if (state.animationPaused || previous.animationPaused || state.mapOpen !== previous.mapOpen)
          engine.invalidate();
        else engine.markDirty();
        if (state.quality !== previous.quality) engine.refresh();
        if (state.guideOpen && !previous.guideOpen) input.cancel();
        if (state.drift === "playing" && previous.drift !== "playing") input.cancel();
      }),
    );
    return { dispose: () => resources.dispose() };
  } catch (error) {
    resources.dispose();
    throw error;
  }
}

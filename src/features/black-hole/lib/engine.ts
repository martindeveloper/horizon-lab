import { ambientMusic } from "@/components/shell/ambient-music";
import { audioMapNow } from "@/lib/audio-maps";
import { freeCameraOn, onFreeCamera, onRide, rideOverride } from "@/lib/debug";
import { driftRunState, openingFor, timedDrift, type TimedDrift } from "@/lib/drift";
import type { AudioMap } from "@horizon/toolkit/audio";
import {
  createDriftRun,
  createFlightInput,
  type DriftRun,
  createOrbitInput,
  orbitFromFree,
  stepFreeFly,
  turnFree,
  writeCameraSnapshotFromMatrix,
  type CameraSnapshot,
  type FreePose,
  type Vec3,
} from "@horizon/toolkit/camera";
import { REDUCED_MOTION_QUERY, prefersReducedMotion } from "@horizon/toolkit/environment";
import {
  createEngineHost,
  createFullscreenPass,
  observePowerPreference,
  DisposalScope,
} from "@horizon/toolkit/rendering";
import { fullscreenVertex } from "@horizon/toolkit/shaders";
import { isSceneShortcut } from "@horizon/toolkit/ui";

import fragmentShader from "./black-hole.frag.glsl";
import { DRIFT, driftFor, type HoleShot } from "./drift";
import {
  cameraDistance,
  cameraOf,
  clampDistance,
  clampPosition,
  createUniforms,
  orbitWheelSensitivity,
  passOptions,
  sceneWriter,
  writeCamera,
  type CameraPose,
} from "./frame";
import type { Quality } from "./holes";
import { gasTurnRate } from "./parameters";
import { MAX_DIST, MIN_DIST } from "./physics";
import {
  BLACK_HOLE_QUALITY,
  bloomSettings,
  lensSettings,
  renderBudget,
  renderScale,
} from "./quality";
import { useBlackHole } from "./store";
import { holdPose, tourEnd, tourPose } from "./tour-flight";
import { tourFor } from "./tours";

type BlackHoleEngine = { dispose: () => void };
type State = ReturnType<typeof useBlackHole.getState>;

/** Auto-orbit rate, radians per second. */
const ORBIT_RATE = 0.045;
/** A Dutch tilt left by the guide eases out with this time constant once it closes, in seconds. */
const ROLL_DECAY = 0.7;
/** A look off the hole or a ride, left by the guide, the drift or the free camera, eases out this slowly, in seconds. */
const LOOK_DECAY = 1.6;
/** Free camera: radians per CSS pixel of drag, roll rate (rad/s) and speed per M from the hole (1/s). */
const FREE_LOOK = 0.0035;
const FREE_ROLL = 0.9;
const FREE_SPEED = 0.25;

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
        ...passOptions(uniforms),
        supersample: true,
      }),
    );
    const reduce = prefersReducedMotion();
    const warmup = createWarmup();
    const tour = createTourDirector(reduce);
    /* The drifts (lib/drift.ts) fly the camera themselves while the store says one plays: the
       lit hole's and the dormant hole's, chosen each frame by how the disk is lit. Each is timed
       by its track's published map, which the drift's loader has fetched by the time it plays
       (`audioMapNow`), or by the timing it was written with until then. */
    const driftRun = (timed: TimedDrift<HoleShot>) =>
      createDriftRun(timed.shots, {
        ...timed.programme.camera,
        /* The drift's curtain covers a fresh start: the camera cuts to the opening shot. */
        cut: true,
        reduceMotion: window.matchMedia(REDUCED_MOTION_QUERY),
        /* The camera meets the music where it is: it opens on the shot whose cue is nearest. */
        opening: () => openingFor(timed, ambientMusic.position),
        /* A riding shot orbits with the gas where it landed, for this hole's spin. */
        holdDrift: (landed, shot) =>
          shot.ride
            ? -gasTurnRate(landed.distance, useBlackHole.getState().spin) * shot.ride
            : undefined,
      });
    const drifts = new Map<typeof DRIFT, { map: AudioMap | null; run: DriftRun }>();
    /** A programme's run, timed by its map as loaded now; one flying keeps its timing to the end. */
    function runFor(programme: typeof DRIFT) {
      const map = audioMapNow(programme.music?.track);
      const current = drifts.get(programme);
      if (current && (current.map === map || current.run.flying)) return current.run;
      const run = driftRun(timedDrift(programme, map));
      drifts.set(programme, { map, run });
      return run;
    }
    let drift = runFor(DRIFT);
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
      if (pose.look) camera.look = { yaw: pose.look.yaw, pitch: pose.look.pitch };
      else delete camera.look;
      if (pose.ride) camera.ride = pose.ride;
      else delete camera.ride;
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
          moveCamera({ ...camera, ...pose }, state.spin);
          storeCamera();
        },
        enabled: () => !useBlackHole.getState().guideOpen && !free,
        distance: { min: MIN_DIST, max: MAX_DIST },
        wheelSensitivity: orbitWheelSensitivity,
      }),
    );
    /**
     * The debug free camera (`Horizon.Debug.freeCamera()`): drag looks, the keys fly. It takes
     * over from the guide and the drift, and gives the orbit back where it left the camera.
     */
    let free: { pose: FreePose; velocity: Vec3; speed: number } | null = null;
    const flight = resources.own(
      createFlightInput(canvas, {
        onLook: (dx, dy) => {
          if (!free) return;
          free.pose.orientation = turnFree(free.pose.orientation, -dx * FREE_LOOK, -dy * FREE_LOOK);
          engine.markDirty();
        },
        onAxes: () => engine.markDirty(),
        onWheel: (delta) => {
          if (free)
            free.speed = Math.min(8, Math.max(0.125, free.speed * Math.exp(-delta * 0.002)));
        },
        enabled: () => free !== null,
        isShortcut: (event) => isSceneShortcut(event),
      }),
    );
    const focusCanvas = () => canvas.focus({ preventScroll: true });
    function setFree(on: boolean) {
      if (on === (free !== null)) return;
      const state = useBlackHole.getState();
      if (on) {
        if (state.guideOpen) state.endGuide();
        state.stopDrift();
        input.cancel();
        free = { pose: cameraOf(camera, state.spin), velocity: [0, 0, 0], speed: 1 };
        canvas.tabIndex = -1;
        canvas.addEventListener("pointerdown", focusCanvas);
      } else if (free) {
        /* The orbit takes the camera where it stopped; its look and tilt turn back to the hole. */
        moveCamera(orbitFromFree(free.pose), state.spin);
        storeCamera();
        flight.cancel();
        free = null;
        canvas.removeAttribute("tabindex");
        canvas.removeEventListener("pointerdown", focusCanvas);
      }
      engine.markDirty();
    }
    resources.defer(() => canvas.removeEventListener("pointerdown", focusCanvas));
    /** One frame of free flight; true while the camera still moves. */
    function flyFree(dt: number, spin: number) {
      if (!free) return false;
      const { axes } = flight;
      if (axes.roll !== 0)
        free.pose.orientation = turnFree(free.pose.orientation, 0, 0, -axes.roll * FREE_ROLL * dt);
      const stop = axes.park || axes.brake > 0.5;
      const move = stop
        ? { right: 0, up: 0, forward: 0 }
        : { right: axes.strafe, up: axes.lift, forward: axes.thrust };
      const speed = free.speed;
      free.pose.position = stepFreeFly(free.pose, free.velocity, move, axes.boost, dt, {
        speed: (p) => FREE_SPEED * speed * Math.hypot(...p),
        smoothing: stop ? 0.08 : 0.3,
        reduceMotion: { matches: reduce },
        constrain: (p) => clampPosition(p, spin),
      });
      return flight.active || Math.hypot(...free.velocity) > 1e-4;
    }
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
      const ride = rideOverride();
      if (free) {
        clampPosition(free.pose.position, state.spin);
        writeCamera(uniforms, free.pose, state.spin, ride ?? 0);
      } else {
        if (!state.guideOpen && state.drift === "off" && !input.active) {
          camera.azimuth = state.azimuth;
          camera.inclination = state.inclination;
          camera.distance = state.distance;
        }
        camera.distance = clampDistance(camera.distance, state.spin);
        writeCamera(uniforms, cameraOf(camera, state.spin), state.spin, ride ?? camera.ride ?? 0);
      }
      writeCameraSnapshotFromMatrix(
        snapshot,
        uniforms.uCamera.value.elements,
        cameraDistance(uniforms),
        uniforms.uFov.value,
      );
    }
    const stepCount = (quality: Quality) => warmup.steps(BLACK_HOLE_QUALITY[quality].steps);
    let flyingFree = false;
    const busy = (state: State) =>
      (state.guideOpen && (!state.guideArrived || tour.flying())) ||
      state.drift === "playing" ||
      flyingFree;

    function tick(stepDt: number) {
      const state = useBlackHole.getState();
      /* The guide or the drift starting takes the camera back from the free camera. */
      if (free && (state.guideOpen || state.drift !== "off")) setFree(false);
      flyingFree = flyFree(stepDt, state.spin);
      /* A hole lit differently flies the other drift, from wherever the camera is now; a drift
         not flying yet takes the timing of a map that has since arrived. */
      const run = runFor(driftFor(state.diskBrightness));
      if (run !== drift) {
        drift.step("off", camera, 0);
        drift = run;
      }
      /* The drift's camera comes back to the visitor where it stopped, roll easing out. */
      const drifted = drift.step(driftRunState(state.drift), camera, stepDt);
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
      /* Nothing scripted is flying (the drift may be paused under the visitor's hand): the view
         turns back to the hole and the camera slows back to hovering. */
      if (!free && !state.guideOpen && state.drift !== "playing") {
        const fade = Math.exp(-stepDt / LOOK_DECAY);
        if (camera.look) {
          camera.look.yaw *= fade;
          camera.look.pitch *= fade;
          if (Math.hypot(camera.look.yaw, camera.look.pitch) < 1e-4) delete camera.look;
          engine.markDirty();
        }
        if (camera.ride) {
          camera.ride *= fade;
          if (camera.ride < 1e-4) delete camera.ride;
          engine.markDirty();
        }
      }
      if (
        !state.animationPaused &&
        state.autoRotate &&
        !input.active &&
        !free &&
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
      pass.render({
        antialias: state.antialiasing,
        bloom: state.bloom ? bloomSettings(state.quality, constrained, state.exposure) : null,
        lens: state.lens ? lensSettings(state.quality, constrained, state.exposure) : null,
        gamut: state.wideColour ? "p3" : "srgb",
      });
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
    resources.defer(onFreeCamera(setFree));
    resources.defer(onRide(() => engine.markDirty()));
    setFree(freeCameraOn());
    return { dispose: () => resources.dispose() };
  } catch (error) {
    resources.dispose();
    throw error;
  }
}

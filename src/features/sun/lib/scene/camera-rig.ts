/**
 * The Sun lab's camera: the orbit rig, its controls and the drift, about what the view orbits.
 * The orbit is about the Sun's centre, a feature's (`viewAim`) with its up the surface normal
 * there (`featureOrbitFrame`), Parker in its close-up, or a surface point the visitor zoomed
 * toward; while the drift plays it is about the centre in a frame that turns with the Sun from
 * the moment it began, so the features its shots frame (`driftPose`) stay framed loop after loop.
 * When the orbit changes the camera is written into the new one as it stands, with the look that
 * keeps its view (`reframe`); outside the drift that look then eases off. What each orbit
 * allows (its limits, a full drag, the horizon floor, the roll) is read from one framing.
 */
import { Quaternion, Vector3, type PerspectiveCamera } from "three";

import { orbitCamera, stageClearance } from "@/lib/scene-bridge";
import type { SceneCamera } from "@/lib/scene-store";
import { sunwardCloseUpPose } from "@/space/close-up-flight";
import { PARKER_APHELION_R } from "@/space/sun/model/parker";
import { surfaceRate } from "@/space/sun/model/rotation";
import {
  easeToward,
  orbitFromFree,
  type DriftRunState,
  type DriftSettings,
  type DriftShot,
  type OrbitInputSource,
  type OrbitPose,
  type OrbitTurn,
} from "@horizon/toolkit/camera";
import { clamp01 } from "@horizon/toolkit/math";
import type { DisposalScope } from "@horizon/toolkit/rendering";
import {
  createOrbitControls,
  createOrbitRig,
  createRigDrift,
  createViewMoves,
  type RigAttitude,
  type Viewport,
} from "@horizon/toolkit/scene";

import {
  AIM_LAG_S,
  CAMERA_FAR_R,
  CAMERA_MAX_R,
  CAMERA_MIN_R,
  DRAG_FULL_HEIGHT,
  FEATURE_ELEVATION_MIN,
  FEATURE_MIN_R,
  ORBIT_REACH_R,
  POINTER_AIM_R,
  POINTER_RELEASE_R,
} from "../parameters";
import type { SunFrame } from "./frame";
import { frameInsets, type SunViewport } from "./framing";
import type { createParkerLayer } from "./parker-layer";
import type { SunViewId } from "./settings";
import {
  OPENING_ANGLES,
  featureLimits,
  featureOrbitFrame,
  surfaceAim,
  viewAim,
  viewEasesAim,
  viewPose,
  viewTurns,
  type ViewAim,
} from "./views";

/** What the orbit is about. */
type Orbit = "centre" | "drift" | "feature" | "parker" | "pointer";

/** What each orbit allows. */
type Framing = {
  /** It turns about a point other than the Sun's centre, with its feature: a drag turns fully, the clock does not carry it. */
  aboutPoint: boolean;
  /** The camera stays over the point's horizon and outside the globe's shell. */
  overHorizon: boolean;
  /** The picture's roll eases back onto the orbit's up; over a point seen from nearly overhead the up is any way round, so it is kept. */
  easesRoll: boolean;
};

const FRAMINGS: Readonly<Record<Orbit, Framing>> = {
  centre: { aboutPoint: false, overHorizon: false, easesRoll: true },
  drift: { aboutPoint: false, overHorizon: false, easesRoll: true },
  feature: { aboutPoint: true, overHorizon: true, easesRoll: true },
  /* Parker stands off the Sun: its close-up circles it freely, even from behind. */
  parker: { aboutPoint: true, overHorizon: false, easesRoll: true },
  pointer: { aboutPoint: true, overHorizon: true, easesRoll: false },
};

const CENTRE_LIMITS = { min: CAMERA_MIN_R, max: CAMERA_MAX_R } as const;
const AXIS_X = new Vector3(1, 0, 0);
const AXIS_Y = new Vector3(0, 1, 0);
const AXIS_Z = new Vector3(0, 0, 1);
/** The body's pole: what the surface turns about. */
const POLE = AXIS_Y;
/** The body's turn, the equator's rate, as the frame turns the surface (`surfaceTurn`). */
const BODY_RATE = surfaceRate(0);

export type SunCameraDeps = {
  camera: PerspectiveCamera;
  canvas: HTMLCanvasElement;
  host: HTMLElement;
  viewport: Viewport;
  reduceMotion: MediaQueryList;
  invalidate: () => void;
  parker: ReturnType<typeof createParkerLayer>;
  /** The view and whether Parker's close-up has the camera, as the settings stand. */
  settings: () => { view: SunViewId; closeUp: boolean };
  /** The frame on screen. */
  drawn: () => SunFrame;
  /** The visitor took the camera. */
  onInput?: (() => void) | undefined;
  drift?:
    | {
        shots: () => readonly DriftShot[];
        settings: Partial<DriftSettings>;
        state: () => DriftRunState;
      }
    | undefined;
};

export function createSunCamera(scope: DisposalScope, deps: SunCameraDeps) {
  const { camera, viewport, reduceMotion, parker } = deps;
  /** The orbit's centre and its turn, as the rig reads them. */
  const orbitOrigin = new Vector3();
  const orbitFrame = new Quaternion();
  /** What the orbit is about, and the feature view it follows (to notice another one). */
  let orbit: Orbit = "centre";
  let following: SunViewId | null = null;
  const framing = () => FRAMINGS[orbit];
  /** The Sun's turn as the drift began. */
  let driftTurn = 0;
  /** The orbit's centre eases toward a jumped aim; the look eases back onto the aim. */
  let aimSettling = false;
  let settling = false;
  /** The view frames itself as the frame changes, until the visitor takes the camera. */
  let autoFramed = true;
  /** A surface point the visitor zoomed toward in a view about the centre (body frame); see `takeAim`. */
  let pointerAim: { lat: number; lon: number } | null = null;

  /** Sets the orbit for what it is about, at this frame. */
  const orbitFor = (f: SunFrame, target: ViewAim | null, dt?: number) => {
    aimSettling = false;
    if (target) {
      const previousRadius = orbitOrigin.length();
      orbitOrigin.fromArray(target.point);
      if (following && viewEasesAim(following) && dt !== undefined && !reduceMotion.matches) {
        const radius = orbitOrigin.length();
        aimSettling = Math.abs(radius - previousRadius) > 1e-4;
        if (aimSettling) orbitOrigin.setLength(easeToward(previousRadius, radius, dt, AIM_LAG_S));
      }
      featureOrbitFrame(target.normal, orbitFrame);
      return;
    }
    orbitOrigin.set(0, 0, 0);
    if (orbit === "drift") orbitFrame.setFromAxisAngle(AXIS_Y, f.surfaceTurn - driftTurn);
    else orbitFrame.identity();
  };

  /* The canvas as the framing reads it, with the dock's measured height under it. */
  const dockClear = stageClearance(deps.host, "--hud-clear");
  const fitted: SunViewport = { width: 0, height: 0, fov: 0, bottomInset: 0 };
  const fitViewport = () => {
    fitted.width = viewport.width;
    fitted.height = viewport.height;
    fitted.fov = camera.fov;
    fitted.bottomInset = dockClear();
    return fitted;
  };

  const opening = deps.settings().view;
  const first = deps.drawn();
  const openingAim = viewAim(opening, first);
  if (openingAim) {
    orbit = "feature";
    following = opening;
    orbitFor(first, openingAim);
  }
  /** Where the camera looks off its aim and its tilt: the drift's while it flies, else easing off. */
  const attitude: RigAttitude = { look: { yaw: 0, pitch: 0 }, roll: 0 };
  const rig = createOrbitRig(camera, {
    pose: viewPose(opening, first, OPENING_ANGLES, fitViewport()),
    limits: () =>
      orbit === "parker"
        ? parker.limits
        : framing().aboutPoint
          ? featureLimits(deps.settings().view)
          : CENTRE_LIMITS,
    home: (aim) => aim.copy(orbitOrigin),
    orient: (_distance, frame) => frame.copy(orbitFrame),
    reduceMotion,
    nearFloor: 0.002,
    /* Past anything the camera can see: across Parker's orbit, from wherever it stands. */
    far: (distance) => Math.max(CAMERA_FAR_R, distance + 2 * PARKER_APHELION_R),
  });
  const step = new Quaternion();
  /** Turns the camera by its attitude once the rig has it facing its aim (as `freeFromOrbit` does). */
  const applyAttitude = () => {
    const { look, roll } = attitude;
    if (look.yaw === 0 && look.pitch === 0 && roll === 0) return;
    camera.quaternion
      .multiply(step.setFromAxisAngle(AXIS_Y, look.yaw))
      .multiply(step.setFromAxisAngle(AXIS_X, look.pitch))
      .multiply(step.setFromAxisAngle(AXIS_Z, roll));
    camera.updateMatrixWorld();
    camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
  };
  const placeCamera = () => {
    rig.home();
    rig.applyPose();
    applyAttitude();
  };

  /** The drift's run: made from its shots as it begins, dropped as it ends. */
  let drift: ReturnType<typeof createRigDrift> | null = null;
  const driftFlying = () => drift?.flying ?? false;
  const driftNow = () => {
    const spec = deps.drift;
    if (!spec) return null;
    if (spec.state() === "off") drift = null;
    else drift ??= createRigDrift(rig, spec.shots(), spec.settings, { attitude: () => attitude });
    return drift;
  };

  /**
   * Keeps the orbit the camera should turn in this frame: the drift's turning one while the
   * drift plays, else Parker in its close-up, else the view's feature, else a point zoomed
   * toward, else the Sun's centre. On a change the camera is written into the new orbit exactly
   * where it stands, its look turned to keep the view; on none the orbit follows the Sun.
   */
  const toOrbit = new Quaternion();
  const local = new Vector3();
  const reframe = (f: SunFrame, dt?: number) => {
    const { view, closeUp } = deps.settings();
    const playing = deps.drift?.state() === "playing";
    const featureAim = playing || closeUp ? null : viewAim(view, f);
    const target = playing
      ? null
      : ((closeUp ? parker.aim(f) : null) ??
        featureAim ??
        (pointerAim ? surfaceAim(pointerAim.lat, pointerAim.lon, f) : null));
    const wanted: Orbit = playing
      ? "drift"
      : !target
        ? "centre"
        : closeUp
          ? "parker"
          : featureAim
            ? "feature"
            : "pointer";
    const follows = wanted === "feature" ? view : null;
    if (wanted === orbit && follows === following) {
      orbitFor(f, target, dt);
      return;
    }
    placeCamera();
    orbit = wanted;
    following = follows;
    if (orbit === "drift") driftTurn = f.surfaceTurn;
    orbitFor(f, target);
    toOrbit.copy(orbitFrame).invert();
    local.copy(camera.position).sub(orbitOrigin).applyQuaternion(toOrbit);
    toOrbit.multiply(camera.quaternion);
    const pose = orbitFromFree({
      position: [local.x, local.y, local.z],
      orientation: [toOrbit.x, toOrbit.y, toOrbit.z, toOrbit.w],
    });
    rig.snap({ azimuth: pose.azimuth, inclination: pose.inclination, distance: pose.distance });
    attitude.look.yaw = pose.look.yaw;
    attitude.look.pitch = pose.look.pitch;
    attitude.roll = pose.roll;
  };

  /** The look easing back onto the aim after a reframe or the drift. */
  const settleAttitude = (dt: number) => {
    if (drift?.flying) {
      const drawn = drift.attitude;
      attitude.look.yaw = drawn.look.yaw;
      attitude.look.pitch = drawn.look.pitch;
      attitude.roll = drawn.roll;
      settling = false;
      return;
    }
    const { look } = attitude;
    const roll = framing().easesRoll ? attitude.roll : 0;
    settling = Math.max(Math.abs(look.yaw), Math.abs(look.pitch), Math.abs(roll)) > 1e-4;
    const instant = !settling || reduceMotion.matches;
    look.yaw = easeToward(look.yaw, 0, dt, AIM_LAG_S, instant);
    look.pitch = easeToward(look.pitch, 0, dt, AIM_LAG_S, instant);
    attitude.roll -= roll - easeToward(roll, 0, dt, AIM_LAG_S, instant);
  };

  const views = createViewMoves(
    rig,
    (id: SunViewId) => viewPose(id, deps.drawn(), rig.pose, fitViewport()),
    viewTurns,
  );
  rig.applyPose();

  /* The surface point under a client position, in the body frame; null off the disc. */
  const pointerRay = new Vector3();
  const hit = new Vector3();
  const surfaceUnder = (clientX: number, clientY: number) => {
    const box = deps.canvas.getBoundingClientRect();
    if (box.width <= 0 || box.height <= 0) return null;
    pointerRay
      .set(
        ((clientX - box.left) / box.width) * 2 - 1,
        1 - ((clientY - box.top) / box.height) * 2,
        0.5,
      )
      .unproject(camera)
      .sub(camera.position)
      .normalize();
    const b = camera.position.dot(pointerRay);
    const disc = b * b - camera.position.lengthSq() + 1;
    if (disc < 0) return null;
    const t = -b - Math.sqrt(disc);
    if (t <= 0) return null;
    hit
      .copy(camera.position)
      .addScaledVector(pointerRay, t)
      .applyAxisAngle(POLE, -deps.drawn().surfaceTurn);
    return { lat: Math.asin(Math.max(-1, Math.min(1, hit.y))), lon: Math.atan2(-hit.z, hit.x) };
  };
  /**
   * A wheel or pinch zooming in over the disc, in a view about the centre and already near
   * it, takes the surface point under the pointer as the orbit's centre: the next frame's
   * reframe writes the camera into that orbit where it stands, and the zoom then closes on
   * the point. The input itself is not taken.
   */
  const takeAim = (next: OrbitPose, source: OrbitInputSource) => {
    if (source.kind === "drag" || next.distance >= rig.pose.distance) return false;
    if (orbit !== "centre" || pointerAim || rig.pose.distance > POINTER_AIM_R) return false;
    const under = surfaceUnder(source.x, source.y);
    if (under) pointerAim = under;
    return false;
  };
  /** Zoomed back away from the point, the orbit returns to the centre. */
  const releaseAim = () => {
    if (pointerAim && framing().aboutPoint && !rig.flying && rig.pose.distance > POINTER_RELEASE_R)
      pointerAim = null;
  };
  const controls = createOrbitControls(scope, deps.canvas, rig, {
    invalidate: deps.invalidate,
    intercept: takeAim,
    /* The input's own bounds span every orbit; the rig clamps to the one it is in. */
    distance: { min: FEATURE_MIN_R, max: ORBIT_REACH_R },
    /* About the centre a drag turns the whole Sun, so near the surface it tightens with
       the camera's height over it, as at the disc view from there out; round a point the
       turn is about the point and stays as it is. */
    dragScale: (pose) =>
      framing().aboutPoint ? 1 : clamp01((pose.distance - 1) / pose.distance / DRAG_FULL_HEIGHT),
    onInput: () => {
      autoFramed = false;
      deps.onInput?.();
    },
  });

  /** Round a point the camera stays over its horizon and outside the globe's shell, whatever a drag asks. */
  const keepOverHorizon = () => {
    if (!framing().overHorizon || rig.flying || driftFlying()) return;
    /* The camera's radius is at least the point's plus its height over the point,
       d·sin(elevation), so the elevation that keeps it CAMERA_MIN_R from the centre is the floor. */
    const over = (CAMERA_MIN_R - orbitOrigin.length()) / Math.max(rig.pose.distance, 1e-9);
    const floor = Math.max(FEATURE_ELEVATION_MIN, Math.asin(Math.min(1, over)));
    if (rig.pose.inclination < floor) rig.pose.inclination = floor;
  };

  const halfTan = () => {
    const tall = Math.tan((camera.fov * Math.PI) / 360);
    return Math.min(tall, tall * camera.aspect);
  };
  /** The close-up's pose round the probe: behind its shield toward the Sun, or in front of it. */
  const closeUpPose = (ride: boolean) =>
    ride ? parker.ridePose(halfTan()) : sunwardCloseUpPose(parker.frame, halfTan());

  /* A hand on the camera ends the view's own framing; the way back gives it back as it was. */
  const sceneOrbit = orbitCamera(rig, deps.invalidate);
  const turn = (by: OrbitTurn) => {
    autoFramed = false;
    rig.turnBy(by);
    deps.invalidate();
  };
  const sceneCamera: SceneCamera = {
    mark: () => {
      const back = sceneOrbit.mark();
      const framed = autoFramed;
      return () => {
        back();
        autoFramed = framed;
      };
    },
    zoom: (factor) => {
      autoFramed = false;
      sceneOrbit.zoom(factor);
    },
    turn,
  };

  return {
    rig,
    sceneCamera,
    turn,
    /** Something holds the camera: a flight or the drift. */
    get flying() {
      return rig.flying || driftFlying();
    },
    driftFlying,
    driftShot: () => drift?.shot ?? -1,
    /** The camera moves by itself or under a hand, and needs frames. */
    get moving() {
      return rig.moving || controls.interacting || driftFlying() || settling || aimSettling;
    },
    flyToView(id: SunViewId) {
      autoFramed = true;
      views.flyToView(id);
    },
    snapToView(id: SunViewId) {
      autoFramed = true;
      views.snapToView(id);
    },
    /** Another view: its own framing, the camera flown there unless the drift has it; true when it flies. */
    viewChanged(view: SunViewId) {
      autoFramed = true;
      pointerAim = null;
      reframe(deps.drawn());
      if (driftFlying()) return false;
      views.flyToView(view);
      return true;
    },
    /** Into Parker's close-up where the camera stands, then the dive; out, back to the view. */
    closeUpChanged(closeUp: boolean, ride: boolean, view: SunViewId, sameView: boolean) {
      autoFramed = !closeUp;
      pointerAim = null;
      reframe(deps.drawn());
      if (closeUp) {
        const pose = closeUpPose(ride);
        rig.flyTo(pose.distance, pose);
      } else if (sameView) views.flyToView(view);
    },
    /** Round the probe: behind its shield toward the Sun, or back in front of it. */
    rideChanged(ride: boolean) {
      const pose = closeUpPose(ride);
      rig.flyTo(pose.distance, pose);
    },
    /** The camera rides with the body, a flight into a view too; the drift and an orbit about a point turn with it already. */
    corotate(modelSeconds: number) {
      if (driftFlying() || framing().aboutPoint) return;
      rig.spin(BODY_RATE * modelSeconds);
    },
    /** Each frame, before drawing: the orbit, the drift, the framing in the stage's free space, and the camera placed. */
    step(f: SunFrame, dt: number) {
      reframe(f, dt);
      driftNow()?.step(deps.drift!.state(), dt);
      /* Centre the subject in the space between the controls and dock: at the canvas centre it
         would shrink needlessly on portrait screens. */
      const fittedViewport = fitViewport();
      const offsetY = driftFlying() ? 0 : frameInsets(fittedViewport).offsetY;
      if (
        camera.view?.offsetY !== offsetY ||
        camera.view?.width !== viewport.width ||
        camera.view?.height !== viewport.height
      )
        camera.setViewOffset(
          viewport.width,
          viewport.height,
          0,
          offsetY,
          viewport.width,
          viewport.height,
        );
      if (driftFlying()) autoFramed = false;
      if (autoFramed && !rig.flying && !driftFlying()) {
        const fit = viewPose(deps.settings().view, f, rig.pose, fittedViewport).distance;
        if (Math.abs(Math.log(fit / rig.target)) > 0.001) rig.zoomTo(fit, false);
      }
      rig.step(dt);
      releaseAim();
      keepOverHorizon();
      settleAttitude(dt);
      placeCamera();
    },
  };
}

export type SunCamera = ReturnType<typeof createSunCamera>;

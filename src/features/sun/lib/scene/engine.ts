/**
 * The Sun lab's renderer on the toolkit's scene host: the globe (the photosphere and the cut's
 * faces, ray-traced), the field's ribbons, the prominences' volume and the atmosphere, drawn
 * from a frame the model hands over and the settings the store keeps. The engine owns the
 * camera (orbit rig, controls, the seven framings, a drift), the names, the taps and the
 * readouts; it only interpolates (the wedge's facing) and never advances the model itself.
 */
import { Group, Mesh, MeshBasicMaterial, Quaternion, Scene, SphereGeometry, Vector3 } from "three";

import { orbitCamera } from "@/lib/scene-bridge";
import type { SceneCamera } from "@/lib/scene-store";
import { sunwardCloseUpPose } from "@/space/close-up-flight";
import { PARKER_APHELION_R } from "@/space/sun/model/parker";
import { CARRINGTON_SIDEREAL_RATE } from "@/space/sun/model/rotation";
import {
  nearestView,
  orbitFromFree,
  type DriftRunState,
  type DriftSettings,
  type DriftShot,
  type OrbitTurn,
  type OrbitInputSource,
  type OrbitPose,
} from "@horizon/toolkit/camera";
import { REDUCED_MOTION_QUERY } from "@horizon/toolkit/environment";
import { lerp, smootherstep, wrapSigned, type Vec3 } from "@horizon/toolkit/math";
import {
  setDrawingBufferGamut,
  withScope,
  type SimulationEngine,
} from "@horizon/toolkit/rendering";
import {
  DEFAULT_INSETS,
  createLabels,
  type PlaceLabel,
  createOrbitControls,
  createOrbitRig,
  createReadoutClock,
  createRigDrift,
  createSceneHost,
  createTapPicking,
  createViewMoves,
  defaultSceneAntialias,
  worldPerPixel,
  type LabelInsets,
  type RigAttitude,
  type SceneAntialias,
  type SceneMount,
} from "@horizon/toolkit/scene";
import type { Gamut } from "@horizon/toolkit/science";

import { createLightTables, type InteriorProfile } from "../graphics/light-tables";
import {
  BLOOM,
  AIM_LAG_S,
  CAMERA_MAX_R,
  CAMERA_MIN_R,
  COROTATE_ABOVE_RATE,
  CUT_HALF_ANGLE,
  CUT_LAG_S,
  CUT_TRAVEL_S,
  FEATURE_ELEVATION_MIN,
  FEATURE_MIN_R,
  DISSOLVE_S,
  DRAG_FULL_HEIGHT,
  ERUPTION_PLAY_S,
  GRANULES_PER_RADIUS,
  NAME_DISC_R,
  NAME_FEATURE_PX,
  NAME_LIMB_PX,
  NAME_OFFSET_PX,
  POINTER_AIM_R,
  POINTER_RELEASE_R,
  RIBBON_HALO_PX,
  RIBBON_PRESENCE,
  SPACE_SRGB,
  SPICULE_HEIGHT,
} from "../parameters";
import { sunQuality, type SunQuality } from "../quality";
import { createAtmosphereLayer } from "./atmosphere-layer";
import { createDissolve } from "./dissolve";
import { createFieldLayer } from "./field-layer";
import { PLACE_IDS, directionOf, type PassbandId, type PlaceId, type SunFrame } from "./frame";
import { frameInsets } from "./framing";
import { GLOBE_PICK, createGlobeLayer } from "./globe-layer";
import { createSunLooks } from "./looks";
import { createParkerLayer } from "./parker-layer";
import { createProminenceLayer } from "./prominence-layer";
import { SUN_VIEW_IDS, type SunLight, type SunSceneSettings, type SunViewId } from "./settings";
import { createSkyLayer } from "./sky-layer";
import { createSunMap } from "./sun-map";
import {
  featureOrbitFrame,
  featuredRegion,
  surfaceAim,
  viewAim,
  viewPose,
  viewReach,
  featureLimits,
  viewTurns,
  type ViewAim,
} from "./views";

/** The shells a tap on the cut face names. */
export const LAYER_IDS = [
  "core",
  "radiativeZone",
  "tachocline",
  "convectionZone",
  "photosphere",
] as const;
export type LayerId = (typeof LAYER_IDS)[number];

/** What a tap landed on: a name (a place), or what the globe and its targets carry. */
export type SunPick =
  | { kind: "place"; id: PlaceId }
  | { kind: "layer"; layer: LayerId }
  | { kind: "region"; id: number }
  | { kind: "prominence"; index: number }
  | { kind: "eruption" };

/** What the engine publishes a few times a second. */
export type SunReadouts = {
  /** The camera's distance from the centre, solar radii. */
  distance: number;
  /** The view the distance is nearest, while nothing flies the camera. */
  view: SunViewId;
  /** The camera's heading and tilt, whole degrees. */
  heading: number;
  tilt: number;
  /** The anti-aliasing drawn with (the device's default while none is chosen). */
  antialias: SceneAntialias;
};

export type SunEngineHooks = {
  /** The interior's profile by radius (0 the centre, 1 the photosphere): the model's Model S. */
  interior: InteriorProfile;
  /** Where each place stands in the body frame, solar radii (the model's `placeAnchor`); null: not now. */
  anchors?: (id: PlaceId) => Vec3 | null;
  /** The clock: model seconds per display second, and whether it is held. */
  clock?: () => { rate: number; paused: boolean };
  /** Advances the model by this many model seconds (rate × dt while the clock runs), before the frame is read. */
  advance?: (modelSeconds: number) => void;
  /** The eruption's scrub and whether it plays by itself; while it plays the engine moves it and reports it. */
  eruption?: () => { s: number; playing: boolean };
  onEruption?: (s: number) => void;
  /** A few times a second: the model seconds elapsed, the flare's class (empty: none) and the cycle's phase. */
  publish?: (elapsedSeconds: number, flareClass: string, cyclePhase: number) => void;
  /** A view flight has arrived. */
  landed?: () => void;
  onPick?: (pick: SunPick | null) => void;
  onReadout?: (readouts: SunReadouts) => void;
  /** The first frame is up. */
  onReady?: () => void;
  /** Map detail the view would show is still loading, or no longer. */
  onSharpening?: (sharpening: boolean) => void;
  /** The visitor took the camera (a drag, a wheel, a pinch). */
  onInput?: () => void;
  /** A drift: its shots (read as it begins, so they may be timed to the music), settings and the state it runs in. */
  drift?: {
    shots: () => readonly DriftShot[];
    settings: Partial<DriftSettings>;
    state: () => DriftRunState;
  };
};

export type SunEngine = SimulationEngine & {
  flyToView: (id: SunViewId) => void;
  snapToView: (id: SunViewId) => void;
  /** A button step of the camera. */
  turn: (step: OrbitTurn) => void;
  /** The camera as the store borrows it (`lendCamera`). */
  camera: SceneCamera;
  invalidate: () => void;
  /** The drift has the camera now. */
  driftFlying: () => boolean;
  /** The shot the drift is flying to or holding; −1 before its first and off the drift. */
  driftShot: () => number;
};

/** The body's pole: what the surface turns about. */
const POLE = new Vector3(0, 1, 0);
/** The tachocline's own width on the cut, as a share of the radius, for a tap to land on. */
const TACHOCLINE_REACH = 0.03;
/** A pick target's radius, radii. */
const TARGET_RADIUS = 0.05;
/** The cut must be this far open before the places inside the Sun are named. */
const NAMED_INSIDE_CUT = 0.3;

const isLayerId = (key: unknown): key is LayerId =>
  typeof key === "string" && (LAYER_IDS as readonly string[]).includes(key);
const isPlaceId = (key: unknown): key is PlaceId =>
  typeof key === "string" && (PLACE_IDS as readonly string[]).includes(key);

/** A pick as the targets carry it (`userData.pick`): one of ours, or nothing. */
function sunPick(pick: unknown): SunPick | null {
  if (typeof pick !== "object" || pick === null || !("kind" in pick)) return null;
  const { kind } = pick;
  if (kind === "place" && "id" in pick && isPlaceId(pick.id)) return { kind, id: pick.id };
  if (kind === "layer" && "layer" in pick && isLayerId(pick.layer))
    return { kind, layer: pick.layer };
  if (kind === "region" && "id" in pick && typeof pick.id === "number")
    return { kind, id: pick.id };
  if (kind === "prominence" && "index" in pick && typeof pick.index === "number")
    return { kind, index: pick.index };
  if (kind === "eruption") return { kind };
  return null;
}

/**
 * Keep the Milky Way visible but subordinate to the Sun, with more sky during totality.
 * This is an illustrative backdrop, not a camera exposure of the Sun and stars together.
 */
const SKY_EXPOSURE: Readonly<Record<keyof typeof RIBBON_PRESENCE, number>> = {
  white: 0.4,
  halpha: 0.3,
  band: 0.3,
  eclipse: 0.5,
  magnetogram: 0.3,
};

/** What kind of light an id is, for how much of the field it shows. */
const lightKind = (id: PassbandId): keyof typeof RIBBON_PRESENCE =>
  id === "white" || id === "halpha" || id === "eclipse" || id === "magnetogram" ? id : "band";

/** The shell a radius lies in on the cut face. */
export function layerAt(r: number, layers: SunSceneSettings["layers"]): LayerId {
  if (r < layers.core) return "core";
  if (Math.abs(r - layers.tachocline) < TACHOCLINE_REACH) return "tachocline";
  if (r < layers.tachocline) return "radiativeZone";
  return "convectionZone";
}

export function createSunEngine(
  { canvas, host, labelRoot, labels, onError }: SceneMount,
  settings: () => SunSceneSettings,
  frame: () => SunFrame,
  hooks: SunEngineHooks,
): SunEngine {
  const api = {
    flyToView: (_: SunViewId) => {},
    snapToView: (_: SunViewId) => {},
    turn: (_: OrbitTurn) => {},
    camera: { mark: () => () => {}, zoom: (_: number) => {}, turn: (_: OrbitTurn) => {} },
    invalidate: () => {},
    driftFlying: () => false,
    driftShot: () => -1,
  };
  const engine = withScope((scope) => {
    const sceneHost = createSceneHost(scope, {
      canvas,
      host,
      onError,
      clearColor: SPACE_SRGB.reduce((hex, channel) => (hex << 8) | Math.round(channel * 255), 0),
    });
    const { renderer, camera, viewport, engine: loop, tight, basics, warmUp } = sceneHost;
    const scene = new Scene();
    /** The Sun's body frame: turned by the frame's `surfaceTurn`, so the lines, prominences, targets and names turn with the surface. */
    const body = new Group();
    scene.add(body);
    const reduceMotion = window.matchMedia(REDUCED_MOTION_QUERY);
    let current = settings();
    let quality: SunQuality = sunQuality(current.quality, tight);
    sceneHost.setResolution(quality.resolution);

    /* ------------------------------------------------------------ layers */
    const looks = createSunLooks();
    /* Parker Solar Probe on its orbit, and at its true size after the scene. */
    const parker = createParkerLayer(basics, scene, {
      gamut: looks.uniforms.uGamut.value,
      invalidate: () => loop.invalidate(),
      /* The labels are made with the camera's machinery below; the layer names only while drawing. */
      place: (...args: Parameters<PlaceLabel>) => place(...args),
    });
    const tables = createLightTables(scope, hooks.interior);
    const globe = createGlobeLayer(scope, scene, looks, tables);
    const field = createFieldLayer(scope, body, looks, tables);
    const prominences = createProminenceLayer(scope, body, {
      tight,
      invalidate: () => loop.invalidate(),
      onError,
    });
    const atmosphere = createAtmosphereLayer(scope, scene, looks, tables);
    const sky = createSkyLayer(scope, scene, basics.dpr, quality.sky, () => loop.invalidate());
    const sunMap = createSunMap(scope, {
      tier: () => quality.mapTier,
      onLoad: (texture) => {
        renderer.initTexture(texture);
        globe.setMap(texture);
      },
      onStencil: (atlas, pages) => {
        renderer.initTexture(atlas);
        renderer.initTexture(pages);
        globe.setStencil(atlas, pages);
      },
      wake: () => loop.invalidate(),
    });
    const applyQuality = () => {
      globe.setQuality(quality);
      field.setQuality(quality);
      prominences.setQuality(quality);
      atmosphere.setQuality(quality);
      sky.setCounts(quality.sky);
      sceneHost.setResolution(quality.resolution);
      sceneHost.setBloom({ enabled: current.bloom, ...quality.bloom, ...BLOOM });
      sceneHost.setLens({ enabled: current.lens, ...quality.lens });
    };
    applyQuality();
    /** The light's exposure and how much a prominence shows in it, from the model's response curve. */
    const relight = (light: SunLight) => {
      const { scale, prominence } = tables.setResponse(light);
      looks.setLight(light, scale);
      tables.setRamp(light.ramp);
      return prominence;
    };
    let prominenceLit = relight(current.light);
    field.setPresence(RIBBON_PRESENCE[lightKind(current.light.id)]);
    /** Another light is asked for: it is applied once the frame in the old one is kept to dissolve from. */
    let relightPending = false;
    const dissolve = createDissolve(scope, renderer, DISSOLVE_S);

    /* ------------------------------------------------------------ camera */
    /* The orbit: about the Sun's centre, or a feature's (`viewAim`) with the orbit's up the
       surface normal there (`featureOrbitFrame`), the one the feature views orbit. The drift
       flies about the Sun's centre throughout, in a frame that turns with the Sun from the
       moment it begins, so the features its shots frame (`driftPose`) stay framed loop after
       loop. When the orbit changes the camera is written into the new one as it stands, with the
       look that keeps its view (`reframe`); outside the drift that look then eases off. */
    const AXIS_X = new Vector3(1, 0, 0);
    const AXIS_Y = new Vector3(0, 1, 0);
    const AXIS_Z = new Vector3(0, 0, 1);
    /** The orbit's centre and its turn, as the rig reads them. */
    const orbitOrigin = new Vector3();
    const orbitFrame = new Quaternion();
    /** What the orbit is about: a feature view's feature, Parker in its close-up, the surface point zoomed toward, the drift's turning frame, or the Sun's centre (null). */
    let framed: SunViewId | "parker" | "pointer" | "drift" | null = null;
    /** The Sun's turn as the drift began. */
    let driftTurn = 0;
    const aboutFeature = () => framed !== null && framed !== "drift";
    let aimSettling = false;
    /** Sets the orbit for what it is about, at this frame. */
    const orbitFor = (f: SunFrame, target: ViewAim | null, dt?: number) => {
      aimSettling = false;
      if (target) {
        const previousRadius = orbitOrigin.length();
        orbitOrigin.fromArray(target.point);
        // A scrub can move the ejecta several solar radii in one input. Ease
        // its aim along with the zoom, while tracking the body's rotation exactly.
        if (framed === "eruption" && dt !== undefined && !reduceMotion.matches) {
          const radius = orbitOrigin.length();
          aimSettling = Math.abs(radius - previousRadius) > 1e-4;
          if (aimSettling)
            orbitOrigin.setLength(radius + (previousRadius - radius) * Math.exp(-dt / AIM_LAG_S));
        }
        featureOrbitFrame(target.normal, orbitFrame);
        return;
      }
      orbitOrigin.set(0, 0, 0);
      if (framed === "drift") orbitFrame.setFromAxisAngle(AXIS_Y, f.surfaceTurn - driftTurn);
      else orbitFrame.identity();
    };
    const opening = viewAim(current.view, frame());
    if (opening) {
      framed = current.view;
      orbitFor(frame(), opening);
    }
    /** Where the camera looks off its aim and its tilt: the drift's while it flies, else easing off. */
    const attitude: RigAttitude = { look: { yaw: 0, pitch: 0 }, roll: 0 };
    const stage = host.closest<HTMLElement>("[data-simulation]");
    const fitViewport = () => ({
      ...viewport,
      fov: camera.fov,
      // The dock already measures its translated, responsive height for labels.
      bottomInset: parseFloat(stage?.style.getPropertyValue("--hud-clear") ?? "") || 0,
    });
    let autoFramed = true;
    const rig = createOrbitRig(camera, {
      pose: viewPose(current.view, frame(), { azimuth: 0, inclination: 0.1 }, fitViewport()),
      limits: () =>
        framed === "parker"
          ? parker.limits
          : aboutFeature()
            ? featureLimits(current.view)
            : { min: CAMERA_MIN_R, max: CAMERA_MAX_R },
      home: (aim) => aim.copy(orbitOrigin),
      orient: (_distance, orbit) => orbit.copy(orbitFrame),
      reduceMotion,
      nearFloor: 0.002,
      /* Past anything the camera can see: across Parker's orbit, from wherever it stands. */
      far: (distance) => Math.max(CAMERA_MAX_R * 4, distance + 2 * PARKER_APHELION_R),
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
    const toOrbit = new Quaternion();
    const local = new Vector3();
    /**
     * Keeps the orbit the camera should turn in this frame: the drift's turning one while the
     * drift plays, else the view's feature, if it has one, else the Sun's centre. On a change
     * the camera is written into the new orbit exactly where it stands, its look turned to keep
     * the view; on none the orbit follows the Sun as it turns.
     */
    /**
     * A surface point the visitor zoomed toward in a view about the centre (body frame), the
     * orbit's centre until the zoom backs away from it; see `takeAim`.
     */
    let pointerAim: { lat: number; lon: number } | null = null;
    const aimOf = (f: SunFrame) =>
      (current.closeUp ? parker.aim(f) : null) ??
      viewAim(view, f) ??
      (pointerAim ? surfaceAim(pointerAim.lat, pointerAim.lon, f) : null);
    const reframe = (f: SunFrame, dt?: number) => {
      const playing = hooks.drift?.state() === "playing";
      const target = playing ? null : aimOf(f);
      const wanted = playing
        ? "drift"
        : !target
          ? null
          : current.closeUp
            ? "parker"
            : viewAim(view, f)
              ? view
              : "pointer";
      if (wanted === framed) {
        orbitFor(f, target, dt);
        return;
      }
      placeCamera();
      framed = wanted;
      if (framed === "drift") driftTurn = f.surfaceTurn;
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
    /** The look easing back onto the aim after a reframe or the drift; true while it moves. */
    let settling = false;
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
      /* A point the visitor zoomed toward keeps the picture upright as it was: over a point
         seen from nearly overhead the orbit's own up is any way round, so only the look eases
         onto the point, never the roll. */
      const keepsRoll = framed === "pointer";
      const roll = keepsRoll ? 0 : attitude.roll;
      settling = Math.max(Math.abs(look.yaw), Math.abs(look.pitch), Math.abs(roll)) > 1e-4;
      const k = !settling || reduceMotion.matches ? 1 : 1 - Math.exp(-dt / AIM_LAG_S);
      look.yaw -= look.yaw * k;
      look.pitch -= look.pitch * k;
      attitude.roll -= roll * k;
    };
    const views = createViewMoves(
      rig,
      (id: SunViewId) => viewPose(id, frame(), rig.pose, fitViewport()),
      viewTurns,
    );
    rig.applyPose();
    /* The surface point under a client position, in the body frame; null off the disc. */
    const pointerRay = new Vector3();
    const hit = new Vector3();
    const surfaceUnder = (clientX: number, clientY: number) => {
      const box = canvas.getBoundingClientRect();
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
        .applyAxisAngle(POLE, -frame().surfaceTurn);
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
      if (
        framed !== null ||
        pointerAim ||
        viewAim(view, frame()) ||
        rig.pose.distance > POINTER_AIM_R
      )
        return false;
      const under = surfaceUnder(source.x, source.y);
      if (under) pointerAim = under;
      return false;
    };
    /** Zoomed back away from the point, the orbit returns to the centre. */
    const releaseAim = () => {
      if (pointerAim && aboutFeature() && !rig.flying && rig.pose.distance > POINTER_RELEASE_R)
        pointerAim = null;
    };
    const controls = createOrbitControls(scope, canvas, rig, {
      invalidate: () => loop.invalidate(),
      intercept: takeAim,
      /* The input's own bounds span both orbits; the rig clamps to the one it is in. */
      distance: { min: FEATURE_MIN_R, max: CAMERA_MAX_R * 3 },
      /* About the centre a drag turns the whole Sun, so near the surface it tightens with
         the camera's height over it, as at the disc view from there out; round a feature
         the turn is about the feature and stays as it is. */
      dragScale: (pose) => {
        const height = (pose.distance - 1) / pose.distance;
        const centre = Math.min(1, Math.max(0, height / DRAG_FULL_HEIGHT));
        return aboutFeature() ? 1 : centre;
      },
      onInput: () => {
        autoFramed = false;
        hooks.onInput?.();
      },
    });
    /** The drift's run: made from its shots as it begins, dropped as it ends. */
    let drift: ReturnType<typeof createRigDrift> | null = null;
    const driftNow = () => {
      const spec = hooks.drift;
      if (!spec) return null;
      if (spec.state() === "off") drift = null;
      else drift ??= createRigDrift(rig, spec.shots(), spec.settings, { attitude: () => attitude });
      return drift;
    };

    /* ------------------------------------------------------------- names */
    const insets: LabelInsets = { ...DEFAULT_INSETS };
    const { place, flush, hits } = createLabels(basics, labelRoot, labels, { insets });
    const dir: [number, number, number] = [0, 0, 0];

    /* -------------------------------------------------------------- taps */
    const targetMaterial = scope.own(new MeshBasicMaterial({ visible: false }));
    const targetGeometry = scope.own(new SphereGeometry(1, 8, 6));
    const targets: Mesh[] = [];
    const target = (pick: SunPick) => {
      const mesh = new Mesh(targetGeometry, targetMaterial);
      mesh.scale.setScalar(TARGET_RADIUS);
      mesh.userData.pick = pick;
      mesh.visible = false;
      body.add(mesh);
      targets.push(mesh);
      return mesh;
    };
    const prominenceTargets = Array.from({ length: 8 }, (_, index) =>
      target({ kind: "prominence", index }),
    );
    const eruptionTarget = target({ kind: "eruption" });
    scope.defer(() => targets.forEach((mesh) => mesh.removeFromParent()));

    /** The wedge as the shader sees it: half-angle and bisector. */
    const cut = looks.uniforms.uCut.value;
    const origin = new Vector3();
    const ray = new Vector3();
    /** Where a tap's ray meets the Sun, as the shader traces it (`traceSun`); null past the gap. */
    const traceTap = (o: Vector3, d: Vector3): { p: Vector3; face: boolean } | null => {
      const b = o.dot(d);
      const c = o.lengthSq() - 1;
      const disc = b * b - c;
      if (disc < 0) return null;
      const s = Math.sqrt(disc);
      const t0 = Math.max(-b - s, 0);
      const t1 = -b + s;
      if (t1 <= 0) return null;
      const p = o.clone().addScaledVector(d, t0);
      const inWedge = (q: Vector3) =>
        cut.x > 0 && Math.abs(wrapSigned(Math.atan2(q.z, q.x) - cut.y, Math.PI * 2)) < cut.x;
      if (!inWedge(p)) return { p, face: false };
      let best = t1;
      let hit = false;
      for (const sign of [-1, 1]) {
        const a = cut.y + sign * cut.x;
        const n =
          sign < 0
            ? new Vector3(-Math.sin(a), 0, Math.cos(a))
            : new Vector3(Math.sin(a), 0, -Math.cos(a));
        const dn = d.dot(n);
        if (dn >= 0) continue;
        const t = -o.dot(n) / dn;
        if (t > t0 && t < best) {
          best = t;
          hit = true;
        }
      }
      return hit ? { p: o.clone().addScaledVector(d, best), face: true } : null;
    };
    /** A name tapped opens its place. */
    const pickOf = (key: string): SunPick | undefined =>
      isPlaceId(key) ? { kind: "place", id: key } : undefined;
    createTapPicking(basics, canvas, {
      pickables: [globe.mesh, ...targets],
      choose: (hitList, tapRay) => {
        const first = hitList.find((hit) => hit.object !== globe.mesh) ?? hitList[0];
        if (!first || first.object !== globe.mesh) return first;
        const traced = traceTap(origin.copy(tapRay.origin), ray.copy(tapRay.direction).normalize());
        if (!traced) return undefined;
        let pick: SunPick = { kind: "layer", layer: "photosphere" };
        if (traced.face)
          pick = { kind: "layer", layer: layerAt(traced.p.length(), current.layers) };
        else {
          /* The regions are given in the body frame. */
          traced.p.applyAxisAngle(POLE, -frame().surfaceTurn);
          for (const region of frame().regions) {
            directionOf(region.lat, region.lon, dir);
            const reach = 2.2 * region.size;
            if (1 - traced.p.dot(new Vector3(...dir)) < 0.5 * reach * reach) {
              pick = { kind: "region", id: region.id };
              break;
            }
          }
        }
        globe.mesh.userData.pick = pick;
        return first;
      },
      blocked: () => drift?.flying ?? false,
      labels: () => hits((key) => pickOf(key) !== undefined),
      labelPick: pickOf,
      onTap: (tapped) => {
        hooks.onPick?.(tapped ? sunPick(tapped.pick) : null);
        globe.mesh.userData.pick = GLOBE_PICK;
      },
    });

    /* ----------------------------------------------------------- settings */
    let gamut: Gamut = "srgb";
    let antialias: SceneAntialias | null = null;
    let bloom: boolean | null = null;
    let lens: boolean | null = null;
    let light = current.light;
    let view = current.view;
    let level = current.quality;
    let closeUp = false;
    let ride = false;
    const halfTan = () => {
      const tall = Math.tan((camera.fov * Math.PI) / 360);
      return Math.min(tall, tall * camera.aspect);
    };
    const applySettings = (s: SunSceneSettings) => {
      current = s;
      if (s.quality !== level) {
        level = s.quality;
        quality = sunQuality(level, tight);
        applyQuality();
      }
      const mode = s.antialias ?? defaultSceneAntialias(tight);
      if (mode !== antialias) {
        antialias = mode;
        sceneHost.setAntialias(mode);
      }
      if (s.bloom !== bloom) {
        bloom = s.bloom;
        sceneHost.setBloom({ enabled: bloom, ...quality.bloom, ...BLOOM });
      }
      if (s.lens !== lens) {
        lens = s.lens;
        sceneHost.setLens({ enabled: lens, ...quality.lens });
      }
      const wanted: Gamut = s.wideColour ? "p3" : "srgb";
      if (wanted !== gamut) {
        gamut = setDrawingBufferGamut(renderer, wanted);
        looks.setGamut(gamut);
      }
      if (s.light !== light) {
        light = s.light;
        relightPending = true;
      }
      if (s.closeUp !== closeUp) {
        /* Into Parker's orbit where the camera stands, then the dive; out, back to the view. */
        closeUp = s.closeUp;
        ride = s.ride;
        autoFramed = !closeUp;
        pointerAim = null;
        reframe(frame());
        if (closeUp) {
          const pose = ride
            ? parker.ridePose(halfTan())
            : sunwardCloseUpPose(parker.frame, halfTan());
          rig.flyTo(pose.distance, pose);
        } else if (s.view === view) views.flyToView(view);
      } else if (closeUp && s.ride !== ride) {
        /* Round the probe: behind its shield toward the Sun, or back in front of it. */
        ride = s.ride;
        const pose = ride
          ? parker.ridePose(halfTan())
          : sunwardCloseUpPose(parker.frame, halfTan());
        rig.flyTo(pose.distance, pose);
      }
      if (s.view !== view) {
        view = s.view;
        autoFramed = true;
        pointerAim = null;
        reframe(frame());
        if (!(drift?.flying ?? false)) {
          views.flyToView(view);
          arriving = true;
        }
      }
    };

    /* ---------------------------------------------------------- the frame */
    const readoutDue = createReadoutClock();
    /** A view flight is under way; `landed` fires once it arrives. */
    let arriving = false;
    /** A point of the body frame hidden behind the Sun from the camera. */
    const anchorAt = new Vector3();
    const toAnchor = new Vector3();
    const projected = new Vector3();
    const radial = new Vector3();
    const behindSun = (p: Vector3) => {
      toAnchor.subVectors(p, camera.position);
      const dist = toAnchor.length();
      toAnchor.divideScalar(Math.max(dist, 1e-9));
      const b = camera.position.dot(toAnchor);
      const disc = b * b - camera.position.lengthSq() + 1;
      return disc >= 0 && -b - Math.sqrt(disc) < dist - 1e-4;
    };
    let lastReadouts: SunReadouts | null = null;
    /** Round a feature the camera stays over its horizon, whatever a drag asks. */
    const keepOverHorizon = () => {
      /* Parker stands off the Sun: its close-up circles it freely, even from behind. */
      if (!aboutFeature() || framed === "parker" || rig.flying || (drift?.flying ?? false)) return;
      /* Over the feature's horizon, and outside the globe's shell: the camera's radius is at
         least the feature's plus its height over the feature, d·sin(elevation), so the elevation
         that keeps it CAMERA_MIN_R from the centre is the floor. */
      const over = (CAMERA_MIN_R - orbitOrigin.length()) / Math.max(rig.pose.distance, 1e-9);
      const floor = Math.max(FEATURE_ELEVATION_MIN, Math.asin(Math.min(1, over)));
      if (rig.pose.inclination < floor) rig.pose.inclination = floor;
    };
    /** The wedge's bisector eases toward the camera's azimuth; true while it moves. */
    let facing = false;
    const faceCamera = (dt: number) => {
      const target = Math.PI / 2 - Math.atan2(camera.position.x, camera.position.z);
      const gap = wrapSigned(target - cut.y, Math.PI * 2);
      const k = reduceMotion.matches ? 1 : 1 - Math.exp(-dt / CUT_LAG_S);
      cut.y += gap * k;
      facing = Math.abs(gap) > 1e-3 && cutShown > 0;
    };
    /**
     * The wedge as drawn: a timed ease from where it stood to the setting, so it lands rather
     * than crawls the last degrees; a new setting starts over from where it is. True while it moves.
     */
    let cutShown = current.cut;
    let cutFrom = cutShown;
    let cutTo = cutShown;
    let cutT = 1;
    let cutting = false;
    const openCut = (dt: number) => {
      if (current.cut !== cutTo) {
        cutFrom = cutShown;
        cutTo = current.cut;
        cutT = 0;
      }
      const span = Math.abs(cutTo - cutFrom) * CUT_TRAVEL_S;
      cutT = reduceMotion.matches || span <= 0 ? 1 : Math.min(1, cutT + dt / span);
      cutShown = lerp(cutFrom, cutTo, smootherstep(cutT));
      cutting = cutT < 1;
      cut.x = cutShown * CUT_HALF_ANGLE;
    };
    /** The camera rides with the Carrington frame; a flight or the drift, which hold the camera, do not, and a feature orbit turns with its feature already. */
    const corotate = (modelSeconds: number) => {
      if (rig.flying || (drift?.flying ?? false) || aboutFeature()) return;
      const turned = rig.pose.azimuth + CARRINGTON_SIDEREAL_RATE * modelSeconds;
      rig.pose.azimuth = wrapSigned(turned, Math.PI * 2);
    };
    cut.y = Math.PI / 2 - Math.atan2(camera.position.x, camera.position.z);
    const eruptionAt = new Vector3();
    const named = (key: string, at: Vector3, on: boolean) => place(key, at.x, at.y, at.z, on);
    const clockRuns = () => {
      const clock = hooks.clock?.();
      return clock !== undefined && !clock.paused && clock.rate !== 0;
    };
    const continuous = () =>
      rig.moving ||
      controls.interacting ||
      (drift?.flying ?? false) ||
      facing ||
      settling ||
      aimSettling ||
      cutting ||
      dissolve.active ||
      globe.busy ||
      clockRuns() ||
      (hooks.eruption?.().playing ?? false);

    const tick = (dt: number, invalidated: boolean) => {
      applySettings(settings());
      /* The model's clock, then the eruption's scrub while it plays by itself. */
      if (clockRuns()) {
        const modelSeconds = hooks.clock!().rate * dt;
        hooks.advance?.(modelSeconds);
        if (hooks.clock!().rate > COROTATE_ABOVE_RATE) corotate(modelSeconds);
      }
      const scrub = hooks.eruption?.();
      if (scrub?.playing && scrub.s < 1)
        hooks.onEruption?.(Math.min(1, scrub.s + dt / ERUPTION_PLAY_S));
      const f = frame();
      reframe(f, dt);
      driftNow()?.step(hooks.drift!.state(), dt);
      // Centre the subject in the space between the controls and dock. Keeping
      // it at the canvas centre unnecessarily shrinks it on portrait screens.
      const fittedViewport = fitViewport();
      const offsetY = drift?.flying ? 0 : frameInsets(fittedViewport).offsetY;
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
      if (drift?.flying) autoFramed = false;
      if (autoFramed && !rig.flying && !(drift?.flying ?? false)) {
        const fitted = viewPose(view, f, rig.pose, fittedViewport).distance;
        if (Math.abs(Math.log(fitted / rig.target)) > 0.001) rig.zoomTo(fitted, false);
      }
      rig.step(dt);
      releaseAim();
      keepOverHorizon();
      settleAttitude(dt);
      placeCamera();
      faceCamera(dt);
      openCut(dt);
      parker.update(dt, f, camera, { orbit: view === "orbit" && !closeUp, closeUp });

      /* A buffer pixel's world size per unit distance, and the ribbons' half-width in CSS px. */
      const cssPixel = worldPerPixel(camera.fov, 1, viewport.height);
      looks.uniforms.uPixelWorld.value = cssPixel / basics.dpr.value;
      field.setHalfWidth((RIBBON_HALO_PX / 2) * cssPixel);
      looks.setFrame(f);
      body.rotation.y = f.surfaceTurn;
      body.updateMatrixWorld();
      sunMap.update();
      /* The photosphere is the unit sphere: its nearest point is a radius in from the camera.
         Parker's model on its way counts as detail too. */
      const sharpening =
        sunMap.sharpening(looks.uniforms.uPixelWorld.value * (camera.position.length() - 1)) ||
        parker.waiting;
      if (sharpening !== lastSharpening) {
        lastSharpening = sharpening;
        hooks.onSharpening?.(sharpening);
      }
      globe.step(dt);
      globe.update(current, camera);
      field.update(f, current.fieldLines);
      prominences.update(f, camera, prominenceLit);
      atmosphere.update(f, current);
      sky.update(camera, SKY_EXPOSURE[lightKind(light.id)]);

      /* Names: each place at its anchor, unless the Sun hides it; the places inside show once
         the cut is open. The tap targets stand at the prominences and the X-point. */
      const names = current.names;
      /* A name shows only near its feature at this scale, never during a flight: disc
         features once they span `NAME_FEATURE_PX`, limb features within `NAME_LIMB_PX` of the
         limb and in view, the places inside with the cut open; each set a little outward. */
      const flying = rig.flying || (drift?.flying ?? false);
      const distance = camera.position.length();
      const worldPx = worldPerPixel(camera.fov, 1, viewport.height);
      const featured = featuredRegion(f);
      const limbPx = Math.asin(Math.min(1, 1 / distance)) / (worldPx / distance);
      let layersNamed = 0;
      for (const id of PLACE_IDS) {
        const anchor = hooks.anchors?.(id) ?? null;
        if (!anchor || flying) {
          named(id, eruptionAt, false);
          continue;
        }
        anchorAt.set(anchor[0], anchor[1], anchor[2]).applyAxisAngle(POLE, f.surfaceTurn);
        /* With the cut open, its shells (`LAYER_IDS`) are named on its faces, each on its own
           band at the anchor's depth and latitude; they alternate faces outward from the core
           (the order `PLACE_IDS` lists them in), so neighbouring bands never crowd one face.
           Closed, the Sun hides the ones inside and the photosphere names the disc. */
        const onCut = isLayerId(id) && cutShown > NAMED_INSIDE_CUT;
        if (onCut) {
          const span = Math.hypot(anchorAt.x, anchorAt.z);
          const face = cut.y + (layersNamed++ % 2 === 0 ? cut.x : -cut.x);
          anchorAt.x = span * Math.cos(face);
          anchorAt.z = span * Math.sin(face);
        }
        let shown = onCut || !behindSun(anchorAt);
        if (shown && !onCut) {
          /* On screen, and near its feature: how big it is, or how close to the limb. */
          projected.copy(anchorAt).project(camera);
          const onScreen =
            Math.abs(projected.x) < 1 && Math.abs(projected.y) < 1 && projected.z < 1;
          const away = anchorAt.distanceTo(camera.position);
          const pxOf = (size: number) => size / (worldPx * away);
          const centrePx =
            Math.hypot(projected.x * viewport.width, projected.y * viewport.height) / 2;
          const nearLimb = Math.abs(centrePx - limbPx) < NAME_LIMB_PX;
          const regionPx = featured ? pxOf(featured.size) : 0;
          const placeShown: Record<PlaceId, boolean> = {
            star: false,
            parker: true,
            granule: pxOf(1 / GRANULES_PER_RADIUS) > 1,
            sunspot: regionPx > NAME_FEATURE_PX,
            facula: regionPx > NAME_FEATURE_PX,
            photosphere: distance < NAME_DISC_R,
            chromosphere: nearLimb,
            spicule: nearLimb && pxOf(SPICULE_HEIGHT) > 2,
            prominence: nearLimb,
            flare: lightKind(light.id) === "band" && (f.eruption?.flareLight ?? 0) > 0.05,
            loops: lightKind(light.id) === "band" && regionPx > NAME_FEATURE_PX,
            corona: nearLimb,
            streamer: nearLimb,
            ejection: true,
            wind: nearLimb,
            core: true,
            radiativeZone: true,
            tachocline: true,
            convectionZone: true,
          };
          shown = onScreen && placeShown[id];
          /* Set off its anchor outward, which on screen is away from the disc's centre. */
          anchorAt.addScaledVector(
            radial.copy(anchorAt).normalize(),
            NAME_OFFSET_PX * worldPx * away,
          );
        }
        named(id, anchorAt, names && shown);
      }
      f.prominences.slice(0, prominenceTargets.length).forEach((p, index) => {
        directionOf(p.lat, p.lon, dir);
        const r = 1 + p.height * p.lift * 0.5;
        const mesh = prominenceTargets[index]!;
        mesh.position.set(dir[0] * r, dir[1] * r, dir[2] * r);
        mesh.visible = p.fade > 0.05;
      });
      prominenceTargets.slice(f.prominences.length).forEach((mesh) => (mesh.visible = false));
      const eruption = f.eruption;
      const region = eruption ? f.regions.find((r) => r.id === eruption.regionId) : undefined;
      if (eruption && region && eruption.reconnection > 0) {
        directionOf(region.lat, region.lon, dir);
        eruptionAt.set(dir[0], dir[1], dir[2]).multiplyScalar(1 + eruption.sheetBottom);
        eruptionTarget.position.copy(eruptionAt);
        eruptionTarget.visible = true;
      } else eruptionTarget.visible = false;
      flush();
      if (arriving && !rig.flying) {
        arriving = false;
        hooks.landed?.();
      }

      /* Readouts, a few times a second, when they change; the clock and the flare's class with them. */
      const due = readoutDue(dt, invalidated);
      if (due) hooks.publish?.(f.time, f.eruption?.goesClass ?? "", f.cyclePhase);
      if (hooks.onReadout && due) {
        const distance = camera.position.length();
        const readouts: SunReadouts = {
          distance,
          view:
            rig.flying || (drift?.flying ?? false)
              ? view
              : nearestView(SUN_VIEW_IDS, (id) => viewReach(id, f), distance),
          heading: ((Math.round((rig.pose.azimuth * 180) / Math.PI) % 360) + 360) % 360,
          tilt: Math.round((rig.pose.inclination * 180) / Math.PI),
          antialias: antialias ?? defaultSceneAntialias(tight),
        };
        const moved =
          !lastReadouts ||
          Math.abs(Math.log(readouts.distance / lastReadouts.distance)) > 0.01 ||
          readouts.view !== lastReadouts.view ||
          readouts.heading !== lastReadouts.heading ||
          readouts.tilt !== lastReadouts.tilt ||
          readouts.antialias !== lastReadouts.antialias;
        if (moved) {
          lastReadouts = readouts;
          hooks.onReadout(readouts);
        }
      }

      sceneHost.render(() => {
        renderer.render(scene, camera);
        parker.render(renderer);
      });
      /* The new light takes over from the frame just drawn in the old one, which fades over it. */
      if (relightPending) {
        relightPending = false;
        if (ready && !reduceMotion.matches) dissolve.capture();
        prominenceLit = relight(light);
        field.setPresence(RIBBON_PRESENCE[lightKind(light.id)]);
        loop.invalidate();
      }
      dissolve.draw(dt);
      if (!ready) {
        ready = true;
        warmUp(scene);
        hooks.onReady?.();
      }
    };
    let ready = false;
    let lastSharpening = false;

    loop.start({
      render: tick,
      paused: () => !(loop.dirty || continuous()),
      fps: () => quality.resolution.fps,
    });
    loop.refresh();

    api.flyToView = (id) => {
      autoFramed = true;
      views.flyToView(id);
      arriving = true;
      loop.invalidate();
    };
    api.snapToView = (id) => {
      autoFramed = true;
      views.snapToView(id);
    };
    api.turn = (step) => {
      autoFramed = false;
      rig.turnBy(step);
      loop.invalidate();
    };
    /* A hand on the camera ends the view's own framing; the way back gives it back as it was. */
    const orbit = orbitCamera(rig, () => loop.invalidate());
    api.camera = {
      mark: () => {
        const back = orbit.mark();
        const framed = autoFramed;
        return () => {
          back();
          autoFramed = framed;
        };
      },
      zoom: (factor) => {
        autoFramed = false;
        orbit.zoom(factor);
      },
      turn: api.turn,
    };
    api.invalidate = () => loop.invalidate();
    api.driftFlying = () => drift?.flying ?? false;
    api.driftShot = () => drift?.shot ?? -1;
  });
  return { ...api, dispose: engine.dispose };
}

/**
 * The Sun lab's renderer on the toolkit's scene host: the globe (the photosphere and the cut's
 * faces, ray-traced), the field's ribbons, the prominences' volume and the atmosphere, drawn
 * from a frame the model hands over and the settings the store keeps. The engine owns the
 * camera (orbit rig, controls, the seven framings, a drift), the names, the taps and the
 * readouts; it only interpolates (the wedge's facing) and never advances the model itself.
 */
import {
  Group,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Quaternion,
  Scene,
  SphereGeometry,
  Vector3,
} from "three";

import { CARRINGTON_SIDEREAL_RATE } from "@/space/sun/model/rotation";
import {
  nearestView,
  type DriftRunState,
  type DriftSettings,
  type DriftShot,
  type OrbitTurn,
} from "@horizon/toolkit/camera";
import { REDUCED_MOTION_QUERY } from "@horizon/toolkit/environment";
import { wrapSigned, type Vec3 } from "@horizon/toolkit/math";
import {
  setDrawingBufferGamut,
  withScope,
  type SimulationEngine,
} from "@horizon/toolkit/rendering";
import {
  DEFAULT_INSETS,
  createLabels,
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
  FEATURE_ELEVATION_MIN,
  FEATURE_MAX_R,
  FEATURE_MIN_R,
  DISSOLVE_S,
  DRAG_FULL_HEIGHT,
  ERUPTION_PLAY_S,
  GRANULES_PER_RADIUS,
  NAME_DISC_R,
  NAME_FEATURE_PX,
  NAME_LIMB_PX,
  NAME_OFFSET_PX,
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
import { GLOBE_PICK, createGlobeLayer } from "./globe-layer";
import { createSunLooks } from "./looks";
import { createProminenceLayer } from "./prominence-layer";
import { SUN_VIEW_IDS, type SunLight, type SunSceneSettings, type SunViewId } from "./settings";
import { createSkyLayer } from "./sky-layer";
import { createSunMap } from "./sun-map";
import { featuredRegion, viewAim, viewPose, viewReach, viewTurns } from "./views";

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
 * How much of the sky each kind of light shows. The eclipse shows it whole, as totality does;
 * the other lights keep it well in view so the Sun stands in its sky, a little held back in
 * white light, where a camera exposed for the photosphere would in truth see no star at all.
 */
const SKY_EXPOSURE: Readonly<Record<keyof typeof RIBBON_PRESENCE, number>> = {
  white: 0.6,
  halpha: 0.85,
  band: 0.85,
  eclipse: 1,
  magnetogram: 0.85,
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
      onLoad: (texture, width) => {
        renderer.initTexture(texture);
        globe.setMap(texture, width);
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
    /* The orbit's centre: the Sun's, or a feature's (`viewAim`), with the orbit's up the
       surface normal there and azimuth zero standing east; `closeness` eases between the two
       as the view changes, so a flight to a feature swings the orbit onto it. */
    const aimPoint = new Vector3();
    const featureFrame = new Quaternion();
    const CENTRE_FRAME = new Quaternion();
    const basis = new Matrix4();
    const up = new Vector3();
    const east = new Vector3();
    const south = new Vector3();
    let closeness = viewAim(current.view, frame()) ? 1 : 0;
    /** The orbit's centre is on its way between the Sun's centre and a feature. */
    let aiming = false;
    const orbitsFeature = () => closeness >= 0.5;
    const aimAt = (dt: number, f: SunFrame, id: SunViewId) => {
      const target = viewAim(id, f);
      if (target) {
        aimPoint.set(target.point[0], target.point[1], target.point[2]);
        up.set(target.normal[0], target.normal[1], target.normal[2]);
        east.set(-up.z, 0, up.x);
        if (east.lengthSq() < 1e-8) east.set(0, 0, 1);
        east.normalize();
        south.crossVectors(up, east);
        featureFrame.setFromRotationMatrix(basis.makeBasis(south, up, east));
      }
      const wanted = target ? 1 : 0;
      const k = reduceMotion.matches ? 1 : 1 - Math.exp(-dt / AIM_LAG_S);
      const gap = wanted - closeness;
      closeness += gap * k;
      aiming = Math.abs(gap) > 1e-3;
      if (!aiming) closeness = wanted;
    };
    const rig = createOrbitRig(camera, {
      pose: viewPose(current.view, frame(), { azimuth: 0, inclination: 0.1 }),
      limits: () =>
        orbitsFeature()
          ? { min: FEATURE_MIN_R, max: FEATURE_MAX_R }
          : { min: CAMERA_MIN_R, max: CAMERA_MAX_R },
      /* While the orbit's centre moves, limits that change with it never snatch the distance. */
      follow: () => ({ held: false, clamp: !aiming }),
      home: (aim) => aim.copy(aimPoint).multiplyScalar(closeness),
      orient: (_distance, orbit) => orbit.slerpQuaternions(CENTRE_FRAME, featureFrame, closeness),
      reduceMotion,
      nearFloor: 0.002,
      far: () => CAMERA_MAX_R * 4,
    });
    const views = createViewMoves(
      rig,
      (id: SunViewId) => viewPose(id, frame(), rig.pose),
      viewTurns,
    );
    rig.applyPose();
    const controls = createOrbitControls(scope, canvas, rig, {
      invalidate: () => loop.invalidate(),
      /* The input's own bounds span both orbits; the rig clamps to the one it is in. */
      distance: { min: FEATURE_MIN_R, max: CAMERA_MAX_R },
      /* About the centre a drag turns the whole Sun, so near the surface it tightens with
         the camera's height over it, as at the disc view from there out; round a feature
         the turn is about the feature and stays as it is. */
      dragScale: (pose) => {
        const height = (pose.distance - 1) / pose.distance;
        const centre = Math.min(1, Math.max(0, height / DRAG_FULL_HEIGHT));
        return closeness + (1 - closeness) * centre;
      },
      onInput: () => hooks.onInput?.(),
    });
    /** The drift's run: made from its shots as it begins, dropped as it ends. */
    let drift: ReturnType<typeof createRigDrift> | null = null;
    const driftNow = () => {
      const spec = hooks.drift;
      if (!spec) return null;
      if (spec.state() === "off") drift = null;
      else drift ??= createRigDrift(rig, spec.shots(), spec.settings);
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
      if (s.view !== view) {
        view = s.view;
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
      if (closeness < 1 || rig.flying || (drift?.flying ?? false)) return;
      if (rig.pose.inclination < FEATURE_ELEVATION_MIN)
        rig.pose.inclination = FEATURE_ELEVATION_MIN;
    };
    /** The wedge's bisector eases toward the camera's azimuth; true while it moves. */
    let facing = false;
    const faceCamera = (dt: number) => {
      const target = Math.PI / 2 - rig.pose.azimuth;
      const gap = wrapSigned(target - cut.y, Math.PI * 2);
      const k = reduceMotion.matches ? 1 : 1 - Math.exp(-dt / CUT_LAG_S);
      cut.y += gap * k;
      facing = Math.abs(gap) > 1e-3 && cutShown > 0;
    };
    /** The wedge as drawn: it eases open and closed toward the setting; true while it moves. */
    let cutShown = current.cut;
    let cutting = false;
    const openCut = (dt: number) => {
      const gap = current.cut - cutShown;
      const k = reduceMotion.matches ? 1 : 1 - Math.exp(-dt / CUT_LAG_S);
      cutShown += gap * k;
      cutting = Math.abs(gap) > 1e-3;
      if (!cutting) cutShown = current.cut;
      cut.x = cutShown * CUT_HALF_ANGLE;
    };
    /** The camera rides with the Carrington frame; a flight or the drift, which hold the camera, do not, and a feature orbit turns with its feature already. */
    const corotate = (modelSeconds: number) => {
      if (rig.flying || (drift?.flying ?? false) || orbitsFeature()) return;
      const turned = rig.pose.azimuth + CARRINGTON_SIDEREAL_RATE * modelSeconds;
      rig.pose.azimuth = wrapSigned(turned, Math.PI * 2);
    };
    cut.y = Math.PI / 2 - rig.pose.azimuth;
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
      aiming ||
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
      driftNow()?.step(hooks.drift!.state(), dt);
      aimAt(dt, f, view);
      rig.step(dt);
      keepOverHorizon();
      rig.home();
      rig.applyPose();
      faceCamera(dt);
      openCut(dt);

      /* A buffer pixel's world size per unit distance, and the ribbons' half-width in CSS px. */
      const cssPixel = worldPerPixel(camera.fov, 1, viewport.height);
      looks.uniforms.uPixelWorld.value = cssPixel / basics.dpr.value;
      field.setHalfWidth((RIBBON_HALO_PX / 2) * cssPixel);
      looks.setFrame(f);
      body.rotation.y = f.surfaceTurn;
      body.updateMatrixWorld();
      sunMap.update();
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
      for (const id of PLACE_IDS) {
        const anchor = hooks.anchors?.(id) ?? null;
        if (!anchor || flying) {
          named(id, eruptionAt, false);
          continue;
        }
        anchorAt.set(anchor[0], anchor[1], anchor[2]).applyAxisAngle(POLE, f.surfaceTurn);
        const inside = anchorAt.length() < 1 - 1e-3;
        /* A place inside the Sun is named in the cut's gap, at its own depth and latitude. */
        if (inside) {
          const span = Math.hypot(anchorAt.x, anchorAt.z);
          anchorAt.x = span * Math.cos(cut.y);
          anchorAt.z = span * Math.sin(cut.y);
        }
        let shown = inside ? cutShown > NAMED_INSIDE_CUT : !behindSun(anchorAt);
        if (shown && !inside) {
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
            granule: pxOf(1 / GRANULES_PER_RADIUS) > 1,
            sunspot: regionPx > NAME_FEATURE_PX,
            facula: regionPx > NAME_FEATURE_PX,
            photosphere: distance < NAME_DISC_R,
            chromosphere: nearLimb,
            spicule: nearLimb && pxOf(SPICULE_HEIGHT) > 2,
            prominence: nearLimb,
            flare: true,
            loops: regionPx > NAME_FEATURE_PX,
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

      sceneHost.render(() => renderer.render(scene, camera));
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

    loop.start({
      render: tick,
      paused: () => !(loop.dirty || continuous()),
      fps: () => quality.resolution.fps,
    });
    loop.refresh();

    api.flyToView = (id) => {
      views.flyToView(id);
      arriving = true;
      loop.invalidate();
    };
    api.snapToView = (id) => views.snapToView(id);
    api.turn = (step) => {
      rig.turnBy(step);
      loop.invalidate();
    };
    api.invalidate = () => loop.invalidate();
    api.driftFlying = () => drift?.flying ?? false;
    api.driftShot = () => drift?.shot ?? -1;
  });
  return { ...api, dispose: engine.dispose };
}

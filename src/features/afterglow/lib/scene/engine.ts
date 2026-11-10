/**
 * The view from low orbit over a real world: the globe with its measured map drawn by the
 * shared solar close-up (its atmosphere shell, its own depth pass), lit by the Sun's colour and
 * strength from the track, so the day side brightens and reddens as the Sun changes and the
 * night side shows the shared stars; the Sun's globe low over the limb, a sunrise, its
 * photosphere the shared continuum, limb and granulation, framed in a magnified pass that keeps
 * it at the same place on the screen. The engine runs the clock the store sets (playing at the
 * chapter's pace and the tempo, easing to an age it is sent to), moves the view from world to
 * world (a flight that pulls back from one world and comes in on the next as the clock runs or
 * a world is chosen, `model/flight.ts`; a dissolve in place on a scrub; the clock hushed either
 * way), lets the
 * visitor look round, and tells the store where the clock stands, its tempo, the frame's
 * magnification and when a guide step has landed. The disc's size is the framing's alone: it
 * changes only as the Sun's radius does, never by a hand.
 */
import {
  DoubleSide,
  Euler,
  Group,
  Matrix4,
  Mesh,
  PerspectiveCamera,
  PlaneGeometry,
  Points,
  Quaternion,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
  type Texture,
} from "three";

import {
  bridgeRender,
  bridgeStore,
  invalidateOnMotionChange,
  lendCamera,
} from "@/lib/scene-bridge";
import { carrySky, createBrightSky } from "@/space/bright-stars";
import { BRIGHT_STAR_LOOK, createMilkyWay, fieldStars } from "@/space/sky/milky-way";
import { starMaterial } from "@/space/sky/stars";
import { MAP_BASE } from "@/space/solar-system/graphics/maps";
import { createCloseUp } from "@/space/solar-system/scene/close-up";
import { createSolarKit } from "@/space/solar-system/scene/kit";
import { granulesAcross } from "@/space/sun/model/granulation";
import { FIGURES, MOON_IDS, type BodyId } from "@horizon/toolkit/bodies";
import { ORBIT_STEP } from "@horizon/toolkit/camera";
import { REDUCED_MOTION_QUERY } from "@horizon/toolkit/environment";
import { clamp, lerp, smootherstep, smoothstep } from "@horizon/toolkit/math";
import { includesId } from "@horizon/toolkit/records";
import { withScope, type SimulationEngine } from "@horizon/toolkit/rendering";
import {
  GALACTIC_POLE,
  SPACE_BLACK,
  bodyOrientation,
  createSceneHost,
  loadMap,
  type SceneMount,
} from "@horizon/toolkit/scene";
import { AU_KM } from "@horizon/toolkit/science";
import { fullscreenVertex } from "@horizon/toolkit/shaders";

import { dryEarthFile } from "../graphics/dry-earth";
import { lightningMaterial } from "../graphics/lightning";
import { createStarLook, skyUniforms, sunUniforms, viewUniforms } from "../graphics/looks";
import SKY_FRAG from "../graphics/shaders/sky.frag.glsl";
import STAR_FRAG from "../graphics/shaders/star.frag.glsl";
import STAR_VERT from "../graphics/shaders/star.vert.glsl";
import { ageToSlider, paceValue, sliderToAge } from "../model/chapters";
import { TODAY_LOG_Y, displayOf } from "../model/display";
import { angularSize } from "../model/equations";
import {
  FLIGHT_SWAP,
  flightHush,
  flightPlace,
  flightTurn,
  standingPlace,
  type FlightEnd,
  type FlightPlace,
  type FlightView,
  type SeenPlace,
} from "../model/flight";
import { discFrame } from "../model/framing";
import { flashDensity } from "../model/lightning";
import { GLIDE_S, MODES, clockRuns, modeOf, type ModeId } from "../model/modes";
import { nebulaGlow } from "../model/nebula";
import { earthDryness } from "../model/oceans";
import { advancePlay, tempoAt } from "../model/pacing";
import {
  BLOOM,
  DAY_GAMMA,
  FADE_TEMPO,
  FLIGHT_POINTS,
  FLIGHT_TURN_ACROSS,
  FOV_DEG,
  FRAME_FROM_PX,
  FRAMING_DOUBLING_S,
  HORIZON_BAND,
  HORIZON_SHARE,
  LIGHTNING,
  LOOK_DAMP_S,
  MILKY_WAY_PHASE,
  MILKY_WAY_TILT,
  NEBULA_SKYLIGHT,
  ORBIT_RADII,
  POINT_CAP,
  POINT_GAIN,
  STARS_OUT,
  SUN_ACROSS,
  SUN_IN_FRAME,
  SUN_LIFT,
  SPIN,
  SUN_OVER_WORLD,
  SWAY_EASE_S,
  VANISH_PX,
  VANTAGE_FADE_S,
  AGE_FLIGHT_S,
} from "../model/parameters";
import { sunAt } from "../model/sun";
import { TOUR, type TourStep } from "../model/tour";
import { END_AGE } from "../model/track";
import { WORLDS, orbitAt, type WorldBody, type WorldId } from "../model/worlds";
import { afterglowQuality } from "../quality";
import { useAfterglow, type AfterglowStore } from "../store";
import { createLookInput } from "./look-input";
import { createVeil } from "./veil";

/** The store hears the clock this often while it runs, seconds. */
const PUBLISH_S = 1 / 30;
/** The magnification is republished once it has changed this much, the tempo likewise. */
const MAGNIFICATION_STEP = 0.02;
const TEMPO_STEP = 0.01;
/** The view counts as settled on its aim within these (radians, share of the height), the globe's turn as stopped below this rate. */
const SETTLED = { yaw: 1e-4, horizon: 1e-4, spin: 1e-3 } as const;
/** A globe's pole in its own frame: the figure's polar axis, which it turns about. */
const POLE = new Vector3(0, 1, 0);
/** The Sun's globe draws in a depth pass of its own. */
const SUN_LAYER = 3;
/** The globes' orientation, fixed at J2000: which face the map shows. */
const BODY_EPOCH = new Date(Date.UTC(2000, 0, 1, 12));
/** Where the world stands from the Sun (the origin), scene units au; and the pole the orbit's place is measured from. */
const WORLD_DIRECTION = new Vector3(1, 0, 0);
const NORTH = new Vector3(0, 1, 0);
/** Across the line from the Sun and north: a camera on its side sees the world right of the Sun (`model/flight.ts`). */
const ACROSS = new Vector3().crossVectors(WORLD_DIRECTION, NORTH);

const DEG = Math.PI / 180;

/**
 * The view: the yaw off the resting view (radians, right) and where the limb sits as a share of
 * the view's height from the top (null: where the aspect puts it).
 */
type Look = { yaw: number; horizon: number | null };

/** Where the vantage stands: its distance from the Sun and its globe's equatorial radius, au. */
type Vantage = FlightEnd;
/** How far the horizon dips below the level from the orbit's height. */
const DIP = Math.acos(1 / ORBIT_RADII);

function vantageOf(world: WorldId, mass: number): Vantage {
  const { orbit, body } = WORLDS[world];
  return {
    distance: orbitAt(orbit, mass),
    radius: FIGURES[body.id].equatorialKm / AU_KM,
  };
}

export type AfterglowEngineOptions = {
  /** Measured maps already decoded (the bench's), shown from the first frame. */
  measured?: ReadonlyMap<BodyId, Texture>;
  /** The dry Earth already decoded (the bench's); otherwise it is fetched as the scene starts. */
  dryEarth?: Texture;
  /** Filled in place each frame with what the frame showed (the bench's trace); untouched when absent. */
  trace?: AfterglowTrace;
};

/** What a frame showed: the world and the camera, the Sun's size and place on the screen, the light. */
export type AfterglowTrace = Record<string, number | string | boolean>;

export function createAfterglowEngine(
  { canvas, host, onError }: SceneMount,
  options: AfterglowEngineOptions = {},
): SimulationEngine {
  return withScope((scope) => {
    const sceneHost = createSceneHost(scope, { canvas, host, onError, clearColor: SPACE_BLACK });
    const { renderer, camera, engine, tight, basics, viewport, warmUp } = sceneHost;
    const store = useAfterglow;
    let quality = afterglowQuality(store.getState().quality, tight);
    sceneHost.setResolution(quality.resolution);
    sceneHost.setBloom({ enabled: store.getState().bloom, ...quality.bloom, ...BLOOM });
    sceneHost.setLens({ enabled: store.getState().lens, ...quality.lens });
    const reduceMotion = window.matchMedia(REDUCED_MOTION_QUERY);
    invalidateOnMotionChange(scope, engine, reduceMotion);

    /* ------------------------------------------------------------ layers */
    const scene = new Scene();
    const view = viewUniforms();
    const sun = sunUniforms();
    const sky = skyUniforms();
    const uniforms = { ...view, ...sun, ...sky };
    const quad = scope.own(new PlaneGeometry(2, 2));
    const skyMaterial = scope.own(
      new ShaderMaterial({
        uniforms,
        vertexShader: fullscreenVertex,
        fragmentShader: SKY_FRAG,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    const skyMesh = new Mesh(quad, skyMaterial);
    skyMesh.frustumCulled = false;
    skyMesh.renderOrder = -5;
    /* The Milky Way, the shared bright stars and a faint field, on the camera, after the sky's light. */
    const starLook = scope.own(starMaterial(basics.dpr));
    const milkyWay = scope.own(
      createMilkyWay(quality.sky.milkyWay, {
        grain: () => starMaterial(basics.dpr),
        eras: "today",
        wake: () => engine.invalidate(),
      }),
    );
    const bright = createBrightSky(scope, starLook, BRIGHT_STAR_LOOK);
    const field = new Points(fieldStars(quality.sky.fieldStars), starLook);
    scope.defer(() => field.geometry.dispose());
    field.renderOrder = -2;
    field.frustumCulled = false;
    const stars = new Group();
    stars.add(milkyWay.group, bright, field);
    /* The Sun's globe at the origin, in its own pass: its photosphere from the shared tables. */
    const starLookup = createStarLook(scope);
    starLookup.uniforms.uRefLogY.value = TODAY_LOG_Y;
    const starMesh = new Mesh(
      scope.own(new SphereGeometry(1, 128, 80)),
      scope.own(
        new ShaderMaterial({
          uniforms: starLookup.uniforms,
          vertexShader: STAR_VERT,
          fragmentShader: STAR_FRAG,
          side: DoubleSide,
          toneMapped: false,
        }),
      ),
    );
    starMesh.layers.set(SUN_LAYER);
    starMesh.frustumCulled = false;
    /* The world's globe, drawn by the shared close-up with its measured map, shell and depth pass. */
    const kit = createSolarKit(basics, "streamed");
    const { looks } = kit;
    looks.setAirSteps(quality.closeUp.airSteps);
    for (const [id, texture] of options.measured ?? []) looks.setMeasured(id, texture);
    const globe = new Mesh(scope.own(new SphereGeometry(1, 128, 80)), looks.planets.earth);
    /*
     * Earth once its oceans go (`model/oceans.ts`): the modelled dry map blends in over the
     * measured one as the water leaves, and the ocean glint fades with it.
     */
    const earth = looks.planets.earth;
    const glintAtStart: unknown = earth.uniforms.specStrength?.value;
    const earthGlint = typeof glintAtStart === "number" ? glintAtStart : 0;
    /* Until the dry map is in, Earth keeps today's seas. */
    let dryEarthReady = false;
    const showDryEarth = (texture: Texture) => {
      renderer.initTexture(texture);
      earth.uniforms.laterMap!.value = texture;
      dryEarthReady = true;
      engine.invalidate();
    };
    if (options.dryEarth) showDryEarth(options.dryEarth);
    else {
      const loading = new AbortController();
      scope.defer(() => loading.abort());
      const tier = quality.closeUp.light ? "nearLight" : "near";
      loadMap(dryEarthFile(MAP_BASE, tier), loading.signal)
        .then((texture) => {
          /* Disposed while it decoded: nothing to show it on. */
          if (loading.signal.aborted) {
            texture.dispose();
            return;
          }
          scope.own(texture);
          showDryEarth(texture);
        })
        .catch(() => undefined);
    }
    /*
     * Lightning in Earth's storms (`model/lightning.ts`): light at the cloud tops, on the
     * globe's own sphere so it turns with it, drawn before the air shell so the air dims it.
     * Hidden unless Earth is under the camera and there is something to flash.
     */
    const lightning = new Mesh(globe.geometry, scope.own(lightningMaterial()));
    lightning.scale.setScalar(1 + LIGHTNING.cloudTopKm / FIGURES.earth.equatorialKm);
    lightning.renderOrder = -1;
    lightning.visible = false;
    globe.add(lightning);
    const sunFromGlobe = new Quaternion();
    scene.add(skyMesh, stars, starMesh, globe);
    const worldPos = new Vector3();
    const closeUp = createCloseUp(kit, {
      rig: {
        pose: { azimuth: 0, inclination: 0, distance: 1 },
        aim: new Vector3(),
        cancel: () => undefined,
      },
      reduceMotion,
      invalidate: () => engine.invalidate(),
      locate: (_sel, out) => out.copy(worldPos),
      objectsOf: () => [globe],
      hostOf: () => [],
      reachOf: () => 0,
      onTakeCamera: () => undefined,
      onRelease: () => undefined,
      upload: (texture) => renderer.initTexture(texture),
      quality: () => quality.closeUp,
      card: () => false,
    });
    const materialOf = (body: WorldBody) => {
      switch (body.kind) {
        case "planet":
          return looks.planets[body.id];
        case "named":
          return looks.named[body.id];
        case "moon":
          return looks.moon(body.id);
      }
    };
    /** The globe's orientation as its world stands, before its turn (`SPIN`); the turn, radians; and its rate, 0–1. */
    const posed = new Quaternion();
    const spin = { angle: 0, rate: 0 };
    const turned = new Quaternion();
    const turnGlobe = () =>
      globe.quaternion.copy(posed).multiply(turned.setFromAxisAngle(POLE, spin.angle));
    /** Puts a world's globe under the camera: its material, figure and orientation, and the close-up on it. */
    const standOn = (world: WorldId) => {
      const { body } = WORLDS[world];
      const figure = FIGURES[body.id];
      globe.material = materialOf(body);
      globe.scale.set(
        figure.equatorialKm / AU_KM,
        figure.polarKm / AU_KM,
        figure.equatorialKm / AU_KM,
      );
      if (includesId(MOON_IDS, body.id)) posed.identity();
      else bodyOrientation(body.id, BODY_EPOCH, posed);
      turnGlobe();
      closeUp.start(body);
    };

    /* ------------------------------------------------------------ camera */
    const tanHalf = (fov: number) => Math.tan((fov * DEG) / 2);
    /** The pitch that puts the level at a share of the view's height from the top. */
    const pitchFor = (share: number, fov: number) => Math.atan((2 * share - 1) * tanHalf(fov));
    /** Where the limb sits with no tilt: about a third up the view in either aspect. */
    const restingShare = () =>
      camera.aspect >= 1 ? HORIZON_SHARE.landscape : HORIZON_SHARE.portrait;
    /** The yaw that puts the Sun at its share of the view's width: the resting view, whatever the aspect. */
    const restingYaw = (fov: number) =>
      Math.atan((2 * SUN_ACROSS - 1) * tanHalf(fov) * camera.aspect);
    /** The view as drawn, and where it is headed: every hand, key and step moves the aim, the view follows it smoothly. */
    const look: Look = { yaw: 0, horizon: null };
    const aimLook: Look = { yaw: 0, horizon: null };
    /** The most a turn may take the Sun off the view's centre, either way: it never leaves the frame. */
    const yawReach = () => Math.atan(SUN_IN_FRAME * tanHalf(FOV_DEG.open) * camera.aspect);
    const clampLook = (l: Look) => {
      const resting = restingYaw(FOV_DEG.open);
      l.yaw = clamp(l.yaw, -yawReach() - resting, yawReach() - resting);
      if (l.horizon !== null) l.horizon = clamp(l.horizon, HORIZON_BAND.top, HORIZON_BAND.bottom);
      return l;
    };
    /**
     * A framing the mode sets (a guide step's shot): the view glides from where it was to the
     * aim, easing in and out over `GLIDE_S`; a hand on the view takes it over at once.
     */
    let glide: { from: Look; t: number } | null = null;
    const aimAt = (next: Partial<Look>) => {
      glide = null;
      clampLook(Object.assign(aimLook, next));
      if (reduceMotion.matches) Object.assign(look, aimLook);
      engine.invalidate();
    };
    const glideTo = (next: Look) => {
      clampLook(Object.assign(aimLook, next));
      if (reduceMotion.matches) Object.assign(look, aimLook);
      else glide = { from: { ...look }, t: 0 };
      engine.invalidate();
    };
    /** The limb's share a tilt of `pitch` radians up from the aim's puts it at: a tilt up moves the limb down the view. */
    const tilted = (pitch: number) =>
      (aimLook.horizon ?? restingShare()) + Math.tan(pitch) / (2 * tanHalf(FOV_DEG.open));
    const settled = () =>
      Math.abs(look.yaw - aimLook.yaw) < SETTLED.yaw &&
      Math.abs((look.horizon ?? restingShare()) - (aimLook.horizon ?? restingShare())) <
        SETTLED.horizon;
    /** The view one frame nearer its aim; it lands exactly once it is there. */
    const followAim = (dt: number) => {
      clampLook(aimLook);
      if (glide) {
        glide.t = Math.min(1, glide.t + dt / GLIDE_S);
        const f = smootherstep(glide.t);
        const { from } = glide;
        look.yaw = lerp(from.yaw, aimLook.yaw, f);
        look.horizon =
          glide.t >= 1
            ? aimLook.horizon
            : lerp(from.horizon ?? restingShare(), aimLook.horizon ?? restingShare(), f);
        if (glide.t >= 1) glide = null;
        return;
      }
      if (settled()) {
        Object.assign(look, aimLook);
        return;
      }
      const k = 1 - Math.exp(-dt / LOOK_DAMP_S);
      look.yaw = lerp(look.yaw, aimLook.yaw, k);
      look.horizon =
        aimLook.horizon === null && look.horizon === null
          ? null
          : lerp(look.horizon ?? restingShare(), aimLook.horizon ?? restingShare(), k);
    };
    const REST: Look = { yaw: 0, horizon: null };
    /** The framing for a disc of `radius` radians that is `solarRadii` R☉ (`discFrame`), opened to the open view for a point. */
    const framingFor = (radius: number, solarRadii: number) => {
      const diameter = (2 * radius) / DEG;
      const framed = discFrame(radius, solarRadii);
      /* A point has nothing to frame: the view stays open; a disc a few pixels wide in the narrowest frame is framed in full. */
      const pixels = (diameter / FOV_DEG.min) * viewport.height * basics.dpr.value;
      const resolved = smoothstep(FRAME_FROM_PX[0], FRAME_FROM_PX[1], pixels);
      return Math.exp(lerp(Math.log(FOV_DEG.open), Math.log(framed), resolved));
    };
    /** A guide step's shot as a view: the Sun at its share across, the limb at its share down. */
    const lookOf = ({ shot }: TourStep): Look => ({
      yaw:
        shot.across === undefined
          ? 0
          : Math.atan((2 * shot.across - 1) * tanHalf(FOV_DEG.open) * camera.aspect) -
            restingYaw(FOV_DEG.open),
      horizon: shot.horizon ?? null,
    });
    /**
     * The frame follows the framed value with lag, by at most a factor of two every
     * `FRAMING_DOUBLING_S`: a Sun that grows or shrinks faster visibly does so against the
     * slowly following frame, and never sits as a speck or an overflow for longer.
     */
    let framing = Number.NaN;
    /** `exact`: the frame follows its law at once, as along a flight, where the Sun's width changes smoothly but fast. */
    const settleFraming = (dt: number, solarRadii: number, exact: boolean) => {
      const goalFov = framingFor(uniforms.uSunRadius.value, solarRadii);
      if (exact || Number.isNaN(framing) || reduceMotion.matches) {
        framing = goalFov;
        return;
      }
      const most = (Math.LN2 * dt) / FRAMING_DOUBLING_S;
      framing = Math.exp(Math.log(framing) + clamp(Math.log(goalFov / framing), -most, most));
    };
    /* Looking round leaves the clock running: the life plays on while the visitor looks. */
    scope.defer(
      createLookInput(canvas, {
        turn: (yaw, pitch) => aimAt({ yaw: aimLook.yaw + yaw, horizon: tilted(pitch) }),
        reset: () => aimAt(REST),
        perPixel: () => (FOV_DEG.open * DEG) / Math.max(1, viewport.height),
        enabled: () => !store.getState().helpOpen,
      }),
    );
    scope.defer(
      lendCamera(store, {
        mark: () => {
          const kept = { ...aimLook };
          return () => aimAt(kept);
        },
        turn: (step) =>
          aimAt({
            yaw: aimLook.yaw - step.azimuth * ORBIT_STEP,
            horizon: tilted(step.inclination * ORBIT_STEP),
          }),
      }),
    );
    /* The disc's own camera: the same place, a narrower view, the Sun at the same point on the screen. */
    const discCamera = new PerspectiveCamera(FOV_DEG.open, 1, camera.near, camera.far);
    discCamera.layers.set(SUN_LAYER);
    const up = new Vector3();
    const sunDir = new Vector3();
    const forward = new Vector3();
    const back = new Vector3();
    const side = new Vector3();
    const basis = new Matrix4();
    const basisQ = new Quaternion();
    const turnQ = new Quaternion();
    const euler = new Euler();
    const local = new Vector3();
    const target = new Vector3();
    const discAxis = new Vector3();
    const probe = new Vector3();
    /**
     * Points the disc camera so the Sun lands where the wide view puts it (`ndc`): the pitch
     * about the local level that gives the Sun its elevation, then the yaw that gives it its
     * bearing, both in the orbit's local frame (`basisQ`).
     */
    const aimDisc = (ndc: { x: number; y: number }, fov: number, sunRadius: number) => {
      const tanV = tanHalf(fov);
      target.set(ndc.x * tanV * camera.aspect, ndc.y * tanV, -1).normalize();
      local.copy(sunDir).applyQuaternion(turnQ.copy(basisQ).invert());
      const reach = Math.max(Math.hypot(target.y, target.z), 1e-6);
      const pitch = Math.asin(clamp(local.y / reach, -1, 1)) - Math.atan2(target.y, -target.z);
      const turnedZ = target.y * Math.sin(pitch) + target.z * Math.cos(pitch);
      const yaw = Math.atan2(local.x, local.z) - Math.atan2(target.x, turnedZ);
      discCamera.quaternion
        .copy(basisQ)
        .multiply(turnQ.setFromEuler(euler.set(pitch, yaw, 0, "YXZ")));
      discCamera.position.copy(camera.position);
      /*
       * Its depth range just holds the Sun's globe, `sunRadius` au, measured along its own view
       * axis: a giant seen off the axis comes nearer that axis's plane than its distance says,
       * and a range from the distance alone cuts a hole in its near side.
       */
      const to = discCamera.position.length();
      const along = -discCamera.position.dot(
        discAxis.set(0, 0, -1).applyQuaternion(discCamera.quaternion),
      );
      discCamera.near = Math.max(to * 1e-4, (along - sunRadius) * 0.8);
      discCamera.far = along + sunRadius;
      discCamera.fov = fov;
      discCamera.aspect = camera.aspect;
      discCamera.updateProjectionMatrix();
      discCamera.updateMatrixWorld();
    };
    /** The Sun's height over the limb in the open view, radians: `SUN_LIFT` of the view's height. */
    const sunOverLimb = () => {
      const rest = restingShare();
      return pitchFor(rest, FOV_DEG.open) - pitchFor(rest - SUN_LIFT, FOV_DEG.open);
    };
    /** A pixel of the open view, radians. */
    const pixelAngle = () =>
      (2 * tanHalf(FOV_DEG.open)) / Math.max(1, viewport.height * basics.dpr.value);
    /** Where a share of the open view (from its top left) lies from the Sun: how far, and how far round from below it. */
    const seenAt = (point: { across: number; down: number }): SeenPlace => {
      const below =
        pitchFor(point.down, FOV_DEG.open) - pitchFor(restingShare() - SUN_LIFT, FOV_DEG.open);
      const beside =
        Math.atan((2 * point.across - 1) * tanHalf(FOV_DEG.open) * camera.aspect) -
        restingYaw(FOV_DEG.open);
      return { apart: Math.hypot(below, beside), roll: Math.atan2(beside, below) };
    };
    /**
     * The furthest the camera turns through a flight, radians (positive: left, after the world
     * left): what takes the Sun to its place across the turned view, and less as the disc's own
     * frame is wider than the open view, where a turn would stretch a giant off the lens's axis.
     */
    const turnReach = () => {
      const whole =
        Math.atan((2 * FLIGHT_TURN_ACROSS - 1) * tanHalf(FOV_DEG.open) * camera.aspect) -
        restingYaw(FOV_DEG.open);
      return Number.isNaN(framing) ? whole : whole * Math.min(1, FOV_DEG.open / framing) ** 2;
    };
    /** The view a flight keeps: the Sun over the limb, the distance a globe vanishes at, and where the worlds stand once small. */
    const flightView = (): FlightView => ({
      lift: sunOverLimb(),
      gone: 2 / (VANISH_PX * pixelAngle()),
      leave: seenAt(FLIGHT_POINTS.leave),
      arrive: seenAt(FLIGHT_POINTS.arrive),
    });
    /**
     * The view's frame at an orbit's height, facing the Sun in direction `towardSun`: up, the
     * level toward the Sun, and the side, with the Sun `sunOverLimb` over the limb. Written into
     * `sunDir`, `up`, `forward` and `side`.
     */
    const orbitFrame = (towardSun: Vector3) => {
      const elevation = -DIP + sunOverLimb();
      sunDir.copy(towardSun);
      up.copy(NORTH).addScaledVector(sunDir, -NORTH.dot(sunDir)).normalize();
      up.multiplyScalar(Math.cos(elevation)).addScaledVector(sunDir, Math.sin(elevation));
      forward.copy(sunDir).addScaledVector(up, -sunDir.dot(up)).normalize();
      side.crossVectors(forward, up).normalize();
    };
    /* The sky's one fixed turn: the Milky Way's plane through the resting view's centre, tilted from the level. */
    orbitFrame(probe.copy(WORLD_DIRECTION).negate());
    stars.quaternion.setFromUnitVectors(
      GALACTIC_POLE,
      probe
        .copy(up)
        .multiplyScalar(Math.cos(MILKY_WAY_TILT))
        .addScaledVector(side, Math.sin(MILKY_WAY_TILT))
        .normalize(),
    );
    /* ------------------------------------------------------------ clock and vantage */
    /*
     * The clock opens where the store stands. An age it was sent to before the scene was up (the
     * chapter a visit's address names) has nowhere to ease from: the clock opens there, and the
     * store hears it has arrived with the first frame.
     */
    const opening = store.getState();
    let age = opening.aim ?? opening.age;
    let published = opening.age;
    let sincePublish = 0;
    /** An age the clock eases to, along the track so the playhead glides evenly; null at rest. */
    let aim: { from: number; to: number; t: number } | null = null;
    /** The clock stands at an aim it was sent to without a flight: the store hears it has arrived. */
    let arrivedAtOnce = opening.aim !== null;
    let world = opening.world;
    let vantage = vantageOf(world, sunAt(age).mass);
    /** Where a flight has the camera (`model/flight.ts`); null at rest. */
    let flown: FlightPlace | null = null;
    /**
     * A move to another world: the world it is to be, swapped in once this frame has been drawn
     * and laid over the canvas as a still, and the dissolve from that still, 0 to 1.
     */
    let nextWorld: WorldId | null = null;
    let dissolve: number | null = null;
    const veil = createVeil(canvas);
    scope.defer(() => veil.dispose());
    /** A flight to another world (`model/flight.ts`): where it leaves from, where it goes, its progress 0–1. */
    let flight: { from: WorldId; to: WorldId; t: number; seconds: number } | null = null;
    /**
     * The clock's hush while the world changes: through a dissolve slow as it begins and the
     * chapter's pace as it ends; through a flight slowest at its middle.
     */
    const hushNow = () => {
      if (flight) return flightHush(flight.t);
      return dissolve === null ? 1 : lerp(FADE_TEMPO, 1, smootherstep(dissolve));
    };
    let time = 0;
    /** The mode the scene plays in (`model/modes.ts`): its camera, its changes of world, its sway. */
    let mode: ModeId = modeOf(store.getState());
    /** The sway's phases, radians, run only while the clock does; its reach eases to the mode's. */
    const swayPhase = { across: 0, horizon: 0 };
    const swayReach = { ...MODES[mode].sway };
    /** The guide step whose shot the view was given, and the view the visitor had before the guide. */
    let shotStep = -1;
    let beforeGuide: Look | null = null;
    let magnification = -1;
    let tempo = -1;
    let fading = false;
    standOn(world);
    store.getState().setDrawn(world);

    const startAim = (to: number) => {
      if (to === age || reduceMotion.matches) {
        age = to;
        aim = null;
        arrivedAtOnce = true;
        return;
      }
      aim = { from: age, to, t: 0 };
    };
    /** The world under the camera changes: the frame takes up the new distance at once, so the disc keeps its size. */
    const swapWorld = (next: WorldId) => {
      world = next;
      standOn(world);
      framing = Number.NaN;
      store.getState().setDrawn(world);
    };
    /**
     * A new world for the view: flown to while the clock runs, a world is chosen or the clock
     * eases to an aim; dissolved to when the timeline is scrubbed on the schedule, or when a flight
     * is already under way; at once under reduced motion.
     */
    const changeWorld = (s: AfterglowStore) => {
      const next = s.world;
      if (next === (nextWorld ?? flight?.to ?? world)) return;
      if (reduceMotion.matches) {
        nextWorld = null;
        flight = null;
        swapWorld(next);
        return;
      }
      const style = MODES[modeOf(s)];
      const flies = clockRuns(s) || aim !== null || s.aim !== null || !s.auto;
      if (
        style.change === "flight" &&
        flies &&
        flight === null &&
        nextWorld === null &&
        dissolve === null
      ) {
        flight = { from: world, to: next, t: 0, seconds: style.flightS };
      } else {
        flight = null;
        nextWorld = next;
      }
      engine.invalidate();
    };

    /**
     * The mode's camera: the guide keeps the visitor's view and frames each step's shot,
     * giving the view back as it ends; the drift opens on the resting view and sways from there.
     */
    const changeMode = (s: AfterglowStore) => {
      const next = modeOf(s);
      if (next === "guide" && s.guideStep !== shotStep) {
        if (beforeGuide === null) beforeGuide = { ...aimLook };
        shotStep = s.guideStep;
        const step = TOUR[s.guideStep];
        if (step) glideTo(lookOf(step));
      }
      if (next === mode) return;
      if (mode === "guide") {
        shotStep = -1;
        glideTo(beforeGuide ?? REST);
        beforeGuide = null;
      }
      if (next === "drift") glideTo(REST);
      mode = next;
    };

    const bridge = bridgeStore(store, scope, {
      invalidate: () => engine.invalidate(),
      before: (s) => {
        /* An age the visitor set (the timeline's drag) takes the clock there at once. */
        if (s.age !== published) {
          age = s.age;
          published = age;
          aim = null;
        }
        changeMode(s);
        changeWorld(s);
      },
      turn: () => undefined,
      fly: (s) => {
        if (s.aim !== null) startAim(s.aim);
      },
    });
    bridgeRender(store, scope, sceneHost, (level) => {
      const next = afterglowQuality(level, tight);
      sceneHost.setResolution(next.resolution);
      sceneHost.setBloom({ enabled: store.getState().bloom, ...next.bloom, ...BLOOM });
      sceneHost.setLens({ enabled: store.getState().lens, ...next.lens });
      if (next.sky.fieldStars !== quality.sky.fieldStars) {
        field.geometry.dispose();
        field.geometry = fieldStars(next.sky.fieldStars);
      }
      if (next.sky.milkyWay !== quality.sky.milkyWay) milkyWay.setGrains(next.sky.milkyWay);
      quality = next;
      looks.setAirSteps(next.closeUp.airSteps);
      closeUp.refilter();
      engine.invalidate();
    });

    /** The clock and the world's change, one frame on; the Sun at the new age. */
    const advance = (dt: number) => {
      const s = store.getState();
      let arrived = arrivedAtOnce;
      arrivedAtOnce = false;
      if (aim) {
        aim.t = Math.min(1, aim.t + dt / AGE_FLIGHT_S);
        const f = smootherstep(aim.t);
        age =
          aim.t >= 1 ? aim.to : sliderToAge(lerp(ageToSlider(aim.from), ageToSlider(aim.to), f));
        if (aim.t >= 1) {
          aim = null;
          arrived = true;
        }
      } else if (clockRuns(s)) {
        /* The clock hushes while the world changes, so one thing happens at a time. */
        age = advancePlay(age, dt, paceValue(s.pace), hushNow());
        if (age >= END_AGE) s.setPlaying(false);
      }
      if (dissolve !== null) {
        dissolve = Math.min(1, dissolve + dt / VANTAGE_FADE_S);
        veil.show(1 - smootherstep(dissolve));
        if (dissolve >= 1) {
          dissolve = null;
          veil.clear();
        }
      }
      const sun = sunAt(age);
      if (flight) {
        flight.t = Math.min(1, flight.t + dt / flight.seconds);
        /* Halfway the globes change, the world left and the next both out of the view. */
        if (flight.t >= FLIGHT_SWAP && world !== flight.to) swapWorld(flight.to);
        const from = vantageOf(flight.from, sun.mass);
        const to = vantageOf(flight.to, sun.mass);
        flown = flightPlace(flight.t, from, to, flightView());
        vantage = world === flight.to ? to : from;
        if (flight.t >= 1) {
          flight = null;
          flown = null;
        }
      } else {
        vantage = vantageOf(world, sun.mass);
        /* A flight broken off for a dissolve holds its place until the still is taken. */
        if (nextWorld === null) flown = null;
      }
      /* The store hears the clock a few times a frame apart, and at once when it arrives. */
      sincePublish += dt;
      if (age !== published && (arrived || sincePublish >= PUBLISH_S)) {
        published = age;
        sincePublish = 0;
        s.tick(age, arrived);
      } else if (arrived) s.tick(age, true);
      const changing = nextWorld !== null || dissolve !== null || flight !== null;
      if (s.guideOpen && !s.guideLanded && aim === null && !changing) s.landGuide();
      /* The playhead's speed against the chapters' pace, for the timeline's glow. */
      const now = tempoAt(ageToSlider(age)) * hushNow();
      if (Math.abs(now - tempo) > TEMPO_STEP) {
        tempo = now;
        s.setTempo(now);
      }
      return sun;
    };

    const moving = () =>
      aim !== null ||
      nextWorld !== null ||
      dissolve !== null ||
      flight !== null ||
      !settled() ||
      clockRuns(store.getState()) ||
      closeUp.busy() ||
      spin.rate > SETTLED.spin ||
      fading;

    const tick = (dt: number) =>
      bridge.frame(() => {
        time += dt;
        /* The Sun now: its size frames the disc; its light exposes the display. */
        const state = advance(dt);
        const s = store.getState();
        followAim(dt);
        /*
         * The camera sways while the clock runs, so nothing sits still, by the mode's reach
         * (eased to, so a new mode never jolts) and calmed through a flight's middle, as the
         * visitor's own turn of the view is: there the camera's turn is the flight's alone
         * (`flightTurn`), which the worlds' far places are laid out against.
         */
        const { sway } = MODES[mode];
        const running = clockRuns(s) && !reduceMotion.matches;
        if (running) {
          swayPhase.across += (2 * Math.PI * dt) / sway.acrossPeriod;
          swayPhase.horizon += (2 * Math.PI * dt) / sway.horizonPeriod;
        }
        const ease = 1 - Math.exp(-dt / SWAY_EASE_S);
        swayReach.across = lerp(swayReach.across, sway.across, ease);
        swayReach.horizon = lerp(swayReach.horizon, sway.horizon, ease);
        const calm = flight ? 1 - Math.sin(Math.PI * flight.t) ** 2 : 1;
        const flightYaw = flight ? turnReach() * flightTurn(flight.t) : 0;
        const swayYaw = calm * swayReach.across * yawReach() * Math.sin(swayPhase.across);
        const swayHorizon = calm * swayReach.horizon * Math.sin(swayPhase.horizon);
        /* The world turns while the clock runs (`SPIN`), taken up and let go as it starts and stops. */
        spin.rate = lerp(spin.rate, running ? 1 : 0, 1 - Math.exp(-dt / SPIN.easeS));
        spin.angle += spin.rate * SPIN.degPerS * DEG * dt;
        turnGlobe();
        starLookup.set(state.teff, state.logg);
        /*
         * The camera: over the world, the Sun just over the limb (`standingPlace`), or along a
         * flight; and the view's frame there, facing the Sun as seen from it.
         */
        const place = flown ?? standingPlace(vantage, ORBIT_RADII * vantage.radius, sunOverLimb());
        camera.position
          .copy(WORLD_DIRECTION)
          .multiplyScalar(place.x)
          .addScaledVector(NORTH, place.y)
          .addScaledVector(ACROSS, place.z);
        const fromSun = camera.position.length();
        orbitFrame(probe.copy(camera.position).negate().normalize());
        worldPos.copy(WORLD_DIRECTION).multiplyScalar(vantage.distance);
        globe.position.copy(worldPos);
        /* The Sun is seen from where the camera is. */
        uniforms.uSunRadius.value = angularSize.compute({ R: state.radiusAu, d: fromSun }) / 2;
        settleFraming(dt, state.radius, flown !== null);
        const fov = framing;
        if (camera.fov !== FOV_DEG.open) {
          camera.fov = FOV_DEG.open;
          camera.updateProjectionMatrix();
        }
        basis.makeBasis(side, up, back.copy(forward).negate());
        basisQ.setFromRotationMatrix(basis);
        /* The wide view: the limb at its share of the height, the Sun at its share of the width. */
        const share = (look.horizon ?? restingShare()) + swayHorizon;
        camera.quaternion
          .copy(basisQ)
          .multiply(
            turnQ.setFromEuler(
              euler.set(
                pitchFor(share, FOV_DEG.open) - DIP,
                restingYaw(FOV_DEG.open) + calm * look.yaw + swayYaw + flightYaw,
                0,
                "YXZ",
              ),
            ),
          );
        camera.updateMatrixWorld();
        const m = camera.matrixWorld.elements;
        view.uRight.value.set(m[0], m[1], m[2]);
        view.uUp.value.set(m[4], m[5], m[6]);
        view.uForward.value.set(-m[8], -m[9], -m[10]);
        const tanWide = tanHalf(FOV_DEG.open);
        view.uTan.value.set(tanWide * camera.aspect, tanWide);
        const pixelsTall = Math.max(1, viewport.height * basics.dpr.value);
        uniforms.uPixel.value = pixelAngle();
        uniforms.uDiscPixel.value = (2 * tanHalf(fov)) / pixelsTall;
        /* The Sun's direction from here, and the disc's frame about where the wide view puts it. */
        uniforms.uSunDirWide.value.copy(sunDir);
        probe.copy(sunDir).add(camera.position).project(camera);
        aimDisc(probe, fov, state.radiusAu);
        const magnified = FOV_DEG.open / fov;
        carrySky(stars, camera, 1);
        /* The frame's magnification, for the HUD. */
        if (Math.abs(magnified - magnification) > MAGNIFICATION_STEP) {
          magnification = magnified;
          s.setMagnification(magnified);
        }

        /* The light: the globe's day side exposes the display; the Sun's globe and a point Sun follow it. */
        /* The eye adapts to the field: the disc's share of the open view's height, squared. */
        const fill = (uniforms.uSunRadius.value / ((FOV_DEG.open / 2) * DEG)) ** 2;
        const display = displayOf(state.teff, state.radiusAu, fromSun, fill);
        const nebula = nebulaGlow(age, state.teff);
        const day = display.day;
        const dryness = dryEarthReady ? earthDryness(age) : 0;
        earth.uniforms.later!.value = dryness;
        earth.uniforms.specStrength!.value = earthGlint * (1 - dryness);
        const surface = globe.material;
        if (surface instanceof ShaderMaterial) {
          surface.uniforms.sunlight?.value.set(
            display.tint[0] * day,
            display.tint[1] * day,
            display.tint[2] * day,
          );
          /* The shell's glow on the night side, over the display's floor: the same illustration. */
          surface.uniforms.skylight?.value.set(
            1 + nebula * NEBULA_SKYLIGHT[0],
            1 + nebula * NEBULA_SKYLIGHT[1],
            1 + nebula * NEBULA_SKYLIGHT[2],
          );
        }
        /* The storms flash while the clock runs, taken up and let go with the globe's turn. */
        const flashes =
          world === "earth" && s.show.lightning && spin.rate > SETTLED.spin ? flashDensity(age) : 0;
        lightning.visible = flashes > 0;
        if (lightning.visible) {
          const flash = lightning.material.uniforms;
          flash.uDensity!.value = flashes;
          flash.uShown!.value = spin.rate;
          flash.uTime!.value = time;
          flash
            .uSun!.value.copy(worldPos)
            .negate()
            .normalize()
            .applyQuaternion(sunFromGlobe.copy(globe.quaternion).invert());
        }
        const air = looks.air(WORLDS[world].body.id);
        air?.uniforms.uSunlight?.value.set(
          display.tint[0] * day,
          display.tint[1] * day,
          display.tint[2] * day,
        );
        starMesh.scale.setScalar(state.radiusAu);
        starLookup.uniforms.uKelvin.value = state.teff;
        starLookup.uniforms.uExposure.value = display.discExposure;
        starLookup.uniforms.uCells.value = granulesAcross(state.mass, state.radius, state.teff);
        starLookup.uniforms.uRadiusPx.value = uniforms.uSunRadius.value / uniforms.uDiscPixel.value;
        starLookup.uniforms.uTime.value = time;
        uniforms.uSunColour.value.fromArray(display.colour);
        uniforms.uPointBright.value = Math.max(
          Math.min(POINT_CAP, (display.sunlight * POINT_GAIN) ** DAY_GAMMA),
          SUN_OVER_WORLD * display.day,
        );
        uniforms.uGlow.value = Math.min(1, display.disc);
        uniforms.uNebula.value = nebula;
        const glare = Math.max(display.day, display.disc * Math.min(1, fill));
        const starsOut = 1 - smoothstep(STARS_OUT.floor, STARS_OUT.ceiling, glare);
        starLook.uniforms.fade!.value = starsOut;
        if (options.trace) {
          Object.assign(options.trace, {
            world,
            changing: nextWorld !== null || dissolve !== null || flight !== null,
            flight: flight?.t ?? 0,
            fromSun,
            cover: dissolve === null ? 0 : 1 - smootherstep(dissolve),
            cameraRadii: camera.position.distanceTo(worldPos) / vantage.radius,
            yaw: restingYaw(FOV_DEG.open) + calm * look.yaw + swayYaw + flightYaw,
            pitch: pitchFor(share, FOV_DEG.open) - DIP,
            horizon: share,
            sunX: probe.x,
            sunY: probe.y,
            trueWidthDeg: (2 * uniforms.uSunRadius.value) / DEG,
            discFov: fov,
            discShare: Math.tan(uniforms.uSunRadius.value) / tanHalf(fov),
            discPx: 2 * starLookup.uniforms.uRadiusPx.value,
            magnified,
            teff: state.teff,
            radiusRsun: state.radius,
            day: display.day,
            disc: display.disc,
            pointBright: uniforms.uPointBright.value,
            starsOut,
            nebula,
            dryness,
          });
        }
        milkyWay.set(MILKY_WAY_PHASE, 1, starsOut, 0);
        uniforms.uGlare.value = s.show.glare ? 1 : 0;
        closeUp.step(dt);
        fading = looks.step(dt);

        sceneHost.render(() => {
          /* Space and the stars; the Sun's globe in its own depth range; the world's over it. */
          renderer.render(scene, camera);
          const autoClear = renderer.autoClear;
          renderer.autoClear = false;
          renderer.clearDepth();
          renderer.render(scene, discCamera);
          renderer.autoClear = autoClear;
          closeUp.renderBody(renderer, scene);
        });
        /* A world to change to: this frame, the old world's last, stays over the canvas as a still and dissolves away over the new. */
        if (nextWorld !== null) {
          veil.capture();
          veil.show(1);
          swapWorld(nextWorld);
          nextWorld = null;
          dissolve = 0;
          engine.invalidate();
        }
        if (bridge.ready()) warmUp(scene);
      });

    engine.start({
      render: tick,
      paused: () => !(engine.dirty || moving()),
      fps: () => quality.resolution.fps,
    });
    engine.refresh();
  });
}

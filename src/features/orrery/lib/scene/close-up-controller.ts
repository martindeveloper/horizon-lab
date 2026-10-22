import {
  Matrix4,
  Mesh,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
  type Object3D,
  type Scene,
  type Texture,
  type WebGLRenderer,
} from "three";

import {
  STILL,
  TAP_STYLE,
  aimAt,
  closeUpPose,
  flightSeconds,
  sampleCloseUp,
  settingOff,
  type CloseUpStyle,
  type FlightMotion,
  type Vec,
} from "@/space/close-up-flight";
import { AIR, AIR_BODIES } from "@/space/solar-system/graphics/air";
import { MAP_BASE } from "@/space/solar-system/graphics/maps";
import { moonOffset } from "@/space/solar-system/graphics/moons";
import { FRAME_RADII } from "@/space/solar-system/model/framing";
/**
 * The close-up: a flight to a body at true size, its detailed map (measured or
 * painted a few rows per frame), the atmosphere shell over a body with air (its own and its
 * moons', drawn in place of the surface shader's haze rim) and a depth pass of its own; or a
 * flight to one of Earth's observatories at its true size, which its own pass draws, Earth
 * below it holding its detailed map in a depth pass of its own.
 */
import { observatoryById, type ObservatoryId } from "@/space/solar-system/model/observatories";
import { SUN_R, type SolarKit } from "@/space/solar-system/scene/kit";
import { spacecraftFrame } from "@/space/spacecraft/models";
import { FIGURES, MAPS, MOONS, tierFile, type BodyId, type MoonId } from "@horizon/toolkit/bodies";
import { surfaceJob, type SurfaceJob } from "@horizon/toolkit/bodies/surfaces";
import type { OrbitPose } from "@horizon/toolkit/camera";
import { WIDE_QUERY } from "@horizon/toolkit/environment";
import { lerp, logFraction } from "@horizon/toolkit/math";
import { decodeMap, fetchMap, rising } from "@horizon/toolkit/scene";
import { AU_KM } from "@horizon/toolkit/science";

import { EARTH, canFlyTo, type CloseUpSelection, type OrrerySelection } from "../model/selection";
import type { CloseUpQuality } from "../quality";
import type { CameraRig } from "./camera-rig";
import { closeUpMapWidth, moonFraming } from "./close-up-flight";

/** The layer of a moon's planet in a moon's close-up: its own depth pass, behind the moon's. */
const HOST_LAYER = 2;
/** The layer of the close-up body's own depth pass. */
const BODY_LAYER = 1;
/** The close-up's own passes, for taps on the bodies they draw (Pluto from Charon's). */
export const CLOSE_UP_LAYERS = [BODY_LAYER, HOST_LAYER] as const;
/** Prefetched close-up maps kept as compressed bytes (a few MB at most). */
const PREFETCH_KEEP = 2;
/** Looking straight at the body. */
const AT_BODY = [0, 0, 0] as const;
/** Seconds the globe takes to slide aside for the card, or back to the middle without it. */
const ROOM_EASE = 0.4;
/** Each body's largest moon: the one a drift's visit swings out to. */
const LARGEST_MOON = new Map<BodyId, MoonId>();
for (const moon of [...MOONS].sort((a, b) => a.radiusKm - b.radiusKm))
  LARGEST_MOON.set(moon.host, moon.id);

export type BodySelection = CloseUpSelection;

type CloseUp = {
  sel: BodySelection;
  /** What the close-up frames: a body, or an observatory. */
  id: BodyId | ObservatoryId;
  /** The globe whose detailed map it holds: the body, or Earth below an observatory. */
  globe: BodyId;
  phase: "in" | "on" | "out";
  /** Progress through the current flight, 0..1. */
  t: number;
  from: OrbitPose;
  /** Where the view looked as the flight set off, off the body: it moves on with the body. */
  fromLook: Vector3;
  to: OrbitPose;
  /** Where the flight out lands: the pose and aim before the close-up, or a new view. */
  home: OrbitPose;
  homeAim: Vector3;
  /** True equatorial radius and the radius to frame (rings included), scene units; a craft's frame for both. */
  radius: number;
  frame: number;
  /** The body's meshes, drawn in their own depth pass on layer 1; none for a craft. */
  objects: Object3D[];
  /**
   * A moon's planet (globe and rings), or the Earth below an observatory, drawn in a depth pass
   * of its own before the subject's.
   */
  host: Object3D[];
  /** The detailed map, painted a few rows per frame, then swapped in. */
  job: SurfaceJob | null;
  /** The measured close-up map on its way, if the body has one. */
  loading: AbortController | null;
  detail: Texture | null;
  /**
   * How far the view is the body's, 0..1, eased with the flights: it moves the globe clear of
   * the card and, on a scripted visit, holds the clock.
   */
  blend: number;
  /**
   * The blend as the current flight set off: a flight eases it from there to where it lands,
   * so a close-up that follows another (a planet's to its moon's, and back) keeps the view
   * the body's, the globe aside for the card, rather than starting over from the map's.
   */
  fromBlend: number;
  /** How the current flight goes. */
  style: CloseUpStyle;
  /** The camera's motion as the current flight set off, per whole flight: carried on, eased out. */
  motion: FlightMotion;
  /**
   * How the current flight moves the camera now, per second: what a flight that interrupts
   * it sets off with. Still once landed; a visitor's drags are their own, not carried.
   */
  velocity: FlightMotion;
  /**
   * Where the view looked off the body as of the last step, per distance from it (`aimAt`):
   * the look's motion is measured against it, since the rig re-homes its aim before each step.
   */
  look: Vec;
  /**
   * The flight out is another camera's (a drift's next flight, landing on this pose): it moves
   * the pose, the close-up keeps the body in view until it hands the aim home. Null otherwise.
   */
  released: OrbitPose | null;
  /** Atmosphere shells over the bodies with air, and the haze rims they replace meanwhile. */
  shells: Shell[];
};

/** A scattering shell over a globe, in place of its surface shader's haze rim, and its camera and Sun uniforms. */
type Shell = {
  mesh: Mesh;
  globe: Mesh;
  surface: ShaderMaterial;
  rim: number;
  camera: Vector3;
  sun: Vector3;
};

const subjectOf = (sel: BodySelection) => (sel.kind === "sun" ? "sun" : sel.id);
/** The globe a close-up holds the detailed map of: its body's, or Earth's below an observatory. */
const globeOf = (sel: BodySelection): BodyId =>
  sel.kind === "observatory" ? EARTH.id : sel.kind === "sun" ? "sun" : sel.id;
const M_PER_AU = AU_KM * 1e3;

/** The true radius and the radius to frame, scene units: a globe's (rings included), or a craft's. */
function sizeOf(sel: BodySelection) {
  if (sel.kind === "observatory") {
    const frame = spacecraftFrame(observatoryById(sel.id).model) / M_PER_AU;
    return { radius: frame, frame };
  }
  const id = globeOf(sel);
  const radius = id === "sun" ? SUN_R : FIGURES[id].equatorialKm / AU_KM;
  return { radius, frame: radius * (FRAME_RADII[id] ?? 1) };
}

const setLayer = (objects: Object3D[], layer: number) => {
  for (const object of objects) object.traverse((child) => child.layers.set(layer));
};

export function createCloseUpController(
  { scope, looks, camera, viewport, tight }: SolarKit,
  deps: {
    rig: CameraRig;
    reduceMotion: MediaQueryList;
    invalidate: () => void;
    /** Where the body is now, as the scene draws it. */
    locate: (sel: BodySelection, out: Vector3) => Vector3;
    /** The body's own meshes and its moons'. */
    objectsOf: (sel: BodySelection) => Object3D[];
    /** For a moon, its planet's globe (rings included); for an observatory, Earth's; none for the rest. */
    hostOf: (sel: BodySelection) => Object3D[];
    /** How far past its globe the host's pass reaches (Earth's observatories), scene units. */
    hostReach?: (sel: BodySelection) => number;
    /** How far the body's drawn moons reach. */
    reachOf: (id: BodyId) => number;
    /** The close-up takes the camera from flights, the guide and input. */
    onTakeCamera: () => void;
    onRelease: () => void;
    /** Uploads a texture now, so the swap never stalls a frame mid-flight. */
    upload: (texture: Texture) => void;
    /** The current quality's close-up maps, read as each close-up starts. */
    quality: () => CloseUpQuality;
    /**
     * How each flight goes, read as it starts; a visitor's (`TAP_STYLE`) by default. A scripted
     * visit also eases the clock out and back in with its flights (`clockShare`) rather than
     * holding it at once, and its arrival follows the body's light while the clock still runs.
     */
    style?: () => CloseUpStyle;
    /** A scripted visit's flights wait while this holds (its drift is paused). */
    paused?: () => boolean;
    /** The card shows beside the globe, which stands aside for it; true by default. */
    card?: () => boolean;
  },
) {
  const { rig, reduceMotion, invalidate, locate, upload } = deps;
  const { pose, aim } = rig;
  let close: CloseUp | null = null;
  /* Near-tier bytes fetched when a body is selected, before anyone asks for its close-up. */
  const prefetched = new Map<string, Promise<Blob>>();
  const prefetchAbort = new AbortController();
  scope.defer(() => prefetchAbort.abort());
  const nearFile = (id: BodyId) => {
    const near = tierFile(MAP_BASE, id, deps.quality().light ? "nearLight" : "near");
    return near && near !== tierFile(MAP_BASE, id, "far") ? near : null;
  };
  const bytesOf = (file: string) => {
    let bytes = prefetched.get(file);
    if (!bytes) {
      bytes = fetchMap(file, prefetchAbort.signal);
      /* A failed prefetch is retried by the close-up itself. */
      bytes.catch(() => prefetched.delete(file));
      prefetched.set(file, bytes);
      for (const key of prefetched.keys()) {
        if (prefetched.size <= PREFETCH_KEEP) break;
        if (key !== file) prefetched.delete(key);
      }
    }
    return bytes;
  };
  const target = new Vector3();
  const moonAt = new Vector3();
  const homeOff = new Vector3();
  const hostAt = new Vector3();
  /** Where the view looks off the body at `target`, per `distance` from it (`aimAt`). */
  const lookOf = (distance: number): Vec => [
    (aim.x - target.x) / distance,
    (aim.y - target.y) / distance,
    (aim.z - target.z) / distance,
  ];
  /** The shells' sphere; each shell is scaled to its body's air. */
  const shellGeometry = scope.own(new SphereGeometry(1, 96, 64));
  const shellInverse = new Matrix4();
  /** Which body with air a globe is, by its surface material, or none. */
  const airOf = (object: Object3D) =>
    object instanceof Mesh
      ? AIR_BODIES.find((id) => looks.surfaceOf(id) === object.material)
      : undefined;
  /**
   * Puts a shell over every globe with air in the close-up that has none yet: the body's own
   * at once, a moon's once it is drawn (its material arrives with it). The surface's haze
   * rim goes off meanwhile, so the air is not counted twice.
   */
  const shellGlobes = (close: CloseUp) => {
    for (const object of close.objects) {
      const id = airOf(object);
      if (!id || !(object instanceof Mesh) || close.shells.some((s) => s.globe === object))
        continue;
      const material = looks.air(id);
      const surface = object.material;
      if (!material || !(surface instanceof ShaderMaterial)) continue;
      const cameraAt: unknown = material.uniforms.uCamera?.value;
      const sunAt: unknown = material.uniforms.uSun?.value;
      if (!(cameraAt instanceof Vector3) || !(sunAt instanceof Vector3)) continue;
      const mesh = new Mesh(shellGeometry, material);
      mesh.scale.setScalar(1 + AIR[id]!.shell);
      mesh.layers.set(BODY_LAYER);
      object.add(mesh);
      const rim = surface.uniforms.atmosStrength;
      close.shells.push({
        mesh,
        globe: object,
        surface,
        rim: rim ? Number(rim.value) : 0,
        camera: cameraAt,
        sun: sunAt,
      });
      if (rim) rim.value = 0;
    }
  };
  /** Takes the shells off and gives the surfaces their haze rims back. */
  const unshell = (close: CloseUp) => {
    for (const { mesh, globe, surface, rim } of close.shells) {
      globe.remove(mesh);
      const haze = surface.uniforms.atmosStrength;
      if (haze) haze.value = rim;
    }
    close.shells.length = 0;
  };
  /** Each shell's camera and Sun in its own space, from its world matrix in double precision. */
  const aimShells = (close: CloseUp) => {
    for (const shell of close.shells) {
      shellInverse.copy(shell.mesh.matrixWorld).invert();
      shell.camera.copy(camera.position).applyMatrix4(shellInverse);
      shell.sun.set(0, 0, 0).applyMatrix4(shellInverse).normalize();
    }
  };
  const wide = window.matchMedia(WIDE_QUERY);
  const style = () => deps.style?.() ?? TAP_STYLE;
  const carded = () => deps.card?.() ?? true;
  /** How far the globe stands aside for the card, 0..1: without the card it frames the middle. */
  let room = carded() ? 1 : 0;
  /** Room the card takes: the globe sits left of it on wide screens, above the bar on phones. */
  const card = () =>
    wide.matches
      ? { x: Math.min(176, viewport.width * 0.2), y: 0 }
      : { x: 0, y: Math.min(80, viewport.height * 0.1) };
  /** Tangent of half the view's shorter side, less the card's room while it shows. */
  const freeHalfTan = () => {
    const shift = carded() ? card() : { x: 0, y: 0 };
    const { width, height } = viewport;
    return (
      Math.tan((camera.fov * Math.PI) / 360) *
      Math.min((height - 2 * shift.y) / height, (width - 2 * shift.x) / height)
    );
  };
  /** Leaves the close-up at once: the body's own map back, detail map freed, normal layers. */
  const end = (landHome: boolean) => {
    if (!close) return;
    unshell(close);
    setLayer(close.objects, 0);
    setLayer(close.host, 0);
    close.loading?.abort();
    looks.release(close.globe);
    close.detail?.dispose();
    if (landHome) Object.assign(pose, close.home);
    close = null;
    camera.clearViewOffset();
    invalidate();
  };
  scope.defer(() => end(false));

  /** A close-up's detailed map, to paint a few rows per frame; null when the base map suffices. */
  const detailJob = (id: BodyId) => {
    // Keep the observed far map if the Sun's close-up tier fails to load.
    if (id === "sun") return null;
    const w = closeUpMapWidth(id, deps.quality().light);
    return w > looks.mapWidth(id) ? surfaceJob(id, w, w / 2) : null;
  };

  const start = (sel: BodySelection) => {
    /* Moving on from another close-up (its planet to a moon) still leaves for the map it came from. */
    const home = close
      ? { pose: close.home, aim: close.homeAim }
      : { pose: { ...pose }, aim: aim.clone() };
    const fromBlend = close?.blend ?? 0;
    /* A flight interrupted mid-way hands its motion on; a landed close-up stands still. */
    const velocity = close && close.phase !== "on" ? close.velocity : STILL;
    const flightStyle = style();
    end(false);
    room = carded() ? 1 : 0;
    const id = subjectOf(sel);
    const globe = globeOf(sel);
    const { radius, frame } = sizeOf(sel);
    locate(sel, target);
    const to = closeUpPose([target.x, target.y, target.z], frame, freeHalfTan(), pose.azimuth);
    /* The planet's moons and their orbits share its depth pass: the Moon sits inside the
       wide pass's near plane once the camera is at the Earth. */
    const objects = deps.objectsOf(sel);
    setLayer(objects, BODY_LAYER);
    /* A moon's planet can be a million km off while the near plane is a few km out: the wide
       pass cannot resolve its rings against its globe, so it gets a depth range of its own. */
    const host = deps.hostOf(sel);
    setLayer(host, HOST_LAYER);
    close = {
      sel,
      id,
      globe,
      phase: "in",
      t: 0,
      from: { ...pose },
      fromLook: aim.clone().sub(target),
      to,
      home: home.pose,
      homeAim: home.aim,
      radius,
      frame,
      objects,
      host,
      /* Measured bodies fetch a detailed map; painted ones paint one during the flight. */
      job: MAPS[globe] ? null : detailJob(globe),
      loading: null,
      detail: null,
      blend: fromBlend,
      fromBlend,
      style: flightStyle,
      motion: settingOff(velocity, true, flightStyle),
      velocity: STILL,
      look: lookOf(pose.distance),
      released: null,
      shells: [],
    };
    shellGlobes(close);
    const near = nearFile(globe);
    if (near) {
      const mine = close;
      const abort = new AbortController();
      mine.loading = abort;
      bytesOf(near)
        .then((blob) => {
          abort.signal.throwIfAborted();
          return decodeMap(blob, deps.quality().anisotropy);
        })
        .then(
          (texture) => {
            if (close !== mine) {
              texture.dispose();
              return;
            }
            mine.loading = null;
            mine.detail = texture;
            upload(texture);
            looks.hold(globe, texture);
            invalidate();
          },
          () => {
            /* Offline or missing: paint the detailed map instead. */
            if (close !== mine || abort.signal.aborted) return;
            mine.loading = null;
            mine.job = detailJob(globe);
            invalidate();
          },
        );
    }
    rig.cancel();
    rig.edgePush = 0;
    deps.onTakeCamera();
    if (reduceMotion.matches) {
      close.phase = "on";
      close.t = 1;
      close.blend = 1;
      Object.assign(pose, to);
    }
    invalidate();
  };

  /** Flies out to `close.home` from wherever the camera is. */
  const flyOut = (close: CloseUp) => {
    if (reduceMotion.matches) {
      end(true);
      return;
    }
    close.phase = "out";
    close.t = 0;
    close.style = style();
    close.motion = settingOff(close.velocity, false, close.style);
    close.released = null;
    close.from = { ...pose };
    close.fromLook = aim.clone().sub(target);
    close.fromBlend = close.blend;
    deps.onRelease();
    invalidate();
  };

  const leave = () => {
    if (!close || close.phase === "out") return;
    flyOut(close);
  };

  /** A scripted visit's flight waits while its drift is paused. */
  const held = (close: CloseUp) =>
    close.phase !== "on" && close.style.scripted !== null && (deps.paused?.() ?? false);

  /** Paints detail rows within a frame budget; swaps the map in when it is complete. */
  const paintDetail = () => {
    if (!close?.job) return;
    const begin = performance.now();
    const budget = tight ? 4 : 6;
    let done = false;
    while (!done && performance.now() - begin < budget) done = close.job.step(2);
    if (!done) return;
    close.detail = looks.detailTexture(close.job);
    upload(close.detail);
    looks.hold(close.globe, close.detail);
    close.job = null;
    invalidate();
  };

  return {
    /** Gives the open close-up's map the current quality's filtering, re-uploading it. */
    refilter() {
      const detail = close?.detail;
      const { anisotropy } = deps.quality();
      if (!detail || detail.anisotropy === anisotropy) return;
      detail.anisotropy = anisotropy;
      detail.needsUpdate = true;
    },
    get current(): Readonly<CloseUp> | null {
      return close;
    },
    start,
    end,
    leave,
    /** Flies out of the body and on to `home` in one flight. */
    leaveTo(home: OrbitPose) {
      if (!close || close.released) return;
      close.home = home;
      leave();
    },
    /**
     * Hands the flight out to another camera, which lands on `landing` (a drift's next flight,
     * so the pull away flows on into it): the close-up only keeps the body in view meanwhile.
     */
    release(landing: OrbitPose) {
      if (!close || close.phase === "out") return;
      close.phase = "out";
      close.released = { ...landing };
      close.motion = STILL;
      close.from = { ...pose };
      close.fromLook = aim.clone().sub(target);
      close.fromBlend = close.blend;
      deps.onRelease();
      invalidate();
    },
    /** A released flight its camera no longer flies: the close-up flies on to the landing itself. */
    reclaim() {
      if (!close?.released) return;
      close.home = close.released;
      flyOut(close);
    },
    /**
     * The share of the clock's speed-up left running: all of it without a close-up, none in a
     * visitor's; a scripted visit's eases with its flights, out as the view becomes the body's
     * and back in as it leaves.
     */
    clockShare() {
      if (!close) return 1;
      return close.style.scripted ? 1 - close.blend : 0;
    },
    /** Flights or a map still on its way keep frames coming. */
    busy() {
      return close !== null && ((close.phase !== "on" && !held(close)) || close.job !== null);
    },
    /** The pose `base` swings to so the body's largest moon shares the view; null without one. */
    moonPose(base: OrbitPose): OrbitPose | null {
      const moon = close && close.sel.kind !== "observatory" && LARGEST_MOON.get(close.globe);
      if (!moon) return null;
      const { x, y, z } = moonOffset(moon, new Date(), moonAt);
      return moonFraming([x, y, z], base, freeHalfTan());
    },
    /** The focused body's (or observatory's) own label, orbit and marker fade as it comes to fill the view. */
    shownFor(id: BodyId | ObservatoryId) {
      return close !== null && close.id === id
        ? rising(pose.distance, close.frame * 250, close.frame * 600)
        : 1;
    },
    /** A body was selected: fetch its close-up map's bytes while the card is read. */
    prefetch(sel: OrrerySelection | null) {
      if (!canFlyTo(sel)) return;
      const near = nearFile(globeOf(sel));
      if (near) void bytesOf(near).catch(() => undefined);
    },
    /** Flies in or out, keeps the aim on the body and the globe clear of the card. */
    step(dt: number) {
      if (!close) return;
      locate(close.sel, target);
      const body = [target.x, target.y, target.z] as const;
      const from = { look: close.fromLook.toArray(), distance: close.from.distance };
      /* The view's aim home, off the body. */
      const homeLook = homeOff.subVectors(close.homeAim, target).toArray();
      if (close.phase === "on") aim.copy(target);
      else if (close.released) {
        /* The other camera moves the pose; the body slides home as the pull back nears its landing. */
        const lands = close.released.distance;
        const blend =
          lands === close.from.distance
            ? 1
            : logFraction(pose.distance, close.from.distance, lands);
        const home = { look: homeLook, distance: close.released.distance };
        aim.fromArray(aimAt(body, from, home, pose.distance, blend));
        close.blend = lerp(close.fromBlend, 0, blend);
      } else {
        const entering = close.phase === "in";
        const { lead, scripted } = close.style;
        close.t = Math.min(
          1,
          close.t + (held(close) ? 0 : dt) / flightSeconds(entering, close.style),
        );
        /* While the clock still runs on the way in, the arrival keeps its light three-quarters. */
        if (entering && scripted)
          close.to.azimuth = closeUpPose(
            body,
            close.frame,
            freeHalfTan(),
            close.to.azimuth,
          ).azimuth;
        const to = entering ? close.to : close.home;
        const was = {
          azimuth: pose.azimuth,
          inclination: pose.inclination,
          distance: Math.log(pose.distance),
          look: close.look,
        };
        const step = sampleCloseUp(close.t, close.from, to, entering, lead, close.motion);
        Object.assign(pose, step.pose);
        const toward = { look: entering ? AT_BODY : homeLook, distance: to.distance };
        aim.fromArray(
          aimAt(body, from, toward, pose.distance, step.aim, close.motion.look, step.carry),
        );
        close.blend = lerp(close.fromBlend, entering ? 1 : 0, step.aim);
        if (dt > 0) {
          const look = lookOf(pose.distance);
          close.velocity = {
            azimuth: (pose.azimuth - was.azimuth) / dt,
            inclination: (pose.inclination - was.inclination) / dt,
            distance: (Math.log(pose.distance) - was.distance) / dt,
            look: [
              (look[0] - was.look[0]) / dt,
              (look[1] - was.look[1]) / dt,
              (look[2] - was.look[2]) / dt,
            ],
          };
        }
        if (close.t >= 1) {
          close.velocity = STILL;
          if (entering) close.phase = "on";
          else end(true);
        }
      }
      if (!close) return;
      close.look = lookOf(pose.distance);
      /* The globe eases aside as the card shows, back to the middle as it hides. */
      room += ((carded() ? 1 : 0) - room) * (1 - Math.exp(-dt / ROOM_EASE));
      const aside = card();
      const shift = { x: aside.x * room, y: aside.y * room };
      const { width, height } = viewport;
      if (shift.x || shift.y)
        camera.setViewOffset(
          width,
          height,
          shift.x * close.blend,
          shift.y * close.blend,
          width,
          height,
        );
      else camera.clearViewOffset();
      shellGlobes(close);
      paintDetail();
    },
    /* After the main pass: a moon's planet, then the body alone, each in a depth range of
       its own, so a true-size globe a few radii away stays crisp. */
    renderBody(renderer: WebGLRenderer, scene: Scene) {
      if (!close) return;
      const keepNear = camera.near;
      const keepFar = camera.far;
      const autoClear = renderer.autoClear;
      renderer.autoClear = false;
      /** Draws `layer` with the depth range around a globe `extent` from `centre`. */
      const pass = (layer: number, centre: Vector3, extent: number) => {
        const to = camera.position.distanceTo(centre);
        camera.near = Math.max(to * 1e-4, (to - extent) * 0.8);
        camera.far = to + extent;
        camera.updateProjectionMatrix();
        camera.layers.set(layer);
        renderer.clearDepth();
        renderer.render(scene, camera);
      };
      const planet = close.host[0];
      if (planet) {
        const beyond = deps.hostReach?.(close.sel) ?? 0;
        pass(
          HOST_LAYER,
          planet.getWorldPosition(hostAt),
          Math.max(planet.scale.x * 3, beyond * 1.02),
        );
      }
      aimShells(close);
      const globe = close.objects[0];
      if (globe) {
        const moons = deps.reachOf(close.globe);
        pass(BODY_LAYER, target, Math.max(globe.scale.x * 3, moons * 1.02));
      }
      renderer.autoClear = autoClear;
      camera.layers.set(0);
      camera.near = keepNear;
      camera.far = keepFar;
      camera.updateProjectionMatrix();
    },
  };
}

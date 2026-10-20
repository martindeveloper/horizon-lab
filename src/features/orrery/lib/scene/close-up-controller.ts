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

import { AIR, AIR_BODIES } from "@/space/solar-system/graphics/air";
import { moonOffset } from "@/space/solar-system/graphics/moons";
/**
 * The close-up: a flight to a body at true size, its detailed map (measured or
 * painted a few rows per frame), the atmosphere shell over a body with air (its own and its
 * moons', drawn in place of the surface shader's haze rim) and a depth pass of its own.
 */
import {
  hasSurface,
  type SolarSelection,
  type SurfaceSelection,
} from "@/space/solar-system/model/selection";
import { SUN_R, type SolarKit } from "@/space/solar-system/scene/kit";
import { FIGURES, MAPS, MOONS, tierFile, type BodyId, type MoonId } from "@horizon/toolkit/bodies";
import { surfaceJob, type SurfaceJob } from "@horizon/toolkit/bodies/surfaces";
import type { OrbitPose } from "@horizon/toolkit/camera";
import { WIDE_QUERY } from "@horizon/toolkit/environment";
import { rising } from "@horizon/toolkit/scene";
import { AU_KM } from "@horizon/toolkit/science";

import { MAP_BASE, decodeMap, fetchMap } from "../graphics/map-loader";
import type { CloseUpQuality } from "../quality";
import type { CameraRig } from "./camera-rig";
import {
  CLOSE_UP_IN_S,
  CLOSE_UP_OUT_S,
  FRAME_RADII,
  closeUpMapWidth,
  closeUpPose,
  moonFraming,
  sampleCloseUp,
} from "./close-up-flight";

/** The layer of a moon's planet in a moon's close-up: its own depth pass, behind the moon's. */
const HOST_LAYER = 2;
/** The layer of the close-up body's own depth pass. */
const BODY_LAYER = 1;
/** The close-up's own passes, for taps on the bodies they draw (Pluto from Charon's). */
export const CLOSE_UP_LAYERS = [BODY_LAYER, HOST_LAYER] as const;
/** Prefetched close-up maps kept as compressed bytes (a few MB at most). */
const PREFETCH_KEEP = 2;
/** Each body's largest moon: the one a drift's visit swings out to. */
const LARGEST_MOON = new Map<BodyId, MoonId>();
for (const moon of [...MOONS].sort((a, b) => a.radiusKm - b.radiusKm))
  LARGEST_MOON.set(moon.host, moon.id);

export type BodySelection = SurfaceSelection;

type CloseUp = {
  sel: BodySelection;
  id: BodyId;
  phase: "in" | "on" | "out";
  /** Progress through the current flight, 0..1. */
  t: number;
  from: OrbitPose;
  fromAim: Vector3;
  to: OrbitPose;
  /** Where the flight out lands: the pose and aim before the close-up, or a new view. */
  home: OrbitPose;
  homeAim: Vector3;
  /** True equatorial radius and the radius to frame (rings included), scene units. */
  radius: number;
  frame: number;
  /** The body's meshes, drawn in their own depth pass on layer 1. */
  objects: Object3D[];
  /** A moon's planet (globe and rings), drawn in a depth pass of its own before the moon's. */
  host: Object3D[];
  /** The detailed map, painted a few rows per frame, then swapped in. */
  job: SurfaceJob | null;
  /** The measured close-up map on its way, if the body has one. */
  loading: AbortController | null;
  detail: Texture | null;
  /** 0..1 of the framing offset applied, eased with the flight. */
  blend: number;
  /** How many times the usual flight time this flight takes (a drift flies in and out slowly). */
  pace: number;
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

const bodyKey = (sel: BodySelection): BodyId => (sel.kind === "sun" ? "sun" : sel.id);

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
    /** For a moon, its planet's globe (rings included); none for the rest. */
    hostOf: (sel: BodySelection) => Object3D[];
    /** How far the body's drawn moons reach. */
    reachOf: (id: BodyId) => number;
    /** The close-up takes the camera from flights, the guide and input. */
    onTakeCamera: () => void;
    onRelease: () => void;
    /** Uploads a texture now, so the swap never stalls a frame mid-flight. */
    upload: (texture: Texture) => void;
    /** The current quality's close-up maps, read as each close-up starts. */
    quality: () => CloseUpQuality;
    /** A multiplier on the flight times, read as each flight starts; 1 by default. */
    pace?: () => number;
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
  const hostAt = new Vector3();
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
  /** Room the card leaves: the globe sits left of it on wide screens, above the bar on phones. */
  const framing = () =>
    wide.matches
      ? { x: Math.min(176, viewport.width * 0.2), y: 0 }
      : { x: 0, y: Math.min(80, viewport.height * 0.1) };
  /** Tangent of half the view's shorter side, less the card's room. */
  const freeHalfTan = () => {
    const shift = framing();
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
    looks.release(close.id);
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
    end(false);
    const id = bodyKey(sel);
    const radius = id === "sun" ? SUN_R : FIGURES[id].equatorialKm / AU_KM;
    const frame = radius * (FRAME_RADII[id] ?? 1);
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
      phase: "in",
      t: 0,
      from: { ...pose },
      fromAim: aim.clone(),
      to,
      home: home.pose,
      homeAim: home.aim,
      radius,
      frame,
      objects,
      host,
      /* Measured bodies fetch a detailed map; painted ones paint one during the flight. */
      job: MAPS[id] ? null : detailJob(id),
      loading: null,
      detail: null,
      blend: 0,
      pace: deps.pace?.() ?? 1,
      shells: [],
    };
    shellGlobes(close);
    const near = nearFile(id);
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
            looks.hold(id, texture);
            invalidate();
          },
          () => {
            /* Offline or missing: paint the detailed map instead. */
            if (close !== mine || abort.signal.aborted) return;
            mine.loading = null;
            mine.job = detailJob(id);
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

  const leave = () => {
    if (!close || close.phase === "out") return;
    if (reduceMotion.matches) {
      end(true);
      return;
    }
    close.phase = "out";
    close.t = 0;
    close.pace = deps.pace?.() ?? 1;
    close.from = { ...pose };
    close.fromAim = aim.clone();
    deps.onRelease();
    invalidate();
  };

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
    looks.hold(close.id, close.detail);
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
      if (!close) return;
      close.home = home;
      leave();
    },
    /** Flights or a map still on its way keep frames coming. */
    busy() {
      return close !== null && (close.phase !== "on" || close.job !== null);
    },
    /** The pose `base` swings to so the body's largest moon shares the view; null without one. */
    moonPose(base: OrbitPose): OrbitPose | null {
      const moon = close && LARGEST_MOON.get(close.id);
      if (!moon) return null;
      const { x, y, z } = moonOffset(moon, new Date(), moonAt);
      return moonFraming([x, y, z], base, freeHalfTan());
    },
    /** The focused body's own label, orbit and marker fade as it comes to fill the view. */
    shownFor(id: BodyId) {
      return close !== null && close.id === id
        ? rising(pose.distance, close.frame * 250, close.frame * 600)
        : 1;
    },
    /** A body was selected: fetch its close-up map's bytes while the card is read. */
    prefetch(sel: SolarSelection | null) {
      if (!hasSurface(sel)) return;
      const near = nearFile(bodyKey(sel));
      if (near) void bytesOf(near).catch(() => undefined);
    },
    /** Flies in or out, keeps the aim on the body and the globe clear of the card. */
    step(dt: number) {
      if (!close) return;
      locate(close.sel, target);
      if (close.phase === "on") aim.copy(target);
      else {
        const entering = close.phase === "in";
        close.t = Math.min(
          1,
          close.t + dt / ((entering ? CLOSE_UP_IN_S : CLOSE_UP_OUT_S) * close.pace),
        );
        const step = sampleCloseUp(close.t, close.from, entering ? close.to : close.home, entering);
        Object.assign(pose, step.pose);
        if (entering) aim.lerpVectors(close.fromAim, target, step.aim);
        else aim.lerpVectors(target, close.homeAim, step.aim);
        close.blend = entering ? step.aim : 1 - step.aim;
        if (close.t >= 1) {
          if (entering) close.phase = "on";
          else end(true);
        }
      }
      if (!close) return;
      const shift = framing();
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
      if (planet) pass(HOST_LAYER, planet.getWorldPosition(hostAt), planet.scale.x * 3);
      aimShells(close);
      const moons = deps.reachOf(close.id);
      pass(BODY_LAYER, target, Math.max(close.objects[0]!.scale.x * 3, moons * 1.02));
      renderer.autoClear = autoClear;
      camera.layers.set(0);
      camera.near = keepNear;
      camera.far = keepFar;
      camera.updateProjectionMatrix();
    },
  };
}

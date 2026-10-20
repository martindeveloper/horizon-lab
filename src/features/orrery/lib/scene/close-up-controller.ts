import {
  Vector3,
  type Object3D,
  type Scene,
  type ShaderMaterial,
  Texture,
  type WebGLRenderer,
} from "three";

/**
 * The close-up: a flight to a body at true size, its detailed map (measured or
 * painted a few rows per frame) and a depth pass of its own.
 */
import type { SolarSelection } from "@/space/solar-system/model/selection";
import { SUN_R, type SolarKit } from "@/space/solar-system/scene/kit";
import { FIGURES, MAPS, tierFile, type BodyId } from "@horizon/toolkit/bodies";
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
  sampleCloseUp,
} from "./close-up-flight";

/** The layer of the close-up body's own depth pass. */
const BODY_LAYER = 1;
/** Prefetched close-up maps kept as compressed bytes (a few MB at most). */
const PREFETCH_KEEP = 2;

export type BodySelection = Extract<SolarSelection, { kind: "sun" | "planet" | "named" }>;

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
  material: ShaderMaterial;
  base: Texture;
  /** The detailed map, painted a few rows per frame, then swapped in. */
  job: SurfaceJob | null;
  /** The measured close-up map on its way, if the body has one. */
  loading: AbortController | null;
  detail: Texture | null;
  /** 0..1 of the framing offset applied, eased with the flight. */
  blend: number;
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
    /** How far the body's drawn moons reach. */
    reachOf: (id: BodyId) => number;
    /** The close-up takes the camera from flights, the guide and input. */
    onTakeCamera: () => void;
    onRelease: () => void;
    /** Uploads a texture now, so the swap never stalls a frame mid-flight. */
    upload: (texture: Texture) => void;
    /** The current quality's close-up maps, read as each close-up starts. */
    quality: () => CloseUpQuality;
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
  const wide = window.matchMedia(WIDE_QUERY);
  /** Room the card leaves: the globe sits left of it on wide screens, above the bar on phones. */
  const framing = () =>
    wide.matches
      ? { x: Math.min(176, viewport.width * 0.2), y: 0 }
      : { x: 0, y: Math.min(80, viewport.height * 0.1) };
  const materialOf = (sel: BodySelection): ShaderMaterial =>
    sel.kind === "sun"
      ? looks.sun
      : sel.kind === "planet"
        ? looks.planets[sel.id]
        : looks.named[sel.id];

  /** Leaves the close-up at once: shared map back, detail map freed, normal layers. */
  const end = (landHome: boolean) => {
    if (!close) return;
    setLayer(close.objects, 0);
    close.loading?.abort();
    close.material.uniforms.map!.value = close.base;
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
    end(false);
    const id = bodyKey(sel);
    const radius = id === "sun" ? SUN_R : FIGURES[id].equatorialKm / AU_KM;
    const frame = radius * (FRAME_RADII[id] ?? 1);
    const shift = framing();
    const { width, height } = viewport;
    const halfTan =
      Math.tan((camera.fov * Math.PI) / 360) *
      Math.min((height - 2 * shift.y) / height, (width - 2 * shift.x) / height);
    locate(sel, target);
    const to = closeUpPose([target.x, target.y, target.z], frame, halfTan, pose.azimuth);
    /* The planet's moons and their orbits share its depth pass: the Moon sits inside the
       wide pass's near plane once the camera is at the Earth. */
    const objects = deps.objectsOf(sel);
    const material = materialOf(sel);
    const map = material.uniforms.map?.value;
    if (!(map instanceof Texture)) throw new Error("Close-up surface has no map.");
    setLayer(objects, BODY_LAYER);
    close = {
      sel,
      id,
      phase: "in",
      t: 0,
      from: { ...pose },
      fromAim: aim.clone(),
      to,
      home: { ...pose },
      homeAim: aim.clone(),
      radius,
      frame,
      objects,
      material,
      base: map,
      /* Measured bodies fetch a detailed map; painted ones paint one during the flight. */
      job: MAPS[id] ? null : detailJob(id),
      loading: null,
      detail: null,
      blend: 0,
    };
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
            mine.material.uniforms.map!.value = texture;
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
    close.material.uniforms.map!.value = close.detail;
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
    /** The focused body's own label, orbit and marker fade as it comes to fill the view. */
    shownFor(id: BodyId) {
      return close !== null && close.id === id
        ? rising(pose.distance, close.frame * 250, close.frame * 600)
        : 1;
    },
    /** A body was selected: fetch its close-up map's bytes while the card is read. */
    prefetch(sel: SolarSelection | null) {
      if (sel?.kind !== "sun" && sel?.kind !== "planet" && sel?.kind !== "named") return;
      const near = nearFile(bodyKey(sel));
      if (near) void bytesOf(near).catch(() => undefined);
    },
    /** A measured far map arrived; a close-up of that body returns to it and keeps its detail. */
    applyMeasured(id: BodyId, texture: Texture) {
      if (close?.id !== id) return;
      close.base = texture;
      if (close.detail) close.material.uniforms.map!.value = close.detail;
    },
    /** Flies in or out, keeps the aim on the body and the globe clear of the card. */
    step(dt: number) {
      if (!close) return;
      locate(close.sel, target);
      if (close.phase === "on") aim.copy(target);
      else {
        const entering = close.phase === "in";
        close.t = Math.min(1, close.t + dt / (entering ? CLOSE_UP_IN_S : CLOSE_UP_OUT_S));
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
      paintDetail();
    },
    /* After the main pass: the body alone in a depth range of its own, so a true-size
       globe a few radii away stays crisp. */
    renderBody(renderer: WebGLRenderer, scene: Scene) {
      if (!close) return;
      const keepNear = camera.near;
      const keepFar = camera.far;
      const toBody = camera.position.distanceTo(target);
      const moons = deps.reachOf(close.id);
      const extent = Math.max(close.objects[0]!.scale.x * 3, moons * 1.02);
      camera.near = Math.max(toBody * 1e-4, (toBody - extent) * 0.8);
      camera.far = toBody + extent;
      camera.updateProjectionMatrix();
      camera.layers.set(BODY_LAYER);
      const autoClear = renderer.autoClear;
      renderer.autoClear = false;
      renderer.clearDepth();
      renderer.render(scene, camera);
      renderer.autoClear = autoClear;
      camera.layers.set(0);
      camera.near = keepNear;
      camera.far = keepFar;
      camera.updateProjectionMatrix();
    },
  };
}

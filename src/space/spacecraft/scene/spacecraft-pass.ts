import {
  Group,
  type Matrix3,
  Matrix4,
  type Object3D,
  PerspectiveCamera,
  Scene,
  Vector3,
  type WebGLRenderer,
} from "three";

import type { Vec3 } from "@horizon/toolkit/bodies";
import { smoothstep } from "@horizon/toolkit/math";
import { FAINTEST_OPACITY, rising, worldPerPixel, type SceneBasics } from "@horizon/toolkit/scene";

import {
  fetchSpacecraft,
  spacecraftModel,
  type LoadedSpacecraft,
  type SpacecraftLight,
} from "../graphics/loader";
import { SPACECRAFT, type SpacecraftId } from "../models";

/**
 * Spacecraft at their true size, for any host: drawn after its main pass, each in a depth
 * range of its own about a camera at the origin, in metres. Hosts place crafts from the camera
 * (`Craft`), worked out from a point they hold exactly, so a few metres of craft hundreds of au
 * out stay exact. A craft's model is fetched once it nears a pixel on screen (or the
 * camera heads for it) and appears as it grows past a few; until then, and for a craft never
 * approached, the pass draws nothing and costs nothing.
 */

/**
 * A craft as a host places it, in its world units from the camera: where it is and the point
 * its face turns to.
 */
export type Craft = { key: string; model: SpacecraftId; at: Vec3; facing: Vec3 };

export type SpacecraftFrame = {
  dt: number;
  /** The Sun, host world units from the camera. */
  sun: Vec3;
  crafts: readonly Craft[];
  /** The craft the camera is heading for: its model loads ahead of arrival. */
  approach: string | null;
};

export type SpacecraftPassOptions = {
  /** Metres per host world unit. */
  unitM: number;
  /** The canvas's primaries, for a host whose shaders encode their own display. */
  gamut?: Matrix3;
  /** A model arrived or is still fading in: the host draws another frame. */
  invalidate: () => void;
};

/** A craft's on-screen radius, CSS px, that starts its download. */
const LOAD_PX = 0.25;
/** The on-screen radius over which a loaded craft appears, CSS px (log-eased). */
const SHOW_PX: readonly [number, number] = [0.6, 2.5];
/** Seconds a model that arrives after its craft came into view takes to fade in. */
const ARRIVE_S = 0.6;
/** The depth range about a craft, as the Orrery's close-up: the near plane's floor as a share of its distance, and its margin. */
const NEAR_SHARE = 1e-4;
const NEAR_MARGIN = 0.8;
/** The smallest stage height detail is judged at, as `createScreenScale` does. */
const MIN_STAGE_PX = 480;

type CraftState = {
  craft: Craft;
  holder: Group;
  object: Object3D | null;
  dist: number;
  /** 0..1 since the model arrived. */
  arrived: number;
  presence: number;
  sunDir: Vector3;
};

const UP = new Vector3(0, 1, 0);
const ORIGIN = new Vector3();
const basis = new Matrix4();
const turn = new Vector3();

export function createSpacecraftPass(
  { scope, camera, viewport }: SceneBasics,
  { unitM, gamut, invalidate }: SpacecraftPassOptions,
) {
  const scene = new Scene();
  const view = new PerspectiveCamera();
  const light: SpacecraftLight = { sunDir: new Vector3(), ...(gamut && { gamut }) };
  const loaded = new Map<SpacecraftId, LoadedSpacecraft>();
  const requested = new Set<SpacecraftId>();
  const failed = new Set<SpacecraftId>();
  const states = new Map<string, CraftState>();
  let disposed = false;
  let busy = false;
  let waiting = false;
  scope.defer(() => {
    disposed = true;
    for (const model of loaded.values()) model.dispose();
  });

  /** A craft's model once it is fetched; until then the fetch, once. */
  function request(id: SpacecraftId) {
    if (loaded.has(id)) return;
    const model = spacecraftModel(id, light);
    if (model) {
      loaded.set(id, model);
      return;
    }
    if (requested.has(id)) return;
    requested.add(id);
    fetchSpacecraft(id).then(
      () => {
        if (!disposed) invalidate();
      },
      (error: unknown) => {
        failed.add(id);
        console.warn(`The ${id} model did not load; its marker stays.`, error);
      },
    );
  }

  function stateOf(craft: Craft) {
    let state = states.get(craft.key);
    if (!state) {
      const holder = new Group();
      holder.visible = false;
      scene.add(holder);
      state = {
        craft,
        holder,
        object: null,
        dist: 0,
        arrived: 0,
        presence: 0,
        sunDir: new Vector3(),
      };
      states.set(craft.key, state);
    }
    state.craft = craft;
    return state;
  }

  return {
    update({ dt, sun, crafts, approach }: SpacecraftFrame) {
      const stage = Math.max(MIN_STAGE_PX, viewport.height);
      busy = false;
      waiting = false;
      for (const state of states.values()) state.presence = 0;
      for (const craft of crafts) {
        const state = stateOf(craft);
        const { at, facing } = craft;
        const { holder } = state;
        holder.position.set(at[0] * unitM, at[1] * unitM, at[2] * unitM);
        state.dist = holder.position.length();
        const px = SPACECRAFT[craft.model].radius / worldPerPixel(camera.fov, state.dist, stage);
        if (px >= LOAD_PX || craft.key === approach) request(craft.model);

        const model = loaded.get(craft.model);
        if (model && !state.object) {
          state.object = model.root.clone();
          holder.add(state.object);
        }
        if (model && state.arrived < 1) {
          state.arrived = Math.min(1, state.arrived + dt / ARRIVE_S);
          busy ||= state.arrived < 1;
        }
        state.presence = rising(px, ...SHOW_PX) * smoothstep(0, 1, state.arrived);
        waiting ||= !model && px > SHOW_PX[0] && !failed.has(craft.model);

        turn.set(facing[0] - at[0], facing[1] - at[1], facing[2] - at[2]).normalize();
        holder.quaternion.setFromRotationMatrix(basis.lookAt(turn, ORIGIN, UP));
        state.sunDir.set(sun[0] - at[0], sun[1] - at[1], sun[2] - at[2]).normalize();
      }
      if (busy) invalidate();
    },
    /** A craft is big enough on screen to show, and its model is still on its way. */
    get waiting() {
      return waiting;
    },
    /** How far a craft's model has taken over from its marker, 0..1. */
    presence: (key: string) => states.get(key)?.presence ?? 0,
    /** After the host's main pass, in its paint: each shown craft over what is there. */
    render(renderer: WebGLRenderer) {
      const drawn = [...states.values()].filter(
        (state) => state.object && state.presence > FAINTEST_OPACITY,
      );
      for (const state of states.values()) state.holder.visible = false;
      if (drawn.length === 0) return;
      view.copy(camera, false);
      view.position.set(0, 0, 0);
      camera.getWorldQuaternion(view.quaternion);
      view.layers.enableAll();
      const autoClear = renderer.autoClear;
      renderer.autoClear = false;
      for (const state of drawn) {
        const { radius } = SPACECRAFT[state.craft.model];
        view.near = Math.max(state.dist * NEAR_SHARE, (state.dist - radius) * NEAR_MARGIN);
        view.far = state.dist + radius;
        view.updateProjectionMatrix();
        light.sunDir.copy(state.sunDir);
        loaded.get(state.craft.model)!.setPresence(state.presence);
        state.holder.visible = true;
        renderer.clearDepth();
        renderer.render(scene, view);
        state.holder.visible = false;
      }
      renderer.autoClear = autoClear;
    },
  };
}

export type SpacecraftPass = ReturnType<typeof createSpacecraftPass>;

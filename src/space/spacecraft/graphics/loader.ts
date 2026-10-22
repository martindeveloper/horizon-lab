import {
  DataTexture,
  DoubleSide,
  FrontSide,
  Mesh,
  MeshStandardMaterial,
  ShaderMaterial,
  type Matrix3,
  type Object3D,
  type Texture,
  type Vector3,
} from "three";

import { spacecraftUrl, type SpacecraftId } from "../models";
import FRAG from "./shaders/spacecraft.frag.glsl";
import VERT from "./shaders/spacecraft.vert.glsl";

/**
 * What every spacecraft material shares: the direction toward the Sun (world, unit), written
 * by the pass for each craft it draws, and the canvas's primaries for a host that encodes its
 * own display (`displayEncode`); without one, three.js encodes the output.
 */
export type SpacecraftLight = { sunDir: Vector3; gamut?: Matrix3 };

/** A single white texel: the map of a material that has none. */
const WHITE = new DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
WHITE.needsUpdate = true;

/** A glTF material as the spacecraft shader: its colour, map, normal map, metalness and roughness. */
function spacecraftMaterial(source: MeshStandardMaterial, light: SpacecraftLight) {
  return new ShaderMaterial({
    defines: {
      ...(light.gamut && { DISPLAY_GAMUT: "" }),
      ...(source.normalMap && { USE_NORMAL_MAP: "" }),
    },
    uniforms: {
      map: { value: source.map ?? WHITE },
      ...(source.normalMap && {
        normalMap: { value: source.normalMap },
        normalScale: { value: source.normalScale.clone() },
      }),
      color: { value: source.color.clone() },
      metalness: { value: source.metalness },
      roughness: { value: source.roughness },
      sunDir: { value: light.sunDir },
      presence: { value: 1 },
      ...(light.gamut && { uGamut: { value: light.gamut } }),
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
    side: source.side === DoubleSide ? DoubleSide : FrontSide,
    transparent: true,
  });
}

/** A craft's model in one pass: its scene graph, how present it is, and how to release it. */
export type LoadedSpacecraft = {
  root: Object3D;
  setPresence: (presence: number) => void;
  dispose: () => void;
};

/** Each model's fetch, once a page: a later scene, or a twin, shares it. */
const fetches = new Map<SpacecraftId, Promise<Object3D>>();
const fetched = new Map<SpacecraftId, Object3D>();

/**
 * Fetches a built model (`spacecraftModel` then builds it). The glTF loader and the meshopt
 * decoder are imported with the first model, so a scene that never comes close to a craft
 * never loads them. A failed fetch may be tried again.
 */
export function fetchSpacecraft(id: SpacecraftId): Promise<Object3D> {
  let pending = fetches.get(id);
  if (!pending) {
    pending = (async () => {
      const [{ GLTFLoader }, { MeshoptDecoder }] = await Promise.all([
        import("three/examples/jsm/loaders/GLTFLoader.js"),
        import("three/examples/jsm/libs/meshopt_decoder.module.js"),
      ]);
      const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).setCrossOrigin("anonymous");
      const { scene } = await loader.loadAsync(spacecraftUrl(id));
      fetched.set(id, scene);
      return scene;
    })();
    pending.catch(() => fetches.delete(id));
    fetches.set(id, pending);
  }
  return pending;
}

/**
 * A fetched model for one pass, its materials as the spacecraft shader; null until
 * `fetchSpacecraft` has it. The pass's copy shares the fetched geometry and textures; releasing
 * it frees their GPU memory, and a later pass uploads them again.
 */
export function spacecraftModel(id: SpacecraftId, light: SpacecraftLight): LoadedSpacecraft | null {
  const source = fetched.get(id);
  if (!source) return null;
  const root = source.clone();
  const materials = new Map<MeshStandardMaterial, ShaderMaterial>();
  const textures = new Set<Texture>();
  const meshes: Mesh[] = [];
  root.traverse((mesh) => {
    if (!(mesh instanceof Mesh)) return;
    meshes.push(mesh);
    /* The build writes metallic-roughness materials only (`MeshPhysicalMaterial` extends them). */
    const original = mesh.material;
    if (!(original instanceof MeshStandardMaterial)) return;
    let material = materials.get(original);
    if (!material) {
      material = spacecraftMaterial(original, light);
      materials.set(original, material);
      if (original.map) textures.add(original.map);
      if (original.normalMap) textures.add(original.normalMap);
    }
    mesh.material = material;
  });
  return {
    root,
    setPresence(presence) {
      for (const material of materials.values()) material.uniforms.presence!.value = presence;
    },
    dispose() {
      for (const mesh of meshes) mesh.geometry.dispose();
      for (const material of materials.values()) material.dispose();
      for (const texture of textures) texture.dispose();
    },
  };
}

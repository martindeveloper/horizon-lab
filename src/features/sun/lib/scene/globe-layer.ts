/**
 * The Sun's globe: a proxy sphere whose shader traces the photosphere and the cut's faces per
 * pixel (`globe.frag.glsl`) and writes their depth, so every other layer tests against it.
 */
import {
  Matrix4,
  Mesh,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
  type Camera,
  type Scene,
  type Texture,
} from "three";

import type { DisposalScope } from "@horizon/toolkit/rendering";

import GLOBE_FRAG from "../graphics/globe.frag.glsl";
import type { createLightTables } from "../graphics/light-tables";
import PROXY_VERT from "../graphics/proxy.vert.glsl";
import { MAP_FADE_IN_S, PROXY_RADIUS } from "../parameters";
import type { SunQuality } from "../quality";
import type { SunLooks } from "./looks";
import type { SunSceneSettings } from "./settings";

/** What a tap on the globe means: resolved by the engine from the hit point. */
export const GLOBE_PICK = { kind: "globe" } as const;

export function createGlobeLayer(
  scope: DisposalScope,
  scene: Scene,
  looks: SunLooks,
  tables: ReturnType<typeof createLightTables>,
) {
  const uniforms = {
    ...looks.uniforms,
    uSpectrum: { value: tables.spectrum },
    uProfile: { value: tables.profile },
    uInterior: { value: tables.interior },
    uRamp: { value: tables.ramp },
    uResponse: { value: tables.response },
    uCoreLnT: { value: tables.coreLnT },
    uLayers: { value: new Vector3(0.25, 0.7, 1) },
    uFaceLogY: { value: tables.faceLogY },
    uSunlight: { value: new Vector3(...tables.sunlight) },
    uFine: { value: 1 },
    uGrid: { value: 0 },
    uMap: { value: null as Texture | null },
    uMapShown: { value: 0 },
    uSpotAtlas: { value: null as Texture | null },
    uSpotPages: { value: null as Texture | null },
    uStencilShown: { value: 0 },
    uViewProjection: { value: new Matrix4() },
  };
  const material = scope.own(
    new ShaderMaterial({
      vertexShader: PROXY_VERT,
      fragmentShader: GLOBE_FRAG,
      uniforms,
      depthTest: true,
      depthWrite: true,
    }),
  );
  const mesh = new Mesh(scope.own(new SphereGeometry(PROXY_RADIUS, 64, 48)), material);
  mesh.name = "The Sun";
  mesh.userData.pick = GLOBE_PICK;
  mesh.renderOrder = 0;
  scene.add(mesh);
  scope.defer(() => mesh.removeFromParent());
  let fadeFrom = 0;
  let fading = 0;
  return {
    mesh,
    /** The measured map arrived: drawn from now on, faded in. */
    setMap(texture: Texture) {
      uniforms.uMap.value = texture;
      fadeFrom = uniforms.uMapShown.value;
      fading = 0;
    },
    setStencil(atlas: Texture, pages: Texture) {
      uniforms.uSpotAtlas.value = atlas;
      uniforms.uSpotPages.value = pages;
    },
    /** The measured map is drawn (faded in at least partly). */
    get mapShown() {
      return uniforms.uMap.value !== null && uniforms.uMapShown.value > 0;
    },
    /** The map still fading in. */
    get busy() {
      return (
        (uniforms.uMap.value !== null && uniforms.uMapShown.value < 1) ||
        (uniforms.uSpotAtlas.value !== null && uniforms.uStencilShown.value < 1)
      );
    },
    step(dt: number) {
      if (uniforms.uSpotAtlas.value)
        uniforms.uStencilShown.value = Math.min(
          1,
          uniforms.uStencilShown.value + dt / MAP_FADE_IN_S,
        );
      if (!uniforms.uMap.value || uniforms.uMapShown.value >= 1) return;
      fading = Math.min(1, fading + dt / MAP_FADE_IN_S);
      uniforms.uMapShown.value = fadeFrom + (1 - fadeFrom) * fading;
    },
    setQuality(quality: SunQuality) {
      uniforms.uFine.value = quality.fineSurface ? 1 : 0;
    },
    update(settings: SunSceneSettings, camera: Camera) {
      const { core, tachocline, photosphere } = settings.layers;
      uniforms.uLayers.value.set(core, tachocline, photosphere);
      uniforms.uGrid.value = settings.grid ? 1 : 0;
      uniforms.uViewProjection.value.multiplyMatrices(
        camera.projectionMatrix,
        camera.matrixWorldInverse,
      );
    },
  };
}

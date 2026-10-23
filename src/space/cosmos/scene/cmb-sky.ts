import {
  BackSide,
  FrontSide,
  Color,
  DataTexture,
  LinearFilter,
  Mesh,
  NoColorSpace,
  RepeatWrapping,
  ShaderMaterial,
  SphereGeometry,
  TextureLoader,
  type Object3D,
  type Texture,
  type Vector3,
} from "three";

import { assetUrl } from "@/lib/assets";
import type { DisposalScope } from "@horizon/toolkit/rendering";

import fragmentShader from "../graphics/shaders/cmb.frag.glsl";
import vertexShader from "../graphics/shaders/cmb.vert.glsl";
import {
  CMB_FACTS,
  CMB_PALETTE,
  CMB_SOURCE,
  cmbPixelSource,
  createCmbResources,
  type CmbStatus,
} from "../model/cmb";
import { CMB_MLY } from "../model/cosmos";

/**
 * A real angular temperature reconstruction on an illustrative observer-centred shell.
 * No random sky, inpainted fallback or transparent front/back superposition.
 */
export function createCmbSky(
  scope: DisposalScope,
  root: Object3D,
  invalidate: () => void,
  onStatus?: (status: CmbStatus) => void,
  maxTextureSize = 2048,
) {
  const empty = scope.own(new DataTexture(new Uint8Array([128, 0, 0, 255]), 1, 1));
  empty.needsUpdate = true;
  const material = scope.own(
    new ShaderMaterial({
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
      uniforms: {
        planckMap: { value: empty as Texture },
        actMap: { value: empty as Texture },
        planckReady: { value: false },
        actReady: { value: false },
        opacity: { value: 0 },
        temperatureScale: { value: CMB_SOURCE.encoding.scale },
        temperatureOffset: { value: CMB_SOURCE.encoding.offset },
        colourLimit: { value: CMB_FACTS.colourLimit.value * 1e6 },
        coolColour: { value: new Color(CMB_PALETTE.cool) },
        neutralColour: { value: new Color(CMB_PALETTE.neutral) },
        warmColour: { value: new Color(CMB_PALETTE.warm) },
      },
    }),
  );
  const mesh = new Mesh(scope.own(new SphereGeometry(1, 128, 64)), material);
  mesh.visible = false;
  mesh.frustumCulled = false;
  // Draw the backdrop first; do not paint over the foreground labels/galaxies/rings.
  mesh.renderOrder = -10;
  mesh.userData.content = true;
  mesh.scale.setScalar(CMB_MLY);
  root.add(mesh);
  const resources = createCmbResources(
    async (product) => {
      const asset = CMB_SOURCE.products[product];
      // Three.js would resize oversized PNGs as colours, corrupting the packed temperatures.
      // Keep valid Planck coverage instead of silently resampling numeric channels.
      if (Math.max(asset.width, asset.height) > maxTextureSize)
        throw new Error("CMB texture exceeds the device limit");
      const texture = await new TextureLoader().loadAsync(assetUrl(asset.path));
      // Numerical channels: no sRGB conversion, premultiplication, mipmaps or vertical flip.
      texture.colorSpace = NoColorSpace;
      texture.flipY = false;
      texture.premultiplyAlpha = false;
      texture.generateMipmaps = false;
      texture.minFilter = texture.magFilter = LinearFilter;
      texture.wrapS = RepeatWrapping;
      texture.needsUpdate = true;
      return texture;
    },
    (status) => {
      onStatus?.(status);
      invalidate();
    },
  );
  scope.defer(() => {
    resources.dispose();
    root.remove(mesh);
  });
  /** A map the current view draws is still on its way from the CDN. */
  let waiting = false;
  return {
    retry: resources.retry,
    get waiting() {
      return waiting;
    },
    setExpansion(a: number, sun: Vector3) {
      mesh.position.copy(sun);
      mesh.scale.setScalar(CMB_MLY * a);
    },
    update(opacity: number, detail: boolean, eye: Vector3) {
      if (opacity > 0.001) {
        resources.request("planck");
        if (detail) {
          resources.request("act");
        }
      }
      const { planck, act } = resources.resources;
      const { status } = resources;
      waiting =
        opacity > 0.001 && (status.planck === "loading" || (detail && status.act === "loading"));
      mesh.visible =
        opacity > 0.001 &&
        cmbPixelSource({ planckValid: !!planck, actValid: !!act, detail }) !== null;
      material.uniforms.planckMap!.value = planck ?? empty;
      material.uniforms.actMap!.value = act ?? empty;
      material.uniforms.planckReady!.value = !!planck;
      material.uniforms.actReady!.value = detail && !!act;
      material.uniforms.opacity!.value = opacity * 0.42;
      const side = eye.distanceTo(mesh.position) < mesh.scale.x ? BackSide : FrontSide;
      if (material.side !== side) {
        material.side = side;
        material.needsUpdate = true;
      }
    },
  };
}

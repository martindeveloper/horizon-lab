import { Vector2, Vector3, Vector4, type Texture } from "three";

import { assetUrl, MAPS_KEY } from "@/lib/assets";
import { MAPS, jplElements, mapFile } from "@horizon/toolkit/bodies";
import { createFullscreenPass, type DisposalScope } from "@horizon/toolkit/rendering";
import { SOLAR_GOLD, SPACE_BLACK, cssHex, loadMap } from "@horizon/toolkit/scene";
import { convert, decodeSrgb, hexToLinear } from "@horizon/toolkit/science";
import { fullscreenVertex } from "@horizon/toolkit/shaders";

import { LOOKS } from "../model/looks";
import {
  BALMER_SRGB,
  BROWN_DWARF_ALKALI,
  MAX_DISCS,
  ORBIT_IDS,
  SHADER_DEFINES,
  LENSES,
} from "../parameters";
import { overviewDots } from "./dots";
import focusBlurShader from "./focus-blur.frag.glsl";
import resolveShader from "./giants-resolve.frag.glsl";
import fragmentShader from "./giants.frag.glsl";
import { stellarTables } from "./stellar-tables";
import { discTints } from "./tints";
import { vectors } from "./vectors";
import { weatherUniforms } from "./weather-uniforms";

/** An encoded sRGB colour (0–1 a channel, or a hex string) as linear light for the shader. */
const linearRgb = (colour: readonly [number, number, number] | string) => {
  const [r, g, b] = typeof colour === "string" ? hexToLinear(colour) : colour.map(decodeSrgb);
  return new Vector3(r, g, b);
};

/** The orbits' radii: the planets' mean semi-major axes at J2000 (the JPL table). */
export const ORBIT_METRES = ORBIT_IDS.map((id) => convert(jplElements(id, 0).a, "au", "m"));

/** The shader passes, uniforms and measured maps, all owned by the engine scope. */
export function createGiantsRenderer(
  resources: DisposalScope,
  canvas: HTMLCanvasElement,
  invalidate: () => void,
) {
  const discs = {
    shape: vectors(MAX_DISCS),
    body: vectors(MAX_DISCS),
    surface: vectors(MAX_DISCS),
    globe: vectors(MAX_DISCS),
    ring: vectors(MAX_DISCS),
    lens: vectors(LENSES),
    /** Each hole in view as it stands on the ladder: where its ring is drawn (`uHoleShape`). */
    stand: vectors(LENSES),
  };
  /** The black holes' rungs: they bend the stars whether or not they are in view. */
  const holes = LOOKS.flatMap((look, index) => (look.style === "horizon" ? [index] : [])).slice(
    0,
    LENSES,
  );
  const tints = resources.own(discTints(LOOKS));
  const means = {
    earth: linearRgb(MAPS.earth?.mean ?? "#808080"),
    jupiter: linearRgb(MAPS.jupiter?.mean ?? "#808080"),
  };
  const dotTable = resources.own(overviewDots(LOOKS, tints.face, means));
  const stellar = resources.own(stellarTables(LOOKS));
  const weather = resources.own(weatherUniforms(stellar.spectrumData));
  const frameUniforms = {
    uResolution: { value: new Vector2(1, 1) },
    uPixelRatio: { value: 1 },
    uBaseline: { value: 0 },
    uTime: { value: 0 },
    uDetail: { value: 1 },
    uLines: { value: 1 },
    uFocus: { value: new Vector2(-1, 0) },
  };
  const bodyUniforms = {
    uCount: { value: 0 },
    uShape: { value: discs.shape },
    uBody: { value: discs.body },
    uSurface: { value: discs.surface },
    uGlobe: { value: discs.globe },
    uRing: { value: discs.ring },
    uLens: { value: discs.lens },
    uTints: tints.uniform,
    uHoles: { value: Array.from({ length: LENSES }, () => 0) },
    uHoleShape: { value: discs.stand },
    uHoleCount: { value: 0 },
  };
  const lightUniforms = {
    ...stellar.uniforms,
    uAccent: { value: linearRgb(cssHex(SOLAR_GOLD)) },
    uBalmer: { value: linearRgb(BALMER_SRGB) },
    uAlkali: { value: new Vector3(...BROWN_DWARF_ALKALI) },
    uSky: { value: linearRgb(cssHex(SPACE_BLACK)) },
  };
  const activityUniforms = {
    uWeather: { value: new Vector4(-1, 0, 0, 0) },
    ...weather.uniforms,
  };
  const orbitUniforms = {
    uOrbitCentre: { value: new Vector3() },
    uOrbits: { value: ORBIT_METRES.map(() => new Vector2()) },
  };
  const mapUniforms = {
    uEarth: { value: null as Texture | null },
    uJupiter: { value: null as Texture | null },
    uMaps: { value: new Vector2(0, 0) },
    uEarthMean: { value: means.earth },
    uJupiterMean: { value: means.jupiter },
  };
  const overviewUniforms = {
    uDots: dotTable.uniform,
    uOverview: { value: 0 },
    uDotFocus: { value: -1 },
  };
  const uniforms = {
    ...frameUniforms,
    ...bodyUniforms,
    ...lightUniforms,
    ...activityUniforms,
    ...orbitUniforms,
    ...mapUniforms,
    ...overviewUniforms,
  };
  const blurRadii = new Float32Array(MAX_DISCS);
  const pass = resources.own(
    createFullscreenPass({
      canvas,
      vertexShader: fullscreenVertex,
      fragmentShader,
      uniforms,
      defines: SHADER_DEFINES,
      filter: {
        fragmentShader: focusBlurShader,
        uniforms: {
          uResolution: frameUniforms.uResolution,
          uPixelRatio: frameUniforms.uPixelRatio,
          uCount: bodyUniforms.uCount,
          uShape: bodyUniforms.uShape,
          uBlurRadius: { value: blurRadii },
          uBaseline: frameUniforms.uBaseline,
          uOrbitCentre: orbitUniforms.uOrbitCentre,
          uOrbits: orbitUniforms.uOrbits,
        },
      },
      /* Bloom on radiance, finished by the same display step (graphics/display.glsl). */
      hdr: {
        fragmentShader: resolveShader,
        uniforms: {
          uResolution: frameUniforms.uResolution,
          uPixelRatio: frameUniforms.uPixelRatio,
          uLines: frameUniforms.uLines,
          uAccent: lightUniforms.uAccent,
          ...orbitUniforms,
        },
      },
    }),
  );

  /* Earth and Jupiter wear their measured maps once they arrive; their mean colours till then. */
  const maps = new AbortController();
  resources.defer(() => maps.abort());
  const base = assetUrl(MAPS_KEY);
  (["earth", "jupiter"] as const).forEach((id, slot) => {
    loadMap(mapFile(base, id, "far"), maps.signal)
      .then((texture) => {
        if (maps.signal.aborted) return texture.dispose();
        resources.own(texture);
        if (id === "earth") mapUniforms.uEarth.value = texture;
        else mapUniforms.uJupiter.value = texture;
        if (slot === 0) mapUniforms.uMaps.value.x = 1;
        else mapUniforms.uMaps.value.y = 1;
        invalidate();
      })
      .catch(() => {
        /* Offline or blocked: the globe keeps its mean colour. */
      });
  });

  return {
    pass,
    discs,
    holes,
    tints,
    dotTable,
    stellar,
    weather,
    frameUniforms,
    bodyUniforms,
    activityUniforms,
    orbitUniforms,
    overviewUniforms,
    blurRadii,
  };
}

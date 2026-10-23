/**
 * The small tables the Sun's shaders sample: the continuum (the shared CIE/Planck table) and its
 * inverse by brightness (the photograph's colour), the Sun's limb darkening (its Claret law), the interior's profile by radius and the current
 * light's colour ramp. Float textures, nearest-filtered and interpolated by hand in the shader.
 */
import { DataTexture, FloatType, NearestFilter, RGBAFormat, type Texture } from "three";

import {
  atmosphereProfile,
  continuumTable,
  luminanceTintTable,
  stellarContinuum,
} from "@/space/sun/graphics/atmosphere";
import { PROFILE_SAMPLES, SPECTRUM_SAMPLES } from "@/space/sun/graphics/parameters";
import { SURFACE_GRAVITY } from "@/space/sun/model/parameters";
import { response } from "@/space/sun/model/passbands";
import type { DisposalScope } from "@horizon/toolkit/rendering";
import { logGravityCgs } from "@horizon/toolkit/science";

import {
  ACTIVE_K,
  CHROMOSPHERE_K,
  cellOctaveOf,
  CORONA_K,
  FLARE_K,
  INTERIOR_SAMPLES,
  LAYER_WIDTH_DEX,
  PHOTOSPHERE_K,
  PHOTO_TINT_MAX,
  PHOTO_TINT_MIN,
  PHOTO_TINT_SAMPLES,
  PROMINENCE_SHEATH,
  RAMP_SAMPLES,
  RESPONSE_LAYERS,
  RESPONSE_LOG_MAX,
  RESPONSE_LOG_MIN,
  RESPONSE_SAMPLES,
  TRANSITION_K,
  type ResponseLayer,
} from "../parameters";
import type { SunLight } from "../scene/settings";

/** Where a temperature reads in the response table, 0–1 over its log range. */
const responseAt = (kelvin: number) =>
  (Math.log10(Math.max(kelvin, 1)) - RESPONSE_LOG_MIN) / (RESPONSE_LOG_MAX - RESPONSE_LOG_MIN);

/** The Sun's surface gravity, log₁₀ of cm/s²: which row of the limb grid is the Sun's. */
const SOLAR_LOG_G = logGravityCgs(SURFACE_GRAVITY);

function floatTable(data: Float32Array, width: number) {
  const texture = new DataTexture(data, width, 1, RGBAFormat, FloatType);
  texture.minFilter = texture.magFilter = NearestFilter;
  texture.needsUpdate = true;
  return texture;
}

/**
 * An interior profile by radius (0 the centre, 1 the photosphere): temperature, density, the
 * pressure scale height in radii and the share of the luminosity made per radius (dL/dr).
 */
export type InteriorProfile = (r: number) => {
  kelvin: number;
  density: number;
  scaleHeight: number;
  generation: number;
};

export function createLightTables(scope: DisposalScope, interior: InteriorProfile) {
  const spectrum = scope.own(floatTable(continuumTable(), SPECTRUM_SAMPLES));
  const profile = scope.own(
    floatTable(atmosphereProfile(PHOTOSPHERE_K, SOLAR_LOG_G), PROFILE_SAMPLES),
  );
  /* By the photograph's brightness against the quiet Sun's: the colour of the continuum that bright. */
  const luminanceTint = scope.own(
    floatTable(
      luminanceTintTable(PHOTOSPHERE_K, PHOTO_TINT_SAMPLES, PHOTO_TINT_MIN, PHOTO_TINT_MAX),
      PHOTO_TINT_SAMPLES,
    ),
  );
  /* By radius: ln T, ln ρ, the convection cells' octave (0 at the base's size) and the light
     made there over its peak. */
  const interiorData = new Float32Array(INTERIOR_SAMPLES * 4);
  let peak = 0;
  for (let i = 0; i < INTERIOR_SAMPLES; i++) {
    const { kelvin, density, scaleHeight, generation } = interior(i / (INTERIOR_SAMPLES - 1));
    interiorData[i * 4] = Math.log(Math.max(kelvin, 1));
    interiorData[i * 4 + 1] = Math.log(Math.max(density, 1e-30));
    interiorData[i * 4 + 2] = scaleHeight > 0 ? Math.max(0, cellOctaveOf(scaleHeight)) : 0;
    interiorData[i * 4 + 3] = generation;
    peak = Math.max(peak, generation);
  }
  for (let i = 0; i < INTERIOR_SAMPLES; i++) interiorData[i * 4 + 3]! /= peak || 1;
  const interiorTable = scope.own(floatTable(interiorData, INTERIOR_SAMPLES));
  const responseData = new Float32Array(RESPONSE_SAMPLES * RESPONSE_LAYERS.length * 4);
  const responseTable = scope.own(
    new DataTexture(responseData, RESPONSE_SAMPLES, RESPONSE_LAYERS.length, RGBAFormat, FloatType),
  );
  responseTable.minFilter = responseTable.magFilter = NearestFilter;
  let responseFor: SunLight["id"] | null = null;
  /** A row's value at a temperature, interpolated as the shader reads it. */
  const rowAt = (row: number, kelvin: number) => {
    const at = Math.min(1, Math.max(0, responseAt(kelvin))) * (RESPONSE_SAMPLES - 1);
    const lo = Math.floor(at);
    const hi = Math.min(lo + 1, RESPONSE_SAMPLES - 1);
    const a = responseData[(row * RESPONSE_SAMPLES + lo) * 4]!;
    const b = responseData[(row * RESPONSE_SAMPLES + hi) * 4]!;
    return a + (b - a) * (at - lo);
  };
  const rampData = new Float32Array(RAMP_SAMPLES * 4);
  const ramp = scope.own(floatTable(rampData, RAMP_SAMPLES));
  let rampFor: SunLight["ramp"] | null = null;
  /** The face's reference radiance: log Y of the photosphere's continuum, the white the disc is shown against. */
  const faceLogY = stellarContinuum(PHOTOSPHERE_K)[3];
  /** The photosphere's continuum colour, normalized to Y = 1: what the eye adapted to sunlight calls white. */
  const [sunR, sunG, sunB] = stellarContinuum(PHOTOSPHERE_K);
  const sunlight: [number, number, number] = [sunR, sunG, sunB];
  return {
    spectrum: spectrum as Texture,
    profile: profile as Texture,
    luminanceTint: luminanceTint as Texture,
    interior: interiorTable as Texture,
    ramp: ramp as Texture,
    response: responseTable as Texture,
    faceLogY,
    sunlight,
    coreLnT: interiorData[0]!,
    /**
     * Samples the model's response curve for a light over log T into the table's first row,
     * then each layer's row as that curve convolved with the layer's spread, so the renderer
     * and the model cannot disagree. Returns the band's exposure (1 over its brightest
     * weighted layer) and how much a prominence shows: chromospheric, with a transition sheath.
     */
    setResponse(light: SunLight) {
      if (light.id !== responseFor) {
        responseFor = light.id;
        const step = (RESPONSE_LOG_MAX - RESPONSE_LOG_MIN) / (RESPONSE_SAMPLES - 1);
        const curve = Array.from({ length: RESPONSE_SAMPLES }, (_, i) =>
          response(light.id, 10 ** (RESPONSE_LOG_MIN + i * step)),
        );
        RESPONSE_LAYERS.forEach((layer, row) => {
          const width = layer === "point" ? 0 : LAYER_WIDTH_DEX[layer];
          for (let i = 0; i < RESPONSE_SAMPLES; i++) {
            let value = curve[i]!;
            if (width > 0) {
              /* A log-normal of the layer's width, on the table's grid, over ±3σ. */
              const reach = Math.ceil((3 * width) / step);
              let sum = 0;
              let norm = 0;
              for (let k = -reach; k <= reach; k++) {
                const j = Math.min(RESPONSE_SAMPLES - 1, Math.max(0, i + k));
                const w = Math.exp(-0.5 * ((k * step) / width) ** 2);
                sum += w * curve[j]!;
                norm += w;
              }
              value = sum / norm;
            }
            responseData[(row * RESPONSE_SAMPLES + i) * 4] = value;
          }
        });
        responseTable.needsUpdate = true;
      }
      const w = light.weights;
      const row = (layer: ResponseLayer) => RESPONSE_LAYERS.indexOf(layer);
      const chromosphere = w.chromosphere * rowAt(row("chromosphere"), CHROMOSPHERE_K);
      const transition = w.transition * rowAt(row("transition"), TRANSITION_K);
      const brightest = Math.max(
        w.photosphere * rowAt(row("photosphere"), PHOTOSPHERE_K),
        chromosphere,
        transition,
        w.corona * rowAt(row("corona"), CORONA_K),
        w.corona * rowAt(row("corona"), ACTIVE_K),
        w.flare * rowAt(row("flare"), FLARE_K),
        1e-6,
      );
      return {
        scale: 1 / brightest,
        prominence: Math.min(1, (chromosphere + PROMINENCE_SHEATH * transition) / brightest),
      };
    },
    /** Writes a light's ramp into the texture when it changes. */
    setRamp(stops: SunLight["ramp"]) {
      if (stops === rampFor) return;
      rampFor = stops;
      const last = Math.max(stops.length - 1, 1);
      for (let i = 0; i < RAMP_SAMPLES; i++) {
        const at = (i / (RAMP_SAMPLES - 1)) * last;
        const lo = Math.min(Math.floor(at), last - 1);
        const t = at - lo;
        const a = stops[lo] ?? [0, 0, 0];
        const b = stops[lo + 1] ?? a;
        for (let c = 0; c < 3; c++) rampData[i * 4 + c] = a[c]! + (b[c]! - a[c]!) * t;
        rampData[i * 4 + 3] = 1;
      }
      ramp.needsUpdate = true;
    },
  };
}

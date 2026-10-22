/**
 * The lights the Sun is watched in: white light, Hα, the seven SDO/AIA EUV passbands, an
 * eclipse's occulted white light, and a magnetogram. Each has a temperature response, a display
 * colour ramp and the weight of each layer in it, so one dial re-lights a scene whose every part
 * carries a temperature.
 *
 * Responses: the AIA bands answer the ions Lemen et al. 2012 (Table 1) name, at the
 * temperatures of their peak response (log T), with the second ion each band also sees; the
 * curves are hand-chosen two-sided log-normal approximations inspired by those papers,
 * not their calibrated response functions. Widths, weights and layer visibility are display
 * choices. Density, line-of-sight emission measure and time-dependent calibration are absent. White light is
 * Planck's law against the photosphere's; Hα is represented by a cool-gas visibility proxy; an eclipse's K-corona is
 * Thomson scattering, blind to temperature; the displayed magnetogram projects a synthetic radial field along the line of sight.
 * Hα and He II 304 require optically thick, non-LTE transfer and can be out of ionization
 * equilibrium; this renderer does not solve either (Golding et al. 2017).
 *
 * Colours: the SDO/AIA standard tables (SolarSoft `aia_lct.pro`), built from their defining
 * curves (c0–c3 and IDL's "red temperature" table) in linear sRGB; white light is Planck's
 * colour; Hα Balmer red; the magnetogram grey with gold positive and blue negative.
 */
import { clamp01 } from "@horizon/toolkit/math";
import { keysOf } from "@horizon/toolkit/records";
import {
  ELECTRON_MASS_KG,
  PROTON_MASS_KG,
  RYDBERG_INFINITY,
  decodeSrgb,
  hellandBlackbodyLinear,
  planckRadiance,
  vacuumToAir,
} from "@horizon/toolkit/science";

import type { PassbandId } from "./contract";
import { TEMPERATURES, WHITE_LIGHT_NM } from "./parameters";

export type Rgb = readonly [number, number, number];
/** What a band shows of each layer, 0–1. */
export type LayerWeights = {
  photosphere: number;
  chromosphere: number;
  transition: number;
  corona: number;
  flare: number;
};

/** One temperature a band answers to: the ion that makes it, where it peaks, its weight, and its σ below and above, dex. */
export type Peak = {
  ion: string;
  logT: number;
  kelvin: number;
  weight: number;
  below: number;
  above: number;
};

export type Passband = {
  id: PassbandId;
  /** Wavelength, nm (the AIA bands' nominal; 0 for white light, the eclipse and the magnetogram). */
  nm: number;
  /** The temperature it answers most to, K (0 for the magnetogram). */
  peakK: number;
  /** The primary peak's mean σ, dex. */
  widthDex: number;
  /** Representative response peaks, not an exhaustive line spectrum; empty for the magnetogram. */
  peaks: readonly Peak[];
  /** Colour ramp, dark to bright, linear sRGB. */
  ramp: readonly Rgb[];
  weights: LayerWeights;
  /** An occulting disc hides the photosphere (an eclipse). */
  occultDisc: boolean;
  /** Selects the synthetic magnetic view rather than an intensity passband. */
  magnetogram: boolean;
};

/** A peak at log T with its ion, weight and σ below/above (illustrative width and weight). */
const peak = (ion: string, logT: number, weight: number, below: number, above: number): Peak => ({
  ion,
  logT,
  kelvin: 10 ** logT,
  weight,
  below,
  above,
});

/**
 * Where the AIA bands answer (Lemen et al. 2012, Table 1; Boerner et al. 2012, Fig. 11): the
 * primary ion at its log T, and the second ion each band also sees. 94 Å: Fe XVIII in flares
 * and Fe X in the quiet corona; 131 Å: Fe VIII in the transition region and Fe XXI in flares;
 * 193 Å: Fe XII in the corona and Fe XXIV in flares; 304 Å: He II with a Si XI coronal
 * contribution. Relative weights and widths are hand-chosen rendering parameters.
 */
export const AIA_PEAKS_K = {
  he304: [peak("He II", 4.7, 1, 0.12, 0.2), peak("Si XI", 6.2, 0.15, 0.1, 0.1)],
  fe171: [peak("Fe IX", 5.8, 1, 0.12, 0.15)],
  fe193: [peak("Fe XII", 6.2, 1, 0.15, 0.2), peak("Fe XXIV", 7.3, 0.3, 0.15, 0.2)],
  fe211: [peak("Fe XIV", 6.3, 1, 0.15, 0.2)],
  fe335: [peak("Fe XVI", 6.4, 1, 0.2, 0.25)],
  fe94: [peak("Fe XVIII", 6.8, 1, 0.15, 0.2), peak("Fe X", 6.05, 0.5, 0.12, 0.12)],
  fe131: [peak("Fe VIII", 5.6, 1, 0.12, 0.15), peak("Fe XXI", 7.05, 0.5, 0.15, 0.2)],
} as const satisfies Record<string, readonly Peak[]>;
export type AiaId = keyof typeof AIA_PEAKS_K;

/** The AIA bands' wavelengths, nm (Lemen et al. 2012, Table 1). */
export const AIA_NM: Readonly<Record<AiaId, number>> = {
  he304: 30.4,
  fe171: 17.1,
  fe193: 19.3,
  fe211: 21.1,
  fe335: 33.5,
  fe94: 9.4,
  fe131: 13.1,
};

/**
 * Hα, the Balmer line n = 3 → 2, by the Rydberg formula with hydrogen's reduced mass, in air
 * as spectroscopists quote it: 656.28 nm. It forms in gas of 6–10 kK: the chromosphere, and
 * prominences (Parenti 2014).
 */
const RYDBERG_H = RYDBERG_INFINITY / (1 + ELECTRON_MASS_KG / PROTON_MASS_KG);
export const HALPHA_NM = vacuumToAir(1e9 / (RYDBERG_H * (1 / 4 - 1 / 9)));
const HALPHA_PEAK = peak("H I (Balmer α)", Math.log10(TEMPERATURES.prominence), 1, 0.07, 0.12);

/** White light's reference: Planck's law at `WHITE_LIGHT_NM` against the photosphere's. */
const PHOTOSPHERE_RADIANCE = planckRadiance(WHITE_LIGHT_NM, TEMPERATURES.photosphere);
const WHITE_PEAK = peak("continuum", Math.log10(TEMPERATURES.photosphere), 1, 0.1, 0.1);
/** An eclipse's K-corona: electrons scatter the photosphere's light whatever their temperature. */
const THOMSON_PEAK = peak("free electrons", Math.log10(TEMPERATURES.quietCorona), 1, 1, 1);

const RAMP_STOPS = 16;
/* The AIA tables' defining curves over the index u = 0…1 (SolarSoft aia_lct.pro). */
const c0 = (u: number) => u;
const c1 = (u: number) => Math.sqrt(u);
const c2 = (u: number) => u * u;
const c3 = (u: number) => (c1(u) + c2(u) / 2) / 1.5;
/* IDL's "red temperature" table (loadct 3): red full by index 176, green from 120, blue from 190 of 255. */
const r0 = (u: number) => clamp01(u / (176 / 255));
const g0 = (u: number) => clamp01((u - 120 / 255) / (1 - 120 / 255));
const b0 = (u: number) => clamp01((u - 190 / 255) / (1 - 190 / 255));
type Curve = (u: number) => number;

/** A ramp from three channel curves, encoded sRGB in the tables, kept linear here. */
const rampOf = (r: Curve, g: Curve, b: Curve): Rgb[] =>
  Array.from({ length: RAMP_STOPS }, (_, i) => {
    const u = i / (RAMP_STOPS - 1);
    return [decodeSrgb(r(u)), decodeSrgb(g(u)), decodeSrgb(b(u))] as const;
  });

/** Dark to a colour to white, in linear light. */
const rampThrough = (mid: Rgb, at = 0.6): Rgb[] =>
  Array.from({ length: RAMP_STOPS }, (_, i) => {
    const u = i / (RAMP_STOPS - 1);
    if (u <= at) {
      const t = u / at;
      return [mid[0] * t, mid[1] * t, mid[2] * t] as const;
    }
    const t = (u - at) / (1 - at);
    return [
      mid[0] + (1 - mid[0]) * t,
      mid[1] + (1 - mid[1]) * t,
      mid[2] + (1 - mid[2]) * t,
    ] as const;
  });

/** The photosphere's own colour in linear light, from Planck's law at its temperature. */
const planck = hellandBlackbodyLinear(TEMPERATURES.photosphere);
const PHOTOSPHERE_RGB: Rgb = [planck[0], planck[1], planck[2]];
/** Balmer red, the Hα line's colour. */
const BALMER_RED: Rgb = [decodeSrgb(0.9), decodeSrgb(0.15), decodeSrgb(0.12)];
/** The magnetogram's poles: gold for field out of the Sun, blue for field into it. */
export const MAGNETOGRAM_POSITIVE: Rgb = [decodeSrgb(0.89), decodeSrgb(0.75), decodeSrgb(0.48)];
export const MAGNETOGRAM_NEGATIVE: Rgb = [decodeSrgb(0.42), decodeSrgb(0.6), decodeSrgb(0.95)];
/** Grey at zero field. */
export const MAGNETOGRAM_GREY = decodeSrgb(0.5);
/** The magnetogram saturates at this field, tesla. */
export const MAGNETOGRAM_SATURATION_T = 0.1;

const none: LayerWeights = { photosphere: 0, chromosphere: 0, transition: 0, corona: 0, flare: 0 };
const layers = (weights: Partial<LayerWeights>): LayerWeights => ({ ...none, ...weights });

const band = (
  id: PassbandId,
  nm: number,
  peaks: readonly Peak[],
  ramp: Rgb[],
  weights: Partial<LayerWeights>,
  flags: Partial<Pick<Passband, "occultDisc" | "magnetogram">> = {},
): Passband => ({
  id,
  nm,
  peakK: peaks[0]?.kelvin ?? 0,
  widthDex: peaks[0] ? (peaks[0].below + peaks[0].above) / 2 : 0,
  peaks,
  ramp,
  weights: layers(weights),
  occultDisc: false,
  magnetogram: false,
  ...flags,
});

const aia = (id: AiaId, ramp: Rgb[], weights: Partial<LayerWeights>) =>
  band(id, AIA_NM[id], AIA_PEAKS_K[id], ramp, weights);

/**
 * What each band shows of the layers. White light: the photosphere alone (the chromosphere and
 * corona are too thin to show against it). Hα: the chromosphere, with the photosphere's
 * continuum under it. 304 Å: the transition region's He II, the upper chromosphere, a little
 * corona (Si XI). 171 Å: the quiet corona and the top of the transition region. 193 and 211 Å:
 * the corona, 193 also flare plasma (Fe XXIV). 335 Å: hot active-region loops. 94 and 131 Å:
 * flare plasma first, then the quiet corona (Fe X) and the transition region (Fe VIII). Eclipse:
 * the corona, with the pink chromosphere and prominences at the limb.
 */
export const PASSBANDS: Readonly<Record<PassbandId, Passband>> = {
  white: band("white", 0, [WHITE_PEAK], rampThrough(PHOTOSPHERE_RGB, 0.75), { photosphere: 1 }),
  halpha: band("halpha", HALPHA_NM, [HALPHA_PEAK], rampThrough(BALMER_RED, 0.7), {
    photosphere: 0.15,
    chromosphere: 1,
  }),
  he304: aia("he304", rampOf(r0, g0, b0), { chromosphere: 0.6, transition: 1, corona: 0.15 }),
  fe171: aia("fe171", rampOf(r0, c0, b0), { transition: 0.3, corona: 1 }),
  fe193: aia("fe193", rampOf(c1, c0, c2), { corona: 1, flare: 0.4 }),
  fe211: aia("fe211", rampOf(c1, c0, c3), { corona: 1 }),
  fe335: aia("fe335", rampOf(c2, c0, c3), { corona: 1 }),
  fe94: aia("fe94", rampOf(c2, c3, c0), { corona: 0.5, flare: 1 }),
  fe131: aia("fe131", rampOf(g0, r0, r0), { transition: 0.5, corona: 0.3, flare: 1 }),
  eclipse: band(
    "eclipse",
    0,
    [THOMSON_PEAK],
    rampThrough(PHOTOSPHERE_RGB, 0.75),
    { corona: 1, chromosphere: 0.3 },
    { occultDisc: true },
  ),
  magnetogram: band(
    "magnetogram",
    0,
    [],
    [
      MAGNETOGRAM_NEGATIVE,
      [MAGNETOGRAM_GREY, MAGNETOGRAM_GREY, MAGNETOGRAM_GREY],
      MAGNETOGRAM_POSITIVE,
    ],
    { photosphere: 1 },
    { magnetogram: true },
  ),
};

export const PASSBAND_IDS: readonly PassbandId[] = keysOf(PASSBANDS);

/**
 * How strongly a band answers plasma at `kelvin`, 0–1 of its peak. White light is Planck's law
 * at the reference wavelength against the photosphere (cooler gas dimmer, hotter no brighter
 * than 1); an eclipse's scattering sees every temperature alike; the magnetogram sees none; the
 * line bands sum their peaks' two-sided log-normals.
 */
export function response(id: PassbandId, kelvin: number) {
  if (!(kelvin > 0)) return 0;
  if (id === "white") return clamp01(planckRadiance(WHITE_LIGHT_NM, kelvin) / PHOTOSPHERE_RADIANCE);
  if (id === "eclipse") return 1;
  const { peaks } = PASSBANDS[id];
  if (peaks.length === 0) return 0;
  const logT = Math.log10(kelvin);
  let sum = 0;
  for (const p of peaks) {
    const d = (logT - p.logT) / (logT < p.logT ? p.below : p.above);
    sum += p.weight * Math.exp(-0.5 * d * d);
  }
  return Math.min(1, sum);
}

/** The band's colour at a brightness 0–1, linear sRGB, from its ramp. */
export function rampColor(
  id: PassbandId,
  brightness: number,
  out: [number, number, number] = [0, 0, 0],
) {
  const { ramp } = PASSBANDS[id];
  const u = clamp01(brightness) * (ramp.length - 1);
  const i = Math.min(ramp.length - 2, Math.floor(u));
  const t = u - i;
  const a = ramp[i]!;
  const b = ramp[i + 1]!;
  out[0] = a[0] + (b[0] - a[0]) * t;
  out[1] = a[1] + (b[1] - a[1]) * t;
  out[2] = a[2] + (b[2] - a[2]) * t;
  return out;
}

/** The magnetogram's colour for a radial field, tesla: grey through gold (out) or blue (in). */
export function magnetogramColor(fieldT: number, out: [number, number, number] = [0, 0, 0]) {
  const t = clamp01(Math.abs(fieldT) / MAGNETOGRAM_SATURATION_T);
  const pole = fieldT >= 0 ? MAGNETOGRAM_POSITIVE : MAGNETOGRAM_NEGATIVE;
  out[0] = MAGNETOGRAM_GREY + (pole[0] - MAGNETOGRAM_GREY) * t;
  out[1] = MAGNETOGRAM_GREY + (pole[1] - MAGNETOGRAM_GREY) * t;
  out[2] = MAGNETOGRAM_GREY + (pole[2] - MAGNETOGRAM_GREY) * t;
  return out;
}

/**
 * Ring systems as radial zones of optical depth and colour, and the strip a
 * renderer textures a ring annulus with.
 */
import { decodeSrgb } from "../science/color";
import type { PlanetId } from "./ephemeris";

/**
 * A ring system as radial zones, km from the planet's centre. Later zones
 * override earlier ones (gaps are zones with τ = 0). τ is normal optical depth;
 * rgb is the particles' colour, darkened by their albedo against Saturn's B ring.
 */
export type RingZone = {
  from: number;
  to: number;
  /** τ at `from` and `to`, linear between. */
  tau: readonly [number, number];
  rgb: readonly [number, number, number];
  /** Fraction of τ in micrometre dust, which scatters light forward; 0 when absent. */
  dust?: number;
};
export type RingSystem = { innerKm: number; outerKm: number; zones: readonly RingZone[] };

const C_RING = [150, 138, 120] as const;
const B_RING = [232, 214, 182] as const;
const CASSINI = [142, 134, 124] as const;
const A_RING = [214, 197, 168] as const;
/** Uranus's ring particles have albedo ~0.015–0.05 (Ockert et al. 1987; Smith et al. 1986), drawn at 0.03 against 0.5 for Saturn's B ring. */
const URANUS_RING = [62, 62, 64] as const;
const NEPTUNE_RING = [74, 66, 60] as const;
const gap = (centre: number, width: number): RingZone => ({
  from: centre - width / 2,
  to: centre + width / 2,
  tau: [0, 0],
  rgb: C_RING,
});
const narrow = (
  centre: number,
  width: number,
  tau: number,
  rgb: RingZone["rgb"],
  dust = 0,
): RingZone => ({
  from: centre - width / 2,
  to: centre + width / 2,
  tau: [tau, tau],
  rgb,
  dust,
});

/**
 * Saturn: edges, gaps and ringlets from the PDS Ring-Moon Systems Node tables (Cassini era);
 * optical depths from the Cassini UVIS β Cen occultation (2008, PDS COUVIS_8001), inside the
 * ranges of Colwell et al. 2009 ("Saturn from Cassini-Huygens"). The G and E rings
 * (τ ≈ 10⁻⁶–10⁻⁵) are invisible here.
 */
const SATURN_RINGS: RingSystem = {
  innerKm: 66_900,
  outerKm: 140_600,
  zones: [
    { from: 66_900, to: 74_491, tau: [0.001, 0.001], rgb: C_RING },
    { from: 74_491, to: 84_000, tau: [0.03, 0.1], rgb: C_RING },
    { from: 84_000, to: 91_975, tau: [0.08, 0.08], rgb: C_RING },
    /* Outer C-ring plateaus. */
    narrow(84_850, 200, 0.42, C_RING),
    narrow(86_490, 230, 0.4, C_RING),
    narrow(88_480, 230, 0.25, C_RING),
    narrow(89_245, 100, 0.25, C_RING),
    narrow(89_865, 160, 0.3, C_RING),
    narrow(90_510, 210, 0.33, C_RING),
    gap(77_837, 178),
    narrow(77_879, 23, 4, C_RING),
    gap(87_477, 267),
    narrow(87_510, 59, 1.5, C_RING),
    gap(88_705, 37),
    narrow(88_711, 17, 1, C_RING),
    gap(90_211, 21),
    { from: 91_975, to: 99_000, tau: [0.9, 1.6], rgb: B_RING },
    { from: 99_000, to: 110_000, tau: [3, 4.5], rgb: B_RING },
    { from: 110_000, to: 115_000, tau: [3, 2.5], rgb: B_RING },
    { from: 115_000, to: 117_570, tau: [2.5, 1.6], rgb: B_RING },
    { from: 117_570, to: 122_050, tau: [0.08, 0.14], rgb: CASSINI },
    gap(117_750, 360),
    narrow(117_815, 18, 1.5, CASSINI),
    /* Laplace gap and ringlet. */
    gap(119_966, 241),
    narrow(120_058, 41, 1, CASSINI),
    { from: 122_050, to: 126_000, tau: [0.75, 0.6], rgb: A_RING },
    { from: 126_000, to: 136_770, tau: [0.55, 0.45], rgb: A_RING },
    gap(133_584, 322),
    gap(136_505, 35),
    { from: 136_770, to: 139_380, tau: [0.0001, 0.0001], rgb: CASSINI },
    /* The F ring: 98 % fine dust in the light it scatters (Showalter et al. 1992). */
    narrow(140_224, 50, 0.15, A_RING, 0.98),
  ],
};

/**
 * Uranus: radii, widths and τ from the NSSDC Uranian Rings Fact Sheet and the PDS table
 * (French et al. 1991). Those give only τ ≥ 0.3 for γ; its 1.5 is the Voyager 2 radio
 * occultation profile (PDS VG_2803) halved for diffraction loss (French et al. 2024).
 */
const URANUS_RINGS: RingSystem = {
  innerKm: 41_700,
  outerKm: 51_300,
  zones: [
    narrow(41_837, 1.5, 0.3, URANUS_RING),
    narrow(42_234, 2, 0.5, URANUS_RING),
    narrow(42_571, 2, 0.3, URANUS_RING),
    narrow(44_718, 7, 0.4, URANUS_RING),
    narrow(45_661, 8, 0.3, URANUS_RING),
    narrow(47_176, 2, 0.4, URANUS_RING),
    narrow(47_627, 3, 1.5, URANUS_RING),
    narrow(48_300, 5, 0.5, URANUS_RING),
    narrow(50_024, 2, 0.1, URANUS_RING),
    narrow(51_149, 58, 1.2, URANUS_RING),
  ],
};

/**
 * Neptune: NSSDC Neptunian Rings Fact Sheet and the PDS table. Dusty and faint
 * (τ ≈ 10⁻⁴–10⁻²); the Adams ring arcs (τ ≈ 0.1 over ~40° of longitude) are averaged
 * into the ring. Arago has no published τ: 0.002 is an estimate. Dust fractions are the
 * middles of the Voyager ranges (Porco et al. 1995; de Pater et al. 2018): Galle and
 * Le Verrier 0.4–0.7, Lassell and Adams 0.2–0.4, the arcs 0.4–0.7, so 0.5 for Adams with
 * its arcs; Arago, unmeasured, as Lassell, whose outer edge it is.
 */
const NEPTUNE_RINGS: RingSystem = {
  innerKm: 40_900,
  outerKm: 63_000,
  zones: [
    { from: 40_900, to: 42_900, tau: [0.0001, 0.0001], rgb: NEPTUNE_RING, dust: 0.55 },
    { from: 53_200, to: 57_200, tau: [0.0001, 0.0001], rgb: NEPTUNE_RING, dust: 0.3 },
    narrow(53_200, 100, 0.01, NEPTUNE_RING, 0.55),
    narrow(57_200, 100, 0.002, NEPTUNE_RING, 0.3),
    narrow(62_933, 15, 0.02, NEPTUNE_RING, 0.5),
  ],
};

/**
 * Jupiter has no entry: its main ring's τ ≈ 5 × 10⁻⁶ (PDS; Ockert-Bell et al. 1999)
 * leaves it invisible in reflected sunlight.
 */
export const RINGS: Partial<Record<PlanetId, RingSystem>> = {
  saturn: SATURN_RINGS,
  uranus: URANUS_RINGS,
  neptune: NEPTUNE_RINGS,
};

/**
 * A ring system baked across its width, inner to outer edge: per texel the normal opacity
 * 1 − e^(−τ) averaged over the texel, and the particles' colour (sRGB, 0–255, three per
 * texel) and dust fraction, both weighted by opacity. Floats, so a ring of τ ≈ 10⁻⁴ is kept.
 */
export type RingStrip = {
  texels: number;
  opacity: Float32Array;
  rgb: Float32Array;
  dust: Float32Array;
};

/** Rec. 709 luminance weights of linear sRGB. */
const LUMA = [0.2126, 0.7152, 0.0722] as const;

/** A system's brightest ring as normal reflectance: a zone's peak opacity times its particles' linear luminance. */
function peakReflectance(system: RingSystem) {
  let peak = 0;
  for (const zone of system.zones) {
    const luminance = zone.rgb.reduce((sum, c, i) => sum + decodeSrgb(c / 255) * LUMA[i]!, 0);
    peak = Math.max(peak, (1 - Math.exp(-Math.max(...zone.tau))) * luminance);
  }
  return peak;
}

/**
 * The exposure that shows a system's brightest ring as bright as Saturn's: 1 for Saturn,
 * about 18 for Uranus, about 600 for Neptune. A long exposure of the rings, as Voyager took
 * them; the eye never sees them so.
 */
export function ringExposure(system: RingSystem) {
  return Math.max(1, peakReflectance(SATURN_RINGS) / peakReflectance(system));
}

/** One texel's running sums: opacity, and colour and dust weighted by it. */
function texelSums() {
  let a = 0;
  let r = 0;
  let g = 0;
  let b = 0;
  let d = 0;
  return {
    add(opacity: number, red: number, green: number, blue: number, dust: number) {
      a += opacity;
      r += red * opacity;
      g += green * opacity;
      b += blue * opacity;
      d += dust * opacity;
    },
    /** Writes texel `t` of `out` as the mean of `count` samples. */
    write(out: RingStrip, t: number, count: number) {
      out.opacity[t] = a / count;
      if (a <= 0) return;
      out.rgb[t * 3] = r / a;
      out.rgb[t * 3 + 1] = g / a;
      out.rgb[t * 3 + 2] = b / a;
      out.dust[t] = d / a;
    },
  };
}

const emptyStrip = (texels: number): RingStrip => ({
  texels,
  opacity: new Float32Array(texels),
  rgb: new Float32Array(texels * 3),
  dust: new Float32Array(texels),
});

/** The system's strip at `texels`, each texel averaged over `samples` radii. */
export function ringStrip(system: RingSystem, texels: number, samples = 32): RingStrip {
  const out = emptyStrip(texels);
  const span = system.outerKm - system.innerKm;
  for (let t = 0; t < texels; t += 1) {
    const sums = texelSums();
    for (let s = 0; s < samples; s += 1) {
      const km = system.innerKm + ((t + (s + 0.5) / samples) / texels) * span;
      let zone: RingZone | undefined;
      for (const z of system.zones) if (km >= z.from && km < z.to) zone = z;
      if (!zone) continue;
      const f = (km - zone.from) / (zone.to - zone.from);
      const a = 1 - Math.exp(-(zone.tau[0] + (zone.tau[1] - zone.tau[0]) * f));
      sums.add(a, zone.rgb[0], zone.rgb[1], zone.rgb[2], zone.dust ?? 0);
    }
    sums.write(out, t, samples);
  }
  return out;
}

/** The strip at half the texels, by the same weighting: one mipmap level down. */
function halve(strip: RingStrip): RingStrip {
  const out = emptyStrip(Math.max(1, Math.floor(strip.texels / 2)));
  for (let t = 0; t < out.texels; t += 1) {
    /* The last texel also takes an odd one left over. */
    const end = t === out.texels - 1 ? strip.texels : 2 * t + 2;
    const sums = texelSums();
    for (let i = 2 * t; i < end; i += 1) {
      const { opacity, rgb, dust } = strip;
      sums.add(opacity[i]!, rgb[i * 3]!, rgb[i * 3 + 1]!, rgb[i * 3 + 2]!, dust[i]!);
    }
    sums.write(out, t, end - 2 * t);
  }
  return out;
}

/** The strip and its mipmap chain, down to one texel. */
export function ringStripLevels(system: RingSystem, texels: number): RingStrip[] {
  let level = ringStrip(system, texels);
  const levels = [level];
  while (level.texels > 1) levels.push((level = halve(level)));
  return levels;
}

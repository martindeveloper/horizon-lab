/**
 * The Milky Way as the sky shows it from the solar system: a painted map in galactic
 * coordinates (today's thin disk with its bulge, the Great Rift and the Coalsack; the early
 * thick disk without the dust), drawn as a faint unresolved glow on a sphere round the camera
 * and as grains sampled from the same map, with a thin even field of faint stars away from
 * the band. A host may turn the band with the Sun's orbit and blend the eras, or carry it
 * with a moving camera and fade it as a map of the Galaxy takes over.
 */
import {
  AdditiveBlending,
  BackSide,
  BufferAttribute,
  CanvasTexture,
  Color,
  Group,
  LinearFilter,
  Mesh,
  Points,
  RepeatWrapping,
  ShaderMaterial,
  SphereGeometry,
  Vector2,
  Vector3,
  type BufferGeometry,
  type Texture,
} from "three";

import { lcg, onSphere, valueNoise2 } from "@horizon/toolkit/math";
import {
  GALACTIC_CENTRE,
  GALACTIC_EAST,
  GALACTIC_POLE,
  pointsGeometry,
} from "@horizon/toolkit/scene";

import { FAR_SKY_PC } from "../bright-stars";
import BAND_FRAG from "./shaders/band.frag.glsl";
import BAND_VERT from "./shaders/band.vert.glsl";

/** The sky's point counts: the Milky Way's resolved grains and the faint field stars. */
export type SkyCounts = { milkyWay: number; fieldStars: number };

/** Point size in pixels for a magnitude; Sirius is about 4.6 px, 3.5 mag is 1.3 px. */
export function starSize(mag: number) {
  return Math.max(1.1, 4.6 - (mag + 1.46) * 0.66);
}

/* A painted point's temperature by its tint, for the Doppler shift of a sky flown through. */
const WARM_K = 4500;
const PLAIN_K = 5800;
const BLUE_K = 7500;

/** A painted point's temperature from its colour: warm, plain or blue-white. */
const kelvinOf = (r: number, g: number, b: number) =>
  r > b * 1.05 ? WARM_K : b > r * 1.05 ? BLUE_K : PLAIN_K;

/**
 * Adds the attributes a sky flown through reads (`distance` parsecs, `temperature` kelvin) to
 * painted points, so a ship's star shader draws them beside the catalogue's stars.
 */
function paintedAttributes(geometry: BufferGeometry, col: Float32Array, count: number) {
  const distances = new Float32Array(count).fill(FAR_SKY_PC);
  const temperatures = new Float32Array(count);
  for (let i = 0; i < count; i += 1)
    temperatures[i] = kelvinOf(col[i * 3]!, col[i * 3 + 1]!, col[i * 3 + 2]!);
  geometry.setAttribute("distance", new BufferAttribute(distances, 1));
  geometry.setAttribute("temperature", new BufferAttribute(temperatures, 1));
  return geometry;
}

/**
 * A thin, even field of faint stars away from the band. Not real stars, so they never fade
 * with time; the Milky Way itself is sampled from its map. With `parallax` the points carry
 * the attributes of a sky flown through.
 */
export function fieldStars(count: number, parallax = false) {
  const rnd = lcg(5);
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const size = new Float32Array(count);
  const tint = new Color();
  for (let i = 0; i < count; i += 1) {
    const p = onSphere(rnd);
    /* The pole of the direction is up, y. */
    pos[i * 3] = p[0];
    pos[i * 3 + 1] = p[2];
    pos[i * 3 + 2] = p[1];
    const pick = rnd();
    tint.set(pick > 0.9 ? "#ffd6a0" : pick > 0.68 ? "#b9cce6" : "#f4f1ea");
    const mag = 3.4 + rnd() * rnd() * 3.2;
    const bright = 0.2 + 0.45 * 10 ** (-0.4 * (mag - 3.4));
    col[i * 3] = tint.r * bright;
    col[i * 3 + 1] = tint.g * bright;
    col[i * 3 + 2] = tint.b * bright;
    size[i] = starSize(mag) * 0.9;
  }
  const geometry = pointsGeometry(pos, col, size);
  return parallax ? paintedAttributes(geometry, col, count) : geometry;
}

/** Periodic in longitude so the map has no seam. */
function fbm(l: number, b: number, scale: number) {
  const a = l * Math.PI * 2;
  const x = Math.cos(a) * scale + 7.3;
  const y = Math.sin(a) * scale + 3.1;
  const z = b * scale * 2;
  return (
    valueNoise2(x + z, y) * 0.5 +
    valueNoise2(x * 2.1 + z * 2, y * 2.1 + 5) * 0.3 +
    valueNoise2(x * 4.3, y * 4.3 + z * 4) * 0.2
  );
}

/**
 * Brightness of the band at galactic longitude u∈[0,1) (0 = centre) and latitude
 * v∈[0,1] (0.5 = plane). Today: a thin disk with the bulge toward the centre,
 * the Great Rift and the Coalsack as dust. Early: a thicker, smoother, bluer
 * disk without the dust lane, as the thick-disk era would have looked.
 */
type BandMap = {
  texture: CanvasTexture;
  sample: (count: number, seed: number, sizeScale?: number, brightness?: number) => BufferGeometry;
};

function bandMap(mode: "today" | "early", parallax: boolean): BandMap {
  const W = 512;
  const H = 256;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext("2d");
  if (!g) throw new Error("2D canvas unavailable");
  const img = g.createImageData(W, H);
  const data = img.data;
  const density = new Float32Array(W * H);
  for (let y = 0; y < H; y += 1) {
    const b = (y / H - 0.5) * 180;
    for (let x = 0; x < W; x += 1) {
      const u = x / W;
      const lDeg = u * 360;
      const toCentre = Math.min(lDeg, 360 - lDeg);
      const clumps = fbm(u, y / H, mode === "today" ? 14 : 4);
      let value: number;
      let r: number;
      let gg: number;
      let bb: number;
      if (mode === "today") {
        const sigma = 5.5 + 7 * Math.exp(-toCentre / 60);
        const disk =
          Math.exp(-(b * b) / (2 * sigma * sigma)) * (0.55 + 0.45 * Math.exp(-toCentre / 110));
        const bulge =
          Math.exp(-((toCentre / 14) ** 2 + ((b + 1) / 9) ** 2)) * 0.9 +
          Math.exp(-((toCentre / 30) ** 2 + (b / 18) ** 2)) * 0.35;
        const riftL = lDeg < 90 || lDeg > 300;
        const riftCentre = lDeg < 90 ? 1.2 + lDeg * 0.02 : -1.5;
        const rift = riftL
          ? Math.exp(-(((b - riftCentre) / 2.2) ** 2)) *
            (0.55 + 0.45 * fbm(u + 0.3, y / H, 14)) *
            0.8
          : 0;
        const coalsack = Math.exp(-(((lDeg - 303) / 3.5) ** 2) - ((b + 1.2) / 3) ** 2) * 0.9;
        value = (disk + bulge) * (0.3 + 1.0 * clumps) * (1 - 0.8 * Math.min(1, rift + coalsack));
        const warm = Math.min(1, bulge * 1.4);
        r = 0.86 + 0.1 * warm;
        gg = 0.86;
        bb = 0.92 - 0.16 * warm;
      } else {
        const sigma = 16 + 10 * Math.exp(-toCentre / 60);
        const disk =
          Math.exp(-(b * b) / (2 * sigma * sigma)) * (0.5 + 0.5 * Math.exp(-toCentre / 120));
        const bulge = Math.exp(-((toCentre / 24) ** 2 + (b / 16) ** 2)) * 0.55;
        value = (disk + bulge) * (0.72 + 0.5 * clumps) * 1.05;
        r = 0.7 + 0.2 * bulge;
        gg = 0.78;
        bb = 0.95 - 0.15 * bulge;
      }
      const i = (y * W + x) * 4;
      const a = Math.min(1, value);
      density[y * W + x] = a * Math.cos((b * Math.PI) / 180);
      data[i] = Math.round(r * 255);
      data[i + 1] = Math.round(gg * 255);
      data[i + 2] = Math.round(bb * 255);
      data[i + 3] = Math.round(a * 255);
    }
  }
  g.putImageData(img, 0, 0);
  const tex = new CanvasTexture(canvas);
  tex.wrapS = RepeatWrapping;
  tex.minFilter = LinearFilter;
  tex.magFilter = LinearFilter;
  let peak = 0;
  for (const d of density) if (d > peak) peak = d;
  /**
   * Stars drawn from the map by rejection sampling, so the unresolved glow and
   * the resolved grains follow the same bulge, rift and dust. Positions are in
   * today's galactic frame; the group they sit in turns with the epoch.
   */
  const sample = (count: number, seed: number, sizeScale = 1, brightness = 1) => {
    const rnd = lcg(seed);
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const size = new Float32Array(count);
    const v = new Vector3();
    let n = 0;
    while (n < count) {
      const x = Math.floor(rnd() * W);
      const y = Math.floor(rnd() * H);
      const d = density[y * W + x]!;
      if (rnd() * peak > d) continue;
      const l = ((x + rnd()) / W) * Math.PI * 2;
      const b = ((y + rnd()) / H - 0.5) * Math.PI;
      v.copy(GALACTIC_CENTRE)
        .multiplyScalar(Math.cos(l) * Math.cos(b))
        .addScaledVector(GALACTIC_EAST, Math.sin(l) * Math.cos(b))
        .addScaledVector(GALACTIC_POLE, Math.sin(b));
      pos[n * 3] = v.x;
      pos[n * 3 + 1] = v.y;
      pos[n * 3 + 2] = v.z;
      const i = (y * W + x) * 4;
      const bright = (0.5 + rnd() * rnd() * 1.2) * brightness;
      col[n * 3] = (data[i]! / 255) * bright;
      col[n * 3 + 1] = (data[i + 1]! / 255) * bright;
      col[n * 3 + 2] = (data[i + 2]! / 255) * bright;
      size[n] = (1.0 + rnd() * rnd() * 1.5) * sizeScale;
      n += 1;
    }
    const geometry = pointsGeometry(pos, col, size);
    return parallax ? paintedAttributes(geometry, col, count) : geometry;
  };
  return { texture: tex, sample };
}

/**
 * How a ship's motion reaches the band: the direction of travel, β and γ, and the blackbody
 * lookup the colour shift is read from. Without it the band is the sky at rest.
 */
export type BandMotion = {
  forward: Vector3;
  beta: { value: number };
  gamma: { value: number };
  lut: Texture;
  /** The lookup's temperature range, kelvin. */
  lutRange: readonly [number, number];
};

export type MilkyWayOptions = {
  /**
   * The grains' material: a point shader with `fade` and `tint` uniforms (the host's star
   * material, so the grains draw as its stars do). One is made per era.
   */
  grain: () => ShaderMaterial;
  /** The eras drawn: today's disk alone, or both for a host that blends toward the early one. */
  eras?: "today" | "both";
  /** The grains carry the attributes of a sky flown through (see `fieldStars`). */
  parallax?: boolean;
  /** The band shifts with the ship's motion: aberration, Doppler colour and brightness. */
  motion?: BandMotion;
};

/**
 * The Milky Way: a faint unresolved glow plus thousands of grains sampled from
 * the same map, for today's thin disk and for the early thick disk. Everything
 * sits in one group that turns about the galactic pole with the Sun's orbit.
 */
export function createMilkyWay(grains: number, options: MilkyWayOptions) {
  const parallax = options.parallax ?? false;
  const both = (options.eras ?? "both") === "both";
  const today = bandMap("today", parallax);
  const early = both ? bandMap("early", parallax) : today;
  const { motion } = options;
  const material = new ShaderMaterial({
    /* Today's disk alone samples one map; a moving host reads the motion. */
    defines: { ...(motion ? { RELATIVITY: "" } : {}), ...(both ? {} : { TODAY_ONLY: "" }) },
    uniforms: {
      today: { value: today.texture },
      early: { value: early.texture },
      centre: { value: GALACTIC_CENTRE.clone() },
      east: { value: GALACTIC_EAST.clone() },
      pole: { value: GALACTIC_POLE.clone() },
      era: { value: 1 },
      strength: { value: 0.16 },
      tint: { value: new Color("#ffffff") },
      ...(motion
        ? {
            forward: { value: motion.forward },
            beta: motion.beta,
            gamma: motion.gamma,
            bbLut: { value: motion.lut },
            lutRange: { value: new Vector2(motion.lutRange[0], motion.lutRange[1]) },
          }
        : {}),
    },
    vertexShader: BAND_VERT,
    fragmentShader: BAND_FRAG,
    side: BackSide,
    depthWrite: false,
    depthTest: false,
    transparent: false,
    blending: AdditiveBlending,
    toneMapped: false,
  });
  const geometry = new SphereGeometry(1, 36, 24);
  const band = new Mesh(geometry, material);
  band.renderOrder = -4;
  band.frustumCulled = false;
  /* Resolved grains plus a clumpy unresolved haze of large soft points, both from the map. */
  const sampled = (n: number) =>
    both
      ? [
          today.sample(n, 17),
          today.sample(Math.round(n * 0.35), 31, 7, 0.3),
          early.sample(Math.round(n * 0.6), 23),
          early.sample(Math.round(n * 0.24), 37, 9, 0.26),
        ]
      : [today.sample(n, 17), today.sample(Math.round(n * 0.35), 31, 7, 0.3)];
  const todayMaterial = options.grain();
  const earlyMaterial = both ? options.grain() : null;
  const clouds = sampled(grains).map(
    (geometry, i) => new Points(geometry, i < 2 ? todayMaterial : earlyMaterial!),
  );
  for (const p of clouds) {
    p.renderOrder = -3;
    p.frustumCulled = false;
  }
  const group = new Group();
  /* The early disk's haze and grains, then today's. */
  group.add(band, ...clouds.slice().reverse());
  const tint = new Color();
  const setTint = (uniforms: ShaderMaterial["uniforms"]) => {
    const value = uniforms.tint?.value;
    if (value instanceof Color) value.copy(tint);
  };
  return {
    group,
    /**
     * Turn to an orbital phase (the Sun's, about the galactic pole) and set the era blend
     * (0 the early disk, 1 today), the presence `dim` (extinction, or a hand-over to another
     * map of the Galaxy) and the reddening `cloud`.
     */
    set(theta: number, era: number, dim: number, cloud: number) {
      group.quaternion.setFromAxisAngle(GALACTIC_POLE, theta);
      tint.setRGB(1, 1 - 0.2 * cloud, 1 - 0.38 * cloud);
      material.uniforms.era!.value = era;
      material.uniforms.strength!.value = (0.16 + 0.08 * (1 - era)) * dim;
      setTint(material.uniforms);
      todayMaterial.uniforms.fade!.value = era * dim;
      setTint(todayMaterial.uniforms);
      band.visible = dim > 0.004;
      const todayOn = era > 0.01 && dim > 0.004;
      const earlyOn = era < 0.99 && dim > 0.004;
      clouds.forEach((cloud, i) => (cloud.visible = i < 2 ? todayOn : earlyOn));
      if (!earlyMaterial) return;
      earlyMaterial.uniforms.fade!.value = (1 - era) * dim;
      setTint(earlyMaterial.uniforms);
    },
    tint,
    /** Samples `n` resolved grains (and their share of haze) afresh, for a new quality. */
    setGrains(n: number) {
      sampled(n).forEach((next, i) => {
        const cloud = clouds[i]!;
        cloud.geometry.dispose();
        cloud.geometry = next;
      });
    },
    dispose() {
      today.texture.dispose();
      if (both) early.texture.dispose();
      material.dispose();
      geometry.dispose();
      for (const cloud of clouds) cloud.geometry.dispose();
      todayMaterial.dispose();
      earlyMaterial?.dispose();
    },
  };
}

/**
 * The sky behind the solar system: a celestial sphere in the scene's ecliptic
 * frame, carried with the camera. Bright stars come from the shared J2000
 * catalogue; the Milky Way band is a painted map in galactic coordinates
 * whose centre direction slides along the band as the Sun orbits the Galaxy,
 * and whose shape changes from the thick-disk era to today's thin disk.
 */
import {
  AdditiveBlending,
  BackSide,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  Group,
  LinearFilter,
  Mesh,
  Points,
  PointsMaterial,
  RepeatWrapping,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
} from "three";

import { galacticAngle } from "@/space/solar-system/model/equations";
import { SUN_BIRTH } from "@/space/solar-system/model/parameters";
import { clamp01, lcg, valueNoise2 } from "@horizon/toolkit/math";
import { GALACTIC_CENTRE, GALACTIC_EAST, GALACTIC_POLE, softCircle } from "@horizon/toolkit/scene";

import { NAMED_STARS_FADE, THIN_DISK_ERA } from "../model/parameters";
import BAND_FRAG from "./shaders/band.frag.glsl";
import BAND_VERT from "./shaders/band.vert.glsl";
import STAR_FRAG from "./shaders/star.frag.glsl";
import STAR_VERT from "./shaders/star.vert.glsl";

/** The Sun's galactic orbital phase for a moment, radians; frozen before the Sun existed. */
export function galacticPhase(yearsAgo: number) {
  return galacticAngle.compute({ t: Math.min(yearsAgo, SUN_BIRTH) });
}

/** Point size in pixels for a magnitude; Sirius is about 4.6 px, 3.5 mag is 1.3 px. */
export function starSize(mag: number) {
  return Math.max(1.1, 4.6 - (mag + 1.46) * 0.66);
}

/**
 * A thin, even field of faint stars away from the band. Not real stars, so
 * they never fade with time; the Milky Way itself is sampled from its map.
 */
export function fieldStars(count: number) {
  const rnd = lcg(5);
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const size = new Float32Array(count);
  const tint = new Color();
  for (let i = 0; i < count; i += 1) {
    const z = rnd() * 2 - 1;
    const theta = rnd() * Math.PI * 2;
    const r = Math.sqrt(Math.max(0, 1 - z * z));
    pos[i * 3] = r * Math.cos(theta);
    pos[i * 3 + 1] = z;
    pos[i * 3 + 2] = r * Math.sin(theta);
    const pick = rnd();
    tint.set(pick > 0.9 ? "#ffd6a0" : pick > 0.68 ? "#b9cce6" : "#f4f1ea");
    const mag = 3.4 + rnd() * rnd() * 3.2;
    const bright = 0.2 + 0.45 * 10 ** (-0.4 * (mag - 3.4));
    col[i * 3] = tint.r * bright;
    col[i * 3 + 1] = tint.g * bright;
    col[i * 3 + 2] = tint.b * bright;
    size[i] = starSize(mag) * 0.9;
  }
  return pointsGeometry(pos, col, size);
}

function pointsGeometry(pos: Float32Array, col: Float32Array, size: Float32Array) {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(pos, 3));
  geometry.setAttribute("color", new BufferAttribute(col, 3));
  geometry.setAttribute("size", new BufferAttribute(size, 1));
  return geometry;
}

/** `fade` is presence (real stars fade in the deep past), `tint` the extinction colour. */
export function starMaterial(dpr: { value: number }) {
  return new ShaderMaterial({
    uniforms: {
      dpr,
      fade: { value: 1 },
      tint: { value: new Color("#ffffff") },
    },
    vertexShader: STAR_VERT,
    fragmentShader: STAR_FRAG,
    vertexColors: true,
    transparent: false,
    depthWrite: false,
    depthTest: false,
    blending: AdditiveBlending,
    toneMapped: false,
  });
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

function bandMap(mode: "today" | "early"): BandMap {
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
    return pointsGeometry(pos, col, size);
  };
  return { texture: tex, sample };
}

export type MilkyWay = ReturnType<typeof createMilkyWay>;

/**
 * The Milky Way: a faint unresolved glow plus thousands of grains sampled from
 * the same map, for today's thin disk and for the early thick disk. Everything
 * sits in one group that turns about the galactic pole with the Sun's orbit.
 */
export function createMilkyWay(dpr: { value: number }, grains: number) {
  const today = bandMap("today");
  const early = bandMap("early");
  const material = new ShaderMaterial({
    uniforms: {
      today: { value: today.texture },
      early: { value: early.texture },
      centre: { value: GALACTIC_CENTRE.clone() },
      east: { value: GALACTIC_EAST.clone() },
      pole: { value: GALACTIC_POLE.clone() },
      era: { value: 1 },
      strength: { value: 0.16 },
      tint: { value: new Color("#ffffff") },
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
  const sampled = (n: number) => [
    today.sample(n, 17),
    early.sample(Math.round(n * 0.6), 23),
    today.sample(Math.round(n * 0.35), 31, 7, 0.3),
    early.sample(Math.round(n * 0.24), 37, 9, 0.26),
  ];
  const [todayGeometry, earlyGeometry, todayHazeGeometry, earlyHazeGeometry] = sampled(grains);
  const todayMaterial = starMaterial(dpr);
  const earlyMaterial = starMaterial(dpr);
  const todayGrains = new Points(todayGeometry, todayMaterial);
  const earlyGrains = new Points(earlyGeometry, earlyMaterial);
  const todayHaze = new Points(todayHazeGeometry, todayMaterial);
  const earlyHaze = new Points(earlyHazeGeometry, earlyMaterial);
  const clouds = [todayGrains, earlyGrains, todayHaze, earlyHaze];
  for (const p of [todayGrains, earlyGrains, todayHaze, earlyHaze]) {
    p.renderOrder = -3;
    p.frustumCulled = false;
  }
  const group = new Group();
  group.add(band, todayHaze, earlyHaze, todayGrains, earlyGrains);
  const tint = new Color();
  return {
    group,
    /** Turn to an orbital phase (see `galacticPhase`) and set the era blend and extinction. */
    set(theta: number, era: number, dim: number, cloud: number) {
      group.quaternion.setFromAxisAngle(GALACTIC_POLE, theta);
      tint.setRGB(1, 1 - 0.2 * cloud, 1 - 0.38 * cloud);
      material.uniforms.era!.value = era;
      material.uniforms.strength!.value = (0.16 + 0.08 * (1 - era)) * dim;
      const bandTint = material.uniforms.tint?.value;
      if (bandTint instanceof Color) bandTint.copy(tint);
      todayMaterial.uniforms.fade!.value = era * dim;
      const todayTint = todayMaterial.uniforms.tint?.value;
      if (todayTint instanceof Color) todayTint.copy(tint);
      earlyMaterial.uniforms.fade!.value = (1 - era) * dim;
      const earlyTint = earlyMaterial.uniforms.tint?.value;
      if (earlyTint instanceof Color) earlyTint.copy(tint);
      todayGrains.visible = todayHaze.visible = era > 0.01;
      earlyGrains.visible = earlyHaze.visible = era < 0.99;
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
      early.texture.dispose();
      material.dispose();
      geometry.dispose();
      for (const cloud of clouds) cloud.geometry.dispose();
      todayMaterial.dispose();
      earlyMaterial.dispose();
    },
  };
}

/**
 * What the sky looks like at a moment. `era` blends thick-disk (0) to today's
 * thin disk with dust (1): the thin disk builds up between about 9 and 7
 * billion years ago. `real` is how much of the catalogue sky still holds: the
 * bright stars' proper motions scramble constellations within ~10⁵ years.
 * `dim`/`tint` are extinction inside the natal cloud and the Sun's envelope.
 */
export function skyEpoch(yearsAgo: number) {
  /* The thin disk fades in over ±1 Gyr about its era; named stars over ±0.4 dex about theirs. */
  const era = clamp01((THIN_DISK_ERA + 1e9 - yearsAgo) / 2e9);
  const real =
    1 - clamp01((Math.log10(Math.max(1, yearsAgo)) - Math.log10(NAMED_STARS_FADE) + 0.5) / 0.8);
  const inside = yearsAgo > SUN_BIRTH ? clamp01(1 - (yearsAgo - SUN_BIRTH) / 1.2e6) : 0;
  const envelope = yearsAgo <= SUN_BIRTH ? clamp01(1 - (SUN_BIRTH - yearsAgo) / 2e6) : 0;
  const cloud = Math.max(inside, envelope);
  const dim = 1 - 0.68 * cloud;
  return { era, real, dim, cloud };
}

/**
 * A presolar molecular cloud: a few clumpy filaments of cold gas, seeded, drawn
 * at the camera's scale so the view is never empty before the Sun exists.
 */
export function molecularCloud(count: number) {
  const rnd = lcg(71);
  const gauss = () => {
    const u = Math.max(1e-6, rnd());
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(Math.PI * 2 * rnd());
  };
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const cold = new Color("#4f78c8");
  const dust = new Color("#8a6a4a");
  const warm = new Color("#c9a978");
  const tint = new Color();
  const filaments = 5;
  for (let i = 0; i < count; i += 1) {
    const f = Math.floor(rnd() * filaments);
    const phase = (f / filaments) * Math.PI * 2 + 0.7;
    const t = rnd() * 2 - 1;
    const r = 0.25 + Math.abs(t) * 0.75;
    const ang = phase + t * 1.6 + gauss() * 0.08;
    const x = r * Math.cos(ang) + gauss() * 0.06;
    const z = r * Math.sin(ang) + gauss() * 0.06;
    const y = gauss() * 0.18 * (0.4 + r);
    pos[i * 3] = x;
    pos[i * 3 + 1] = y;
    pos[i * 3 + 2] = z;
    const pick = rnd();
    tint.copy(pick < 0.12 ? dust : pick < 0.2 ? warm : cold);
    const fade = (0.25 + 0.75 * Math.exp(-r * 1.2)) * (0.35 + rnd() * 0.65);
    col[i * 3] = tint.r * fade;
    col[i * 3 + 1] = tint.g * fade;
    col[i * 3 + 2] = tint.b * fade;
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(pos, 3));
  geometry.setAttribute("color", new BufferAttribute(col, 3));
  return geometry;
}

/** The cloud's soft additive points. */
export function cloudMaterial() {
  return new PointsMaterial({
    map: softCircle(),
    vertexColors: true,
    size: 12,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.07,
    depthWrite: false,
    toneMapped: false,
    blending: AdditiveBlending,
  });
}

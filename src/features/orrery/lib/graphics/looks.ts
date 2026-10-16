import {
  AdditiveBlending,
  BackSide,
  CanvasTexture,
  Color,
  DataTexture,
  DoubleSide,
  LinearFilter,
  LinearMipmapLinearFilter,
  LineBasicMaterial,
  MeshBasicMaterial,
  NormalBlending,
  PointsMaterial,
  RepeatWrapping,
  ShaderMaterial,
  SpriteMaterial,
  SRGBColorSpace,
  Vector2,
  Vector3,
  type Texture,
} from "three";

import { includesId, keysOf, partialFrom, recordFrom } from "@/lib/records";
import {
  FIGURES,
  MAPS,
  MOONS,
  PLANET_IDS,
  RINGS,
  ringStrip,
  type BodyId,
  type MoonId,
  type NamedId,
  type PlanetId,
  type RingSystem,
} from "@horizon/toolkit/bodies";
import { surfaceJob, surfaceMap, type SurfaceJob } from "@horizon/toolkit/bodies/surfaces";
import { clamp01, valueNoise2 } from "@horizon/toolkit/math";

import { closeUpMapWidth } from "../scene/close-up-flight";
import GAS_FRAG from "./shaders/gas.frag.glsl";
import PLANET_FRAG from "./shaders/planet.frag.glsl";
import RING_FRAG from "./shaders/ring.frag.glsl";
import ROCK_FRAG from "./shaders/rock.frag.glsl";
import ROCK_VERT from "./shaders/rock.vert.glsl";
import SHELL_FRAG from "./shaders/shell.frag.glsl";
import SHELL_VERT from "./shaders/shell.vert.glsl";
import SUN_FRAG from "./shaders/sun.frag.glsl";
/**
 * Materials and textures, painted once at startup. Body maps and ring strips
 * come from `@horizon/toolkit/bodies`; sprites and the young disks are
 * small canvases. Bodies are lit by the Sun at the origin in linear light: no
 * photo plates, no post-processing. Everything here is disposed with the engine.
 */
import VERT from "./shaders/surface.vert.glsl";

type Rgb = [number, number, number];
const mix3 = (a: Rgb, b: Rgb, t: number): Rgb => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

type Painter = (lon: number, lat: number) => [number, number, number, number];

function paint(w: number, h: number, fn: Painter) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext("2d");
  if (!g) throw new Error("2D canvas unavailable");
  const img = g.createImageData(w, h);
  const data = img.data;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const px = fn(x / w, y / h);
      const i = (y * w + x) * 4;
      data[i] = px[0];
      data[i + 1] = px[1];
      data[i + 2] = px[2];
      data[i + 3] = px[3];
    }
  }
  g.putImageData(img, 0, 0);
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 2;
  return tex;
}

function radialSprite(stops: [number, string][], rays = 0) {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const g = canvas.getContext("2d");
  if (!g) throw new Error("2D canvas unavailable");
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  for (const [t, color] of stops) grd.addColorStop(t, color);
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  if (rays > 0) {
    g.globalCompositeOperation = "lighter";
    for (let i = 0; i < rays; i += 1) {
      const a = (i / rays) * Math.PI * 2 + 0.2;
      const ray = g.createLinearGradient(64, 64, 64 + Math.cos(a) * 64, 64 + Math.sin(a) * 64);
      ray.addColorStop(0, "rgba(255, 220, 160, 0.28)");
      ray.addColorStop(1, "rgba(255, 180, 80, 0)");
      g.strokeStyle = ray;
      g.lineWidth = i % 2 === 0 ? 3 : 1.4;
      g.beginPath();
      g.moveTo(64, 64);
      g.lineTo(64 + Math.cos(a) * 62, 64 + Math.sin(a) * 62);
      g.stroke();
    }
  }
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

function softCircle() {
  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 32;
  const g = canvas.getContext("2d");
  if (!g) throw new Error("2D canvas unavailable");
  const grd = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  grd.addColorStop(0, "rgba(255,255,255,1)");
  grd.addColorStop(0.45, "rgba(255,255,255,0.7)");
  grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 32, 32);
  return new CanvasTexture(canvas);
}

/** A young, flaring gas disk: bright and warm inside, bluish and thinning outward. */
const gasPainter: Painter = (u, v) => {
  const r = Math.hypot(u - 0.5, v - 0.5) * 2;
  if (r > 1) return [0, 0, 0, 0];
  const n = valueNoise2(u * 24, v * 24) * 0.35 + 0.65;
  const inner = Math.exp(-r * 7);
  const body = Math.exp(-r * 2.2) * (1 - inner);
  const rgb = mix3(mix3([120, 150, 190], [236, 214, 170], inner), [255, 240, 210], inner * 0.6);
  const alpha = clamp01((inner * 0.9 + body * 0.3) * n);
  return [rgb[0], rgb[1], rgb[2], Math.round(alpha * 255)];
};
const diskPainter: Painter = (u, v) => {
  const r = Math.hypot(u - 0.5, v - 0.5) * 2;
  const band = Math.exp(-((r - 0.72) * (r - 0.72)) / 0.02);
  return [158, 188, 204, Math.round(band * 150)];
};

/** A surface map as a texture; its pixel array stays with it, so a lost context re-uploads it. */
function mapTexture(id: BodyId, w: number, h: number): Texture {
  const north = surfaceMap(id, w, h);
  /* Rows are painted from the north pole down; GL's first row is v = 0, the south. */
  const data = new Uint8Array(north.length);
  const row = w * 4;
  for (let y = 0; y < h; y += 1)
    data.set(north.subarray(y * row, (y + 1) * row), (h - 1 - y) * row);
  const tex = new DataTexture(data, w, h);
  tex.colorSpace = SRGBColorSpace;
  tex.wrapS = RepeatWrapping;
  tex.magFilter = LinearFilter;
  tex.minFilter = LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 2;
  tex.needsUpdate = true;
  return tex;
}

/** A finished pixel array (rows in GL order) as a sharp, mipmapped surface texture. */
function detailTexture(job: SurfaceJob): Texture {
  const tex = new DataTexture(job.data, job.width, job.height);
  tex.colorSpace = SRGBColorSpace;
  tex.wrapS = RepeatWrapping;
  tex.magFilter = LinearFilter;
  tex.minFilter = LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

/** A ring system's radial strip: colour and normal opacity per 1/RING_TEXELS of its width. */
const RING_TEXELS = 1024;
function ringTexture(system: RingSystem) {
  const tex = new DataTexture(ringStrip(system, RING_TEXELS), RING_TEXELS, 1);
  tex.colorSpace = SRGBColorSpace;
  tex.magFilter = LinearFilter;
  tex.minFilter = LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

type Surface = {
  /** Haze tint at the limb and its strength (0 = airless). */
  atmos?: [string, number];
  /** Night-side floor, linear. */
  ambient?: number;
  /** Minnaert limb-darkening exponent. */
  minnaert: number;
  /** Ocean glint strength and tightness. */
  glint?: [number, number];
};

function lit(map: Texture, look: Surface, defines?: Record<string, string>) {
  return new ShaderMaterial({
    ...(defines ? { defines } : {}),
    uniforms: {
      map: { value: map },
      atmos: { value: new Color(look.atmos?.[0] ?? "#000000") },
      atmosStrength: { value: look.atmos?.[1] ?? 0 },
      ambient: { value: look.ambient ?? 0.035 },
      minnaert: { value: look.minnaert },
      specStrength: { value: look.glint?.[0] ?? 0 },
      specPower: { value: look.glint?.[1] ?? 1 },
    },
    vertexShader: VERT,
    fragmentShader: PLANET_FRAG,
  });
}

/**
 * Limb and haze per body. Minnaert k from disc-resolved photometry: airless
 * regolith ≈ 0.55–0.6 (Moon, Mercury, Pluto), Mars ≈ 0.8, cloud-topped
 * giants ≈ 0.9–1 (Jupiter and Saturn continuum), hazy ice giants ≈ 0.8.
 */
const SURFACES: Record<PlanetId | NamedId | MoonId, Surface> = {
  mercury: { minnaert: 0.58 },
  venus: { atmos: ["#f4ecd2", 0.35], minnaert: 0.75 },
  earth: { atmos: ["#7fb2ff", 0.7], minnaert: 0.9, glint: [0.3, 28] },
  mars: { atmos: ["#e8c4a4", 0.1], minnaert: 0.8 },
  jupiter: { atmos: ["#efe2c8", 0.08], minnaert: 0.95 },
  saturn: { atmos: ["#f0e4c8", 0.08], minnaert: 0.95 },
  uranus: { atmos: ["#d4f2f0", 0.2], minnaert: 0.8 },
  neptune: { atmos: ["#bcd8f0", 0.2], minnaert: 0.8 },
  pluto: { atmos: ["#a8c8f0", 0.05], minnaert: 0.6 },
  sedna: { minnaert: 0.6 },
  halley: { atmos: ["#d5e2ea", 0.1], minnaert: 0.6, ambient: 0.05 },
  moon: { minnaert: 0.55 },
  io: { minnaert: 0.6 },
  europa: { minnaert: 0.55 },
  ganymede: { minnaert: 0.55 },
  callisto: { minnaert: 0.55 },
  /* Titan's disc is all haze: nearly Lambertian, with a bright orange limb. */
  titan: { atmos: ["#e0a868", 0.45], minnaert: 0.85 },
  triton: { atmos: ["#c8d8f0", 0.04], minnaert: 0.6 },
  charon: { minnaert: 0.55 },
};

/** Map sizes: detailed giants and Earth, featureless bodies small. */
const MAP_SIZE: Record<BodyId, number> = {
  sun: 128,
  mercury: 256,
  venus: 128,
  earth: 384,
  mars: 256,
  jupiter: 384,
  saturn: 384,
  uranus: 128,
  neptune: 128,
  pluto: 256,
  sedna: 64,
  halley: 64,
  moon: 256,
  io: 128,
  europa: 128,
  ganymede: 128,
  callisto: 128,
  titan: 128,
  triton: 128,
  charon: 128,
};

/** A ring's material: shadow uniforms are written each frame by the scene. */
function ringMaterial(map: Texture, id: PlanetId, system: RingSystem) {
  const eq = FIGURES[id].equatorialKm;
  return new ShaderMaterial({
    uniforms: {
      map: { value: map },
      span: { value: new Vector2(system.innerKm / eq, system.outerKm / eq) },
      pole: { value: new Vector3(0, 1, 0) },
      radius: { value: 1 },
      squash: { value: FIGURES[id].equatorialKm / FIGURES[id].polarKm },
    },
    vertexShader: VERT,
    fragmentShader: RING_FRAG,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
  });
}

function shell(opacity: number) {
  return new ShaderMaterial({
    uniforms: { color: { value: new Color("#9ebccc") }, opacity: { value: opacity } },
    vertexShader: SHELL_VERT,
    fragmentShader: SHELL_FRAG,
    transparent: true,
    depthWrite: false,
    side: BackSide,
  });
}

export type Looks = ReturnType<typeof createLooks>;

/**
 * `light` halves the largest maps for coarse-pointer or low-memory devices.
 */
export function createLooks(light = false) {
  /* A body with a measured map (`MAPS`) paints only a stand-in until that loads. */
  const size = (id: BodyId) => (MAPS[id] || light ? Math.min(256, MAP_SIZE[id]) : MAP_SIZE[id]);
  const texture = (id: BodyId) => mapTexture(id, size(id), size(id) / 2);
  const maps = recordFrom(PLANET_IDS, (id) => texture(id));
  const ringMaps = partialFrom(
    keysOf(RINGS).flatMap((id) => {
      const system = RINGS[id];
      return system === undefined ? [] : ([[id, ringTexture(system)]] as const);
    }),
  );
  const planets = recordFrom(PLANET_IDS, (id) => {
    const system = RINGS[id];
    const shadow = id === "saturn" ? ringMaps[id] : undefined;
    const material = lit(maps[id], SURFACES[id], shadow ? { RING_SHADOW: "" } : undefined);
    if (shadow && system) {
      const eq = FIGURES[id].equatorialKm;
      Object.assign(material.uniforms, {
        ringMap: { value: shadow },
        ringPole: { value: new Vector3(0, 1, 0) },
        ringRadius: { value: 1 },
        ringSpan: { value: new Vector2(system.innerKm / eq, system.outerKm / eq) },
      });
    }
    return material;
  });
  const rings = partialFrom(
    keysOf(RINGS).flatMap((id) => {
      const system = RINGS[id];
      const map = ringMaps[id];
      return system === undefined || map === undefined
        ? []
        : ([[id, ringMaterial(map, id, system)]] as const);
    }),
  );
  const namedMaps: Record<NamedId, Texture> = {
    pluto: texture("pluto"),
    sedna: texture("sedna"),
    halley: texture("halley"),
  };
  const named: Record<NamedId, ShaderMaterial> = {
    pluto: lit(namedMaps.pluto, SURFACES.pluto),
    sedna: lit(namedMaps.sedna, SURFACES.sedna),
    halley: lit(namedMaps.halley, SURFACES.halley),
  };
  /* Moons are painted the first time their planet shows them. */
  const moonMaps: Partial<Record<MoonId, Texture>> = {};
  const moons: Partial<Record<MoonId, ShaderMaterial>> = {};
  const moon = (id: MoonId) => (moons[id] ??= lit((moonMaps[id] = texture(id)), SURFACES[id]));
  const sunMap = texture("sun");
  const sun = new ShaderMaterial({
    uniforms: { map: { value: sunMap } },
    vertexShader: VERT,
    fragmentShader: SUN_FRAG,
  });
  const diskMap = paint(128, 128, diskPainter);
  const gasMap = paint(256, 256, gasPainter);
  const disk = new MeshBasicMaterial({
    map: diskMap,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    toneMapped: false,
  });
  const corona = radialSprite(
    [
      [0, "rgba(255,236,200,0.0)"],
      [0.18, "rgba(255,210,140,0.55)"],
      [0.42, "rgba(224,140,48,0.16)"],
      [1, "rgba(224,120,40,0)"],
    ],
    10,
  );
  const glow = radialSprite([
    [0, "rgba(255,244,220,0.95)"],
    [0.2, "rgba(255,214,140,0.35)"],
    [0.5, "rgba(224,162,58,0.08)"],
    [1, "rgba(224,162,58,0)"],
  ]);
  const softStar = softCircle();
  const sprite = (map: Texture, color: string, opacity: number, additive: boolean) =>
    new SpriteMaterial({
      map,
      color,
      transparent: true,
      opacity,
      depthWrite: false,
      toneMapped: false,
      blending: additive ? AdditiveBlending : NormalBlending,
    });
  const points = (size: number, opacity: number, additive: boolean) =>
    new PointsMaterial({
      map: softStar,
      vertexColors: true,
      size,
      sizeAttenuation: false,
      transparent: true,
      opacity,
      depthWrite: false,
      toneMapped: false,
      blending: additive ? AdditiveBlending : NormalBlending,
    });
  const materials = {
    planets,
    rings,
    named,
    sun,
    disk,
    gasDisk: new ShaderMaterial({
      uniforms: { map: { value: gasMap }, opacity: { value: 0 } },
      vertexShader: VERT,
      fragmentShader: GAS_FRAG,
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
      toneMapped: false,
      blending: AdditiveBlending,
    }),
    cloud: new PointsMaterial({
      map: softStar,
      vertexColors: true,
      size: 12,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.07,
      depthWrite: false,
      toneMapped: false,
      blending: AdditiveBlending,
    }),
    shellInner: shell(0.42),
    shellOuter: shell(0.28),
    sunGlow: sprite(glow, "#ffffff", 1, false),
    sunCorona: sprite(corona, "#ffffff", 1, true),
    halleyComa: sprite(glow, "#d5e2ea", 0.28, true),
    galaxyCore: sprite(glow, "#e7c48a", 0.62, true),
    galaxyHeart: sprite(glow, "#fff6e4", 0.75, true),
    galaxySun: sprite(glow, "#ffe2a8", 0.9, true),
    galaxySunBody: new MeshBasicMaterial({ color: "#ffe2a8" }),
    galaxyToday: points(1.7, 0.9, true),
    galaxyEarly: points(1.55, 0.75, true),
    galaxyDust: points(2.6, 0.38, false),
    tracers: new ShaderMaterial({ vertexShader: ROCK_VERT, fragmentShader: ROCK_FRAG }),
    ghost: new MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
    grid: new LineBasicMaterial({ color: "#46536e", transparent: true, opacity: 0.5 }),
    focus: new MeshBasicMaterial({
      color: "#e2c07a",
      side: DoubleSide,
      depthTest: false,
      transparent: true,
      opacity: 0.95,
    }),
    proxima: new MeshBasicMaterial({ color: "#9ebccc", transparent: true, opacity: 0.28 }),
    halo: new MeshBasicMaterial({
      color: "#9ebccc",
      wireframe: true,
      transparent: true,
      opacity: 0.08,
    }),
  };
  const textures = [
    ...Object.values(maps),
    ...Object.values(ringMaps),
    ...Object.values(namedMaps),
    sunMap,
    diskMap,
    gasMap,
    corona,
    glow,
    softStar,
  ];
  /** Measured maps that replaced painted ones, freed with the engine. */
  const measured: Partial<Record<BodyId, Texture>> = {};
  const moonIds = MOONS.map((moon) => moon.id);
  const surfaceOf = (id: BodyId): ShaderMaterial | undefined => {
    if (id === "sun") return sun;
    if (includesId(PLANET_IDS, id)) return planets[id];
    if (id === "pluto" || id === "sedna" || id === "halley") return named[id];
    if (includesId(moonIds, id)) return moons[id];
    return undefined;
  };
  return {
    ...materials,
    moon,
    surfaceOf,
    /** Shows a measured map on the body from now on (or frees it if the body has no material). */
    setMeasured(id: BodyId, texture: Texture) {
      const material = surfaceOf(id);
      if (!material) {
        texture.dispose();
        return;
      }
      measured[id]?.dispose();
      measured[id] = texture;
      material.uniforms.map!.value = texture;
    },
    /** A close-up's detailed map, to paint a few rows per frame; null when the base map suffices. */
    detailJob: (id: BodyId) => {
      const w = closeUpMapWidth(id, light);
      return w > size(id) ? surfaceJob(id, w, w / 2) : null;
    },
    /** Its finished texture; disposed by the caller. */
    detailTexture,
    /** A nearby star's body; disposed by the caller. */
    neighbour: (color: string) => new MeshBasicMaterial({ color, toneMapped: false }),
    /** Its halo; disposed by the caller. */
    neighbourGlow: (color: string) => sprite(glow, color, 0.9, true),
    dispose() {
      for (const tex of textures) tex.dispose();
      for (const tex of Object.values(measured)) tex.dispose();
      for (const tex of Object.values(moonMaps)) tex.dispose();
      for (const mat of Object.values(moons)) mat.dispose();
      for (const mat of Object.values(materials)) {
        if (canDispose(mat)) mat.dispose();
        else if (isRecord(mat)) {
          for (const inner of Object.values(mat)) if (canDispose(inner)) inner.dispose();
        }
      }
    },
  };
}

function canDispose(value: unknown): value is { dispose(): void } {
  return (
    typeof value === "object" &&
    value !== null &&
    "dispose" in value &&
    typeof value.dispose === "function"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

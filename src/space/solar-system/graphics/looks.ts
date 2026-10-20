import {
  AdditiveBlending,
  BackSide,
  Color,
  CustomBlending,
  DataTexture,
  DoubleSide,
  LinearFilter,
  LinearMipmapLinearFilter,
  LineBasicMaterial,
  MeshBasicMaterial,
  OneMinusSrcAlphaFactor,
  RepeatWrapping,
  ShaderMaterial,
  SrcAlphaFactor,
  SRGBColorSpace,
  Vector2,
  Vector3,
  type Texture,
} from "three";

import {
  FIGURES,
  MAPS,
  MOON_IDS,
  PLANET_IDS,
  RINGS,
  ringStrip,
  type BodyId,
  type MoonId,
  type NamedId,
  type PlanetId,
  type RingSystem,
} from "@horizon/toolkit/bodies";
import { mix, surfaceJob, type SurfaceJob } from "@horizon/toolkit/bodies/surfaces";
import { clamp01, valueNoise2 } from "@horizon/toolkit/math";
import { includesId, keysOf, partialFrom, recordFrom } from "@horizon/toolkit/records";
import {
  SOLAR_GOLD,
  glowSprite,
  paintedTexture,
  radialSprite,
  spriteMaterial,
  type TexelPainter,
} from "@horizon/toolkit/scene";

import FOCUS_FRAG from "./shaders/focus.frag.glsl";
import FOCUS_VERT from "./shaders/focus.vert.glsl";
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

function paint(w: number, h: number, fn: TexelPainter) {
  const tex = paintedTexture(w, h, fn);
  tex.anisotropy = 2;
  return tex;
}

/** A young, flaring gas disk: bright and warm inside, bluish and thinning outward. */
const gasPainter: TexelPainter = (u, v) => {
  const r = Math.hypot(u - 0.5, v - 0.5) * 2;
  if (r > 1) return [0, 0, 0, 0];
  const n = valueNoise2(u * 24, v * 24) * 0.35 + 0.65;
  const inner = Math.exp(-r * 7);
  const body = Math.exp(-r * 2.2) * (1 - inner);
  const rgb = mix(mix([120, 150, 190], [236, 214, 170], inner), [255, 240, 210], inner * 0.6);
  const alpha = clamp01((inner * 0.9 + body * 0.3) * n);
  return [rgb[0], rgb[1], rgb[2], Math.round(alpha * 255)];
};
const diskPainter: TexelPainter = (u, v) => {
  const r = Math.hypot(u - 0.5, v - 0.5) * 2;
  const band = Math.exp(-((r - 0.72) * (r - 0.72)) / 0.02);
  return [158, 188, 204, Math.round(band * 150)];
};

/** A finished map (rows in GL order) as a mipmapped surface texture; the job's pixels stay with it, so a lost context re-uploads them. */
function dataTexture(job: SurfaceJob, anisotropy: number): Texture {
  const tex = new DataTexture(job.data, job.width, job.height);
  tex.colorSpace = SRGBColorSpace;
  tex.wrapS = RepeatWrapping;
  tex.magFilter = LinearFilter;
  tex.minFilter = LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = anisotropy;
  tex.needsUpdate = true;
  return tex;
}

/** A body's painted surface map as a texture. */
function mapTexture(id: BodyId, w: number, h: number): Texture {
  const job = surfaceJob(id, w, h);
  job.step(h);
  return dataTexture(job, 2);
}

/** A finished detailed map as a sharp surface texture. */
const detailTexture = (job: SurfaceJob): Texture => dataTexture(job, 4);

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
  venus: { atmos: ["#f4ecd2", 0.35], minnaert: 0.9 },
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
  venus: 256,
  earth: 384,
  mars: 256,
  jupiter: 384,
  saturn: 384,
  uranus: 128,
  neptune: 128,
  pluto: 256,
  sedna: 128,
  halley: 128,
  moon: 256,
  io: 128,
  europa: 128,
  ganymede: 128,
  callisto: 128,
  titan: 256,
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
  /** Retained even when a moon material has not been created yet. */
  const measured: Partial<Record<BodyId, Texture>> = {};
  /* Moon materials are created the first time their planet shows them. */
  const moonMaps: Partial<Record<MoonId, Texture>> = {};
  const moons: Partial<Record<MoonId, ShaderMaterial>> = {};
  const moonMap = (id: MoonId) => (moonMaps[id] ??= texture(id));
  const moon = (id: MoonId) => (moons[id] ??= lit(measured[id] ?? moonMap(id), SURFACES[id]));
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
    transparent: false,
    blending: CustomBlending,
    blendSrc: SrcAlphaFactor,
    blendDst: OneMinusSrcAlphaFactor,
    depthWrite: false,
    side: DoubleSide,
    toneMapped: false,
  });
  // A restrained, continuous halo keeps the resolved photosphere readable.
  // Keep this separate from the warm glow used by galaxies and comet dust.
  const sunHalo = radialSprite([
    [0, "rgba(255,250,240,0.12)"],
    [0.65, "rgba(255,250,240,0.12)"],
    [0.76, "rgba(255,250,240,0.06)"],
    [0.9, "rgba(255,250,240,0.015)"],
    [1, "rgba(255,250,240,0)"],
  ]);
  const glow = glowSprite();
  const sprite = spriteMaterial;
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
      transparent: false,
      depthWrite: false,
      side: DoubleSide,
      toneMapped: false,
      blending: AdditiveBlending,
    }),
    shellInner: shell(0.42),
    shellOuter: shell(0.28),
    sunGlow: sprite(sunHalo, "#ffffff", 1, true),
    halleyComa: sprite(glow, "#d5e2ea", 0.28, true),
    /* `radius` sizes every planetesimal (world units), so zooming never rewrites the instances. */
    tracers: new ShaderMaterial({
      uniforms: { radius: { value: 1 } },
      vertexShader: ROCK_VERT,
      fragmentShader: ROCK_FRAG,
    }),
    /* Touch targets: raycast, never drawn. */
    ghost: new MeshBasicMaterial({ visible: false }),
    grid: new LineBasicMaterial({
      color: "#46536e",
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    }),
    focus: new ShaderMaterial({
      uniforms: {
        color: { value: new Color(SOLAR_GOLD) },
        opacity: { value: 0.95 },
        size: { value: 1 },
        lock: { value: 1 },
        breath: { value: 0 },
      },
      vertexShader: FOCUS_VERT,
      fragmentShader: FOCUS_FRAG,
      depthTest: false,
      depthWrite: false,
      transparent: true,
      toneMapped: false,
    }),
  };
  const textures = [
    ...Object.values(maps),
    ...Object.values(ringMaps),
    ...Object.values(namedMaps),
    sunMap,
    diskMap,
    gasMap,
    sunHalo,
    glow,
  ];
  const paintedOf = (id: BodyId): Texture => {
    if (id === "sun") return sunMap;
    if (includesId(PLANET_IDS, id)) return maps[id];
    if (id === "pluto" || id === "sedna" || id === "halley") return namedMaps[id];
    return moonMap(id);
  };
  const surfaceOf = (id: BodyId): ShaderMaterial | undefined => {
    if (id === "sun") return sun;
    if (includesId(PLANET_IDS, id)) return planets[id];
    if (id === "pluto" || id === "sedna" || id === "halley") return named[id];
    if (includesId(MOON_IDS, id)) return moons[id];
    return undefined;
  };
  return {
    ...materials,
    moon,
    surfaceOf,
    /** Retains a measured map, including for moons that are not visible yet. */
    setMeasured(id: BodyId, texture: Texture) {
      const material = surfaceOf(id);
      measured[id]?.dispose();
      measured[id] = texture;
      if (material) material.uniforms.map!.value = texture;
    },
    /** Frees a measured map; the body goes back to its painted stand-in. */
    clearMeasured(id: BodyId) {
      const texture = measured[id];
      if (!texture) return;
      delete measured[id];
      const map = surfaceOf(id)?.uniforms.map;
      if (map?.value === texture) map.value = paintedOf(id);
      texture.dispose();
    },
    /** Width of a body's painted map, px. */
    mapWidth: size,
    /** A finished detailed map (a painted `SurfaceJob`) as a texture; disposed by the caller. */
    detailTexture,
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

import {
  AdditiveBlending,
  BackSide,
  Color,
  CustomBlending,
  DataTexture,
  DataUtils,
  DoubleSide,
  HalfFloatType,
  LinearFilter,
  LinearMipmapLinearFilter,
  LineBasicMaterial,
  MeshBasicMaterial,
  OneMinusSrcAlphaFactor,
  RedFormat,
  RepeatWrapping,
  RGBAFormat,
  ShaderMaterial,
  SrcAlphaFactor,
  SRGBColorSpace,
  Vector2,
  Vector3,
  Vector4,
  Texture,
} from "three";

import {
  FIGURES,
  MAPS,
  MOON_IDS,
  PLANET_IDS,
  RINGS,
  ringExposure,
  ringStripLevels,
  type BodyId,
  type MoonId,
  NAMED_IDS,
  type NamedId,
  type PlanetId,
  type RingStrip,
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
import { glslFloat } from "@horizon/toolkit/shaders/defines";

import { BINS } from "../model/tracers";
import { AIR, airUniforms, type Air } from "./air";
import AIR_FRAG from "./shaders/air.frag.glsl";
import AIR_VERT from "./shaders/air.vert.glsl";
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
 * small canvases. Bodies are lit by the Sun at the origin in linear light (`sunlight`, white
 * at today's strength unless a host writes the Sun's colour and strength), and a host may blend
 * in a later surface it models (`laterMap`, `later`): no photo plates, no post-processing.
 * Everything here is disposed with the engine.
 */
import VERT from "./shaders/surface.vert.glsl";
import { BIN_COLOR } from "./tracers";

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

/** Texels across a ring strip unless the host asks for more. */
const RING_TEXELS = 1024;

/**
 * A strip's mipmap chain as one half-float texture, `channels` values per texel from `pick`.
 * Half floats keep a faint ring's opacity (τ ≈ 10⁻⁴) that 8 bits round to nothing; the
 * levels come from the toolkit, weighted by opacity.
 */
function stripTexture(
  levels: readonly RingStrip[],
  channels: 1 | 4,
  pick: (strip: RingStrip, t: number, out: number[]) => void,
) {
  const texel: number[] = [];
  const mipmaps = levels.map((strip) => {
    const data = new Uint16Array(strip.texels * channels);
    for (let t = 0; t < strip.texels; t += 1) {
      pick(strip, t, texel);
      for (let c = 0; c < channels; c += 1)
        data[t * channels + c] = DataUtils.toHalfFloat(texel[c]!);
    }
    return { data, width: strip.texels, height: 1 };
  });
  const base = mipmaps[0]!;
  const format = channels === 4 ? RGBAFormat : RedFormat;
  const tex = new DataTexture(base.data, base.width, 1, format, HalfFloatType);
  tex.mipmaps = mipmaps;
  tex.magFilter = LinearFilter;
  tex.minFilter = LinearMipmapLinearFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

/**
 * A ring system's radial strips across `texels`: `map` the particles' linear colour and normal
 * opacity, `dust` the fraction of that opacity in micrometre dust.
 */
function ringTextures(system: RingSystem, texels: number) {
  const levels = ringStripLevels(system, texels);
  const colour = new Color();
  return {
    map: stripTexture(levels, 4, (strip, t, out) => {
      const [r, g, b] = strip.rgb.subarray(t * 3, t * 3 + 3);
      colour.setRGB(r! / 255, g! / 255, b! / 255, SRGBColorSpace);
      out[0] = colour.r;
      out[1] = colour.g;
      out[2] = colour.b;
      out[3] = strip.opacity[t]!;
    }),
    dust: stripTexture(levels, 1, (strip, t, out) => {
      out[0] = strip.dust[t]!;
    }),
  };
}
type RingTextures = ReturnType<typeof ringTextures>;

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

/** What a lit body shows: a map, times a tint (white, or a placeholder's colour on `WHITE`). */
type Face = { texture: Texture; tint: Color };

/** A single white texel: a placeholder's map, and the prior once nothing is fading. */
const WHITE = new DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
WHITE.needsUpdate = true;
const NO_TINT = new Color(1, 1, 1);
/** Seconds a newly arrived map takes to fade in over what showed before. */
const FADE_S = 0.6;
/** A frame's share of painting maps a slice at a time (`paint`): a quarter of a 60 fps frame, ms. */
const PAINT_BUDGET_MS = 1000 / 60 / 4;
/** Rows a slice paints before the budget is checked again. */
const PAINT_ROWS = 2;

/**
 * The Sun as the lit materials see it, shared by every one: where it is (world units; the
 * origin unless the host moves it), its radius (0 lights from a point), and how many bodies
 * each surface tests for an eclipse (0 compiles none).
 */
type SunLight = { sunPos: Vector3; sunRadius: { value: number }; occluders: number };

function lit(face: Face, look: Surface, sun: SunLight, defines?: Record<string, string>) {
  const occluders =
    sun.occluders > 0
      ? {
          defines: { OCCLUDERS: String(sun.occluders) },
          uniforms: {
            occluders: { value: Array.from({ length: sun.occluders }, () => new Vector4()) },
          },
        }
      : { defines: {}, uniforms: {} };
  return new ShaderMaterial({
    defines: { ...occluders.defines, ...defines },
    uniforms: {
      ...occluders.uniforms,
      sunPos: { value: sun.sunPos },
      sunRadius: sun.sunRadius,
      sunlight: { value: new Vector3(1, 1, 1) },
      skylight: { value: new Vector3(1, 1, 1) },
      map: { value: face.texture },
      mapTint: { value: face.tint.clone() },
      prior: { value: WHITE },
      priorTint: { value: NO_TINT.clone() },
      fade: { value: 1 },
      laterMap: { value: WHITE },
      later: { value: 0 },
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

/** The samples a shell marches until a quality says otherwise (the full tier's). */
const AIR_STEPS = 12;

/**
 * A body's atmosphere shell for its close-up (air.frag.glsl): single scattering through a
 * thin shell over the globe, premultiplied over the surface. `steps` is the march's sample
 * count, a compile-time loop bound; the camera and Sun uniforms are written each frame by the
 * close-up.
 */
function airMaterial(air: Air, steps: number) {
  const u = airUniforms(air);
  return new ShaderMaterial({
    defines: { AIR_STEPS: String(steps) },
    uniforms: {
      uCamera: { value: new Vector3() },
      uSun: { value: new Vector3(0, 0, 1) },
      uPlanet: { value: u.planet },
      uScale: { value: new Vector2(u.scale[0], u.scale[1]) },
      uRayleigh: { value: new Vector3(...u.rayleigh) },
      uMie: { value: new Vector3(...u.mie) },
      uMieG: { value: u.g },
      uDeep: { value: u.deep },
      uLight: { value: u.light },
      uSunlight: { value: new Vector3(1, 1, 1) },
    },
    vertexShader: AIR_VERT,
    fragmentShader: AIR_FRAG,
    transparent: true,
    premultipliedAlpha: true,
    depthWrite: false,
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
  ceres: { minnaert: 0.58 },
  pluto: { atmos: ["#a8c8f0", 0.05], minnaert: 0.6 },
  haumea: { minnaert: 0.6 },
  makemake: { minnaert: 0.6 },
  eris: { minnaert: 0.6 },
  sedna: { minnaert: 0.6 },
  halley: { atmos: ["#d5e2ea", 0.1], minnaert: 0.6, ambient: 0.05 },
  moon: { minnaert: 0.55 },
  phobos: { minnaert: 0.55 },
  deimos: { minnaert: 0.55 },
  io: { minnaert: 0.6 },
  europa: { minnaert: 0.55 },
  ganymede: { minnaert: 0.55 },
  callisto: { minnaert: 0.55 },
  mimas: { minnaert: 0.55 },
  enceladus: { minnaert: 0.55 },
  tethys: { minnaert: 0.55 },
  dione: { minnaert: 0.55 },
  rhea: { minnaert: 0.55 },
  /* Titan's disc is all haze: nearly Lambertian, with a bright orange limb. */
  titan: { atmos: ["#e0a868", 0.45], minnaert: 0.85 },
  iapetus: { minnaert: 0.55 },
  miranda: { minnaert: 0.55 },
  ariel: { minnaert: 0.55 },
  umbriel: { minnaert: 0.55 },
  titania: { minnaert: 0.55 },
  oberon: { minnaert: 0.55 },
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
  ceres: 128,
  pluto: 256,
  haumea: 128,
  makemake: 128,
  eris: 128,
  sedna: 128,
  halley: 128,
  moon: 256,
  phobos: 128,
  deimos: 128,
  io: 128,
  europa: 128,
  ganymede: 128,
  callisto: 128,
  mimas: 128,
  enceladus: 128,
  tethys: 128,
  dione: 128,
  rhea: 128,
  titan: 256,
  iapetus: 128,
  miranda: 128,
  ariel: 128,
  umbriel: 128,
  titania: 128,
  oberon: 128,
  triton: 128,
  charon: 128,
};

/**
 * A ring's material: shadow uniforms are written each frame by the scene. Premultiplied, so
 * light a faint dusty ring scatters forward can outshine its opacity.
 */
function ringMaterial(strips: RingTextures, id: PlanetId, system: RingSystem, sun: SunLight) {
  const eq = FIGURES[id].equatorialKm;
  return new ShaderMaterial({
    uniforms: {
      sunPos: { value: sun.sunPos },
      map: { value: strips.map },
      dust: { value: strips.dust },
      span: { value: new Vector2(system.innerKm / eq, system.outerKm / eq) },
      pole: { value: new Vector3(0, 1, 0) },
      radius: { value: 1 },
      squash: { value: FIGURES[id].equatorialKm / FIGURES[id].polarKm },
      formed: { value: 1 },
    },
    vertexShader: VERT,
    fragmentShader: RING_FRAG,
    transparent: true,
    premultipliedAlpha: true,
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

export type LooksOptions = {
  /** Bodies each lit surface tests for an eclipse; 0 (the default) compiles no test. */
  occluders?: number;
  /** Texels across a ring strip; 1024 by default, more for rings seen from close by. */
  ringTexels?: number;
  /**
   * Paint a body's map only once it is drawn (`paint`), a slice a frame, the body waiting in
   * its map's mean colour until then; for a host that opens away from the planets.
   */
  paintWhenSeen?: boolean;
};

/**
 * `light` halves the largest maps for coarse-pointer or low-memory devices. `streamed`: the
 * host streams measured maps in (`setMeasured`), so a body with one shows its map's mean
 * colour until then and is painted only if its map fails (`setFailed`); otherwise every body
 * starts on its painted map, at once or, with `paintWhenSeen`, once drawn. The Sun lights
 * every surface from `sunPos` (the origin until a host writes it) with `sunRadius` (0, a
 * point, until written).
 */
export function createLooks(light = false, streamed = false, options: LooksOptions = {}) {
  const sunPos = new Vector3();
  const sunRadius = { value: 0 };
  const sun: SunLight = { sunPos, sunRadius, occluders: options.occluders ?? 0 };
  const ringTexels = options.ringTexels ?? RING_TEXELS;
  const whenSeen = options.paintWhenSeen ?? false;
  /* A body with a measured map (`MAPS`) paints only a stand-in until that loads. */
  const size = (id: BodyId) => (MAPS[id] || light ? Math.min(256, MAP_SIZE[id]) : MAP_SIZE[id]);
  const texture = (id: BodyId) => mapTexture(id, size(id), size(id) / 2);
  /* Painted maps are made the first time a body needs one. */
  const painted: Partial<Record<BodyId, Texture>> = {};
  const paintedOf = (id: BodyId) => (painted[id] ??= texture(id));
  /* Bodies waiting to be painted once seen, and the maps under way. */
  const unpainted = new Set<BodyId>();
  const jobs: Partial<Record<BodyId, SurfaceJob>> = {};
  /** Retained even when a moon material has not been created yet. */
  const measured: Partial<Record<BodyId, Texture>> = {};
  const failed = new Set<BodyId>();
  const placeholders = new Map<BodyId, Color>();
  /**
   * What a body shows now: its measured map, its placeholder while that streams or while its
   * painting waits, or its painted map.
   */
  const faceOf = (id: BodyId): Face => {
    const map = measured[id];
    if (map) return { texture: map, tint: NO_TINT };
    /* The Sun's shader takes no tint: it keeps its painted map, already a plain disc. */
    const mean = id === "sun" ? undefined : MAPS[id]?.mean;
    const waits = streamed ? !failed.has(id) : whenSeen && !painted[id];
    if (waits && mean) {
      if (!streamed) unpainted.add(id);
      let tint = placeholders.get(id);
      if (!tint) {
        tint = new Color(mean);
        placeholders.set(id, tint);
      }
      return { texture: WHITE, tint };
    }
    return { texture: paintedOf(id), tint: NO_TINT };
  };
  const ringMaps = partialFrom(
    keysOf(RINGS).flatMap((id) => {
      const system = RINGS[id];
      return system === undefined ? [] : ([[id, ringTextures(system, ringTexels)]] as const);
    }),
  );
  const planets = recordFrom(PLANET_IDS, (id) => {
    const system = RINGS[id];
    const shadow = id === "saturn" ? ringMaps[id] : undefined;
    const material = lit(faceOf(id), SURFACES[id], sun, shadow ? { RING_SHADOW: "" } : undefined);
    if (shadow && system) {
      const eq = FIGURES[id].equatorialKm;
      Object.assign(material.uniforms, {
        ringMap: { value: shadow.map },
        ringPole: { value: new Vector3(0, 1, 0) },
        ringRadius: { value: 1 },
        ringSpan: { value: new Vector2(system.innerKm / eq, system.outerKm / eq) },
        ringFormed: { value: 1 },
      });
    }
    return material;
  });
  const rings = partialFrom(
    keysOf(RINGS).flatMap((id) => {
      const system = RINGS[id];
      const strips = ringMaps[id];
      return system === undefined || strips === undefined
        ? []
        : ([[id, ringMaterial(strips, id, system, sun)]] as const);
    }),
  );
  /* Faint ring systems' long exposures, compiled in only while shown. */
  const exposures = partialFrom(
    keysOf(rings).flatMap((id) => {
      const system = RINGS[id];
      const exposure = system === undefined ? 1 : ringExposure(system);
      return exposure > 1 ? ([[id, glslFloat(exposure)]] as const) : [];
    }),
  );
  let exposed = false;
  const named: Record<NamedId, ShaderMaterial> = recordFrom(NAMED_IDS, (id) =>
    lit(faceOf(id), SURFACES[id], sun),
  );
  /* Moon materials are created the first time their planet shows them. */
  const moons: Partial<Record<MoonId, ShaderMaterial>> = {};
  const moon = (id: MoonId) => (moons[id] ??= lit(faceOf(id), SURFACES[id], sun));
  /* Atmosphere shells are created the first time a close-up of their body opens. */
  let airSteps = AIR_STEPS;
  const airs: Partial<Record<BodyId, ShaderMaterial>> = {};
  const air = (id: BodyId) => {
    const look = AIR[id];
    if (!look) return undefined;
    return (airs[id] ??= airMaterial(look, airSteps));
  };
  const sunMap = paintedOf("sun");
  const sunSurface = new ShaderMaterial({
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
    sun: sunSurface,
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
    /* The planetesimal sample moves on the GPU (graphics/tracers.ts): a frame writes the moment,
       the switches and `radius`, which sizes every body (world units). */
    tracers: new ShaderMaterial({
      uniforms: {
        mig: { value: 1 },
        drift: { value: 0 },
        radius: { value: 1 },
        binColor: { value: BINS.map((bin) => BIN_COLOR[bin]) },
        binShown: { value: BINS.map(() => 1) },
      },
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
    ...Object.values(ringMaps).flatMap((strips) => [strips.map, strips.dust]),
    diskMap,
    gasMap,
    sunHalo,
    glow,
  ];
  const surfaceOf = (id: BodyId): ShaderMaterial | undefined => {
    if (id === "sun") return sunSurface;
    if (includesId(PLANET_IDS, id)) return planets[id];
    if (includesId(NAMED_IDS, id)) return named[id];
    if (includesId(MOON_IDS, id)) return moons[id];
    return undefined;
  };

  /* Fades: each material eases from what it showed (`prior`) to its new map. */
  const fading = new Set<ShaderMaterial>();
  /** Bodies whose surface a close-up has taken over; their own map waits until it gives it back. */
  const held = new Set<BodyId>();
  /** Detailed maps a close-up gave back that a fade still draws from: disposed as it ends. */
  const outgoing = new Set<Texture>();
  const drawnFrom = (texture: Texture) =>
    [...fading].some((material) => material.uniforms.prior!.value === texture);
  const finish = (material: ShaderMaterial) => {
    const prior: unknown = material.uniforms.prior!.value;
    material.uniforms.fade!.value = 1;
    material.uniforms.prior!.value = WHITE;
    fading.delete(material);
    if (prior instanceof Texture && outgoing.has(prior) && !drawnFrom(prior)) {
      outgoing.delete(prior);
      prior.dispose();
    }
  };
  /**
   * Puts `face` on a body, fading over what it showed unless `atOnce`; a change mid-fade
   * keeps fading from the same prior. The Sun has no fade.
   */
  const show = (id: BodyId, face: Face, atOnce = false) => {
    const material = surfaceOf(id);
    if (!material) return;
    const u = material.uniforms;
    if (!u.fade) {
      u.map!.value = face.texture;
      return;
    }
    if (u.map!.value === face.texture && u.mapTint!.value.equals(face.tint)) return;
    if (atOnce) finish(material);
    else if (!fading.has(material)) {
      u.prior!.value = u.map!.value;
      u.priorTint!.value.copy(u.mapTint!.value);
      u.fade.value = 0;
      fading.add(material);
    }
    u.map!.value = face.texture;
    u.mapTint!.value.copy(face.tint);
  };
  /** Disposes a map no body shows any more, ending any fade still drawing it. */
  const retire = (texture: Texture) => {
    for (const material of fading) if (material.uniforms.prior!.value === texture) finish(material);
    texture.dispose();
  };
  /** Shows a body's own face again, unless a close-up holds its surface. */
  const refresh = (id: BodyId, atOnce = false) => {
    if (!held.has(id)) show(id, faceOf(id), atOnce);
  };

  /* Each body's eclipse slots, found once: a host asks for them every frame. */
  const occluderSlots = new Map<BodyId, Vector4[] | null>();

  return {
    ...materials,
    moon,
    surfaceOf,
    /** Where the Sun lights every surface from, world units: write it when the Sun is not at the origin. */
    sunPos,
    /** The Sun's radius for the eclipses' penumbrae, world units; 0 lights from a point. */
    sunRadius,
    /** A body's eclipse slots (centre xyz, radius w; w = 0 empty), to write each frame; none when `occluders` is 0 or the body has no surface. */
    occludersOf(id: BodyId): Vector4[] | undefined {
      let slots = occluderSlots.get(id);
      if (slots === undefined) {
        const value: unknown = surfaceOf(id)?.uniforms.occluders?.value;
        slots =
          Array.isArray(value) && value.every((v): v is Vector4 => v instanceof Vector4)
            ? value
            : null;
        occluderSlots.set(id, slots);
      }
      return slots ?? undefined;
    },
    /** Retains a measured map, including for moons that are not visible yet, and fades it in. */
    setMeasured(id: BodyId, texture: Texture) {
      const old = measured[id];
      measured[id] = texture;
      refresh(id);
      if (old) retire(old);
    },
    /** Frees a measured map; the body goes back to its placeholder or painted map. */
    clearMeasured(id: BodyId) {
      const texture = measured[id];
      if (!texture) return;
      delete measured[id];
      refresh(id, true);
      retire(texture);
    },
    /** A streamed map could not load: the body fades to its painted map instead. */
    setFailed(id: BodyId) {
      failed.add(id);
      refresh(id);
    },
    /** A close-up takes the body's surface and fades `texture` in over it (its detailed map). */
    hold(id: BodyId, texture: Texture) {
      held.add(id);
      show(id, { texture, tint: NO_TINT });
    },
    /**
     * The close-up gives the surface back: the body's own face fades in over its detailed map
     * (`detail`, disposed once the fade no longer draws it).
     */
    release(id: BodyId, detail: Texture | null) {
      held.delete(id);
      show(id, faceOf(id));
      if (!detail) return;
      if (drawnFrom(detail)) outgoing.add(detail);
      else detail.dispose();
    },
    /**
     * With `paintWhenSeen`: paints the maps of waiting bodies drawn this frame (`seen`, the level
     * of detail's need) for up to `budget` ms, a few rows at a time, and fades each in once done.
     * True while one drawn still waits.
     */
    paint(seen: ReadonlyMap<BodyId, number>, budget = PAINT_BUDGET_MS) {
      if (unpainted.size === 0) return false;
      const begin = performance.now();
      for (const id of unpainted) {
        if (!seen.has(id)) continue;
        const job = (jobs[id] ??= surfaceJob(id, size(id), size(id) / 2));
        while (!job.step(PAINT_ROWS)) if (performance.now() - begin >= budget) return true;
        painted[id] = dataTexture(job, 2);
        delete jobs[id];
        unpainted.delete(id);
        refresh(id);
      }
      return false;
    },
    /** Advances the fades; true while one is still running. */
    step(dt: number) {
      for (const material of fading) {
        const u = material.uniforms;
        u.fade!.value = Math.min(1, u.fade!.value + dt / FADE_S);
        if (u.fade!.value >= 1) finish(material);
      }
      return fading.size > 0;
    },
    /** The scattering shell over a body with air, for its close-up; none for the rest. */
    air,
    /** Shows faint ring systems in a long exposure, each as bright as Saturn's, or as the eye sees them. */
    exposeRings(on: boolean) {
      if (on === exposed) return;
      exposed = on;
      for (const id of keysOf(exposures)) {
        const material = rings[id];
        if (!material) continue;
        if (on) material.defines.RING_EXPOSURE = exposures[id]!;
        else delete material.defines.RING_EXPOSURE;
        material.needsUpdate = true;
      }
    },
    /** Gives every shell the quality's march: `steps` samples along each view ray. */
    setAirSteps(steps: number) {
      if (steps === airSteps) return;
      airSteps = steps;
      for (const material of Object.values(airs)) {
        material.defines.AIR_STEPS = String(steps);
        material.needsUpdate = true;
      }
    },
    /** Width of a body's painted map, px. */
    mapWidth: size,
    /** A finished detailed map (a painted `SurfaceJob`) as a texture; disposed by the caller. */
    detailTexture,
    dispose() {
      for (const tex of textures) tex.dispose();
      for (const tex of Object.values(painted)) tex.dispose();
      for (const tex of Object.values(measured)) tex.dispose();
      for (const tex of outgoing) tex.dispose();
      for (const mat of Object.values(moons)) mat.dispose();
      for (const mat of Object.values(airs)) mat.dispose();
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

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
  BufferGeometry,
  CanvasTexture,
  Color,
  Group,
  LinearFilter,
  Mesh,
  Points,
  RepeatWrapping,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
  type Texture,
} from "three";

import { lcg, onSphere } from "@horizon/toolkit/math";
import {
  FAINTEST_OPACITY,
  GALACTIC_CENTRE,
  GALACTIC_EAST,
  GALACTIC_POLE,
  pointsGeometry,
} from "@horizon/toolkit/scene";
import { workerTask } from "@horizon/toolkit/worker";

import { FAR_SKY_PC } from "../bright-stars";
import {
  BAND_HEIGHT,
  BAND_WIDTH,
  paintSky,
  type BandMap,
  type GalacticAxes,
  type PaintedSky,
  type SkyEras,
  type SkyRequest,
} from "./band";
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

/** A map's texture: blank until its sky arrives, then painted (`paintTexture`). */
function bandTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = BAND_WIDTH;
  canvas.height = BAND_HEIGHT;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("2D canvas unavailable");
  const texture = new CanvasTexture(canvas);
  texture.wrapS = RepeatWrapping;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  return { texture, context };
}

/** Writes a painted map into its texture, for the next upload. */
function paintTexture({ texture, context }: ReturnType<typeof bandTexture>, map: BandMap) {
  context.putImageData(new ImageData(map.rgba, BAND_WIDTH, BAND_HEIGHT), 0, 0);
  texture.needsUpdate = true;
}

const axis = (v: Vector3) => [v.x, v.y, v.z] as const;
const AXES: GalacticAxes = {
  centre: axis(GALACTIC_CENTRE),
  east: axis(GALACTIC_EAST),
  pole: axis(GALACTIC_POLE),
};

/** Skies are painted on a worker (`band.worker.ts`); without one, in place. */
const painter = workerTask<SkyRequest, PaintedSky>(
  () => new Worker(new URL("./band.worker.ts", import.meta.url), { type: "module" }),
  paintSky,
);

/**
 * The last sky painted for each set of eras: a remount at the same quality draws it at once,
 * and another quality keeps its maps and samples only the grains afresh.
 */
const painted = new Map<SkyEras, { grains: number; sky: PaintedSky }>();

/** Hands `done` the sky of `eras` with `grains` grains, kept or newly painted; returns a cancel. */
function paint(eras: SkyEras, grains: number, done: (sky: PaintedSky) => void) {
  const kept = painted.get(eras);
  if (kept?.grains === grains) {
    done(kept.sky);
    return () => {};
  }
  const request: SkyRequest = { eras, grains, axes: AXES };
  if (kept) request.maps = kept.sky.maps;
  return painter.run(request, (sky) => {
    painted.set(eras, { grains, sky });
    done(sky);
  });
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
  /** The lookup's lowest and highest temperature, kelvin, and its width in texels. */
  lutSpec: readonly [number, number, number];
  /** The most beaming may brighten the glow, approached softly. */
  peak: number;
};

export type MilkyWayOptions = {
  /**
   * The grains' material: a point shader with `fade` and `tint` uniforms (the host's star
   * material, so the grains draw as its stars do). One is made per era.
   */
  grain: () => ShaderMaterial;
  /** The eras drawn: today's disk alone, or both for a host that blends toward the early one. */
  eras?: SkyEras;
  /** The grains carry the attributes of a sky flown through (see `fieldStars`). */
  parallax?: boolean;
  /** The band shifts with the ship's motion: aberration, Doppler colour and brightness. */
  motion?: BandMotion;
  /** Asks the host for a frame: the sky is painted off the main thread and arrives later. */
  wake: () => void;
};

/**
 * The Milky Way: a faint unresolved glow plus thousands of grains sampled from
 * the same map, for today's thin disk and for the early thick disk. Everything
 * sits in one group that turns about the galactic pole with the Sun's orbit. The
 * maps and grains are painted off the main thread; the band shows once they arrive
 * (at once when they are kept from an earlier mount, or painted in place).
 */
export function createMilkyWay(grains: number, options: MilkyWayOptions) {
  const parallax = options.parallax ?? false;
  const eras = options.eras ?? "both";
  const both = eras === "both";
  const today = bandTexture();
  const early = both ? bandTexture() : today;
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
            bbLutSpec: { value: new Vector3(...motion.lutSpec) },
            peak: { value: motion.peak },
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
  const todayMaterial = options.grain();
  const earlyMaterial = both ? options.grain() : null;
  /* Today's grains and haze (`paintSky`), then the early disk's: empty until the sky arrives. */
  const clouds = (
    both
      ? [todayMaterial, todayMaterial, earlyMaterial!, earlyMaterial!]
      : [todayMaterial, todayMaterial]
  ).map((cloudMaterial) => new Points(new BufferGeometry(), cloudMaterial));
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
  /* What `set` shows, drawn once the sky has arrived. */
  let arrived = false;
  let bandOn = true;
  let todayOn = true;
  let earlyOn = true;
  const show = () => {
    band.visible = arrived && bandOn;
    clouds.forEach((cloud, i) => (cloud.visible = arrived && (i < 2 ? todayOn : earlyOn)));
  };
  const receive = (sky: PaintedSky) => {
    if (!arrived) {
      paintTexture(today, sky.maps[0]!);
      if (both) paintTexture(early, sky.maps[1]!);
      arrived = true;
    }
    sky.clouds.forEach(({ position, color, size }, i) => {
      const cloud = clouds[i]!;
      cloud.geometry.dispose();
      const next = pointsGeometry(position, color, size);
      cloud.geometry = parallax ? paintedAttributes(next, color, size.length) : next;
    });
    show();
    options.wake();
  };
  let cancel = paint(eras, grains, receive);
  show();
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
      /* Each era's grains fade by its share of `dim`; the band by `dim` itself. Under the
         faintest opacity (`fadeMaterial`'s rule) a fade draws nothing, so nothing is drawn. */
      const todayFade = era * dim;
      const earlyFade = (1 - era) * dim;
      todayMaterial.uniforms.fade!.value = todayFade;
      setTint(todayMaterial.uniforms);
      bandOn = dim > FAINTEST_OPACITY;
      todayOn = todayFade > FAINTEST_OPACITY;
      earlyOn = earlyFade > FAINTEST_OPACITY;
      show();
      if (!earlyMaterial) return;
      earlyMaterial.uniforms.fade!.value = earlyFade;
      setTint(earlyMaterial.uniforms);
    },
    tint,
    /** Samples `n` resolved grains (and their share of haze) afresh, for a new quality. */
    setGrains(n: number) {
      cancel();
      cancel = paint(eras, n, receive);
    },
    dispose() {
      cancel();
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

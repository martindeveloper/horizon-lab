/**
 * The sense of speed: dust streaming past whenever the ship moves, each mote a ribbon facing
 * the camera (speed.vert.glsl: four vertices a mote, one draw a lattice).
 *
 * - The motes sit in a lattice wrapped round the ship in the near body's frame, so they show
 *   its motion as seen: speed through that frame times the time warp. Two lattices a decade
 *   apart, blended, keep the flow readable from a walk to many times light speed.
 * - Length and brightness follow the true speed; the regime (model/regime.ts) stretches and
 *   cools the streaks in cruise, and at warp the motes are stars in blackbody colours.
 * - The dust gives no light of its own. At true relativistic speed the sky's diffuse light
 *   crowds ahead and shifts blue (aberration and Doppler): a glow on the apex, growing with β².
 *
 * At rest, in orbit or switched off it is all hidden and costs nothing.
 */
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  Mesh,
  PlaneGeometry,
  ShaderMaterial,
  Vector2,
  Vector3,
  type DataTexture,
  type Object3D,
} from "three";

import { clamp, lerp } from "@horizon/toolkit/math";
import { vec3d, type Vec3d } from "@horizon/toolkit/scene";

import { LUT_RANGE_K, type MotionUniforms } from "../graphics/looks";
import APEX_FRAG from "../graphics/shaders/apex.frag.glsl";
import APEX_VERT from "../graphics/shaders/apex.vert.glsl";
import SPEED_FRAG from "../graphics/shaders/speed.frag.glsl";
import SPEED_VERT from "../graphics/shaders/speed.vert.glsl";
import { C_KM_S } from "../model/parameters";
import { regimeBlend, regimeOf, type Regime } from "../model/regime";
import type { ShipMotion } from "../model/ship";
import type { VoyageKit } from "./kit";

/** The most motes any quality draws. */
const MOST = 720;
/** A ribbon's width at the head, CSS px, for a mote a cell away; and the longest streak, as a share of the view's height. */
const WIDTH_PX = 1.5;
const LONGEST_SHARE = 0.18;
/** Cells a mote crosses per real second in the finer lattice, at its slowest. */
const FLOW = 1.2;
/** Real seconds a streak spans, before the speed's own stretch. */
const EXPOSURE = 0.11;
/** The longest streak, cells, in normal space; cruise and warp draw them longer. */
const LONGEST = 0.35;
const CRUISE_LONGEST = 0.6;
const WARP_LONGEST = 0.9;
/** The motes' colour by regime: gold-white dust, cooler in cruise; at warp they are stars. */
const DUST = new Color(1, 0.92, 0.78);
const CRUISE_DUST = new Color(0.92, 0.94, 1);
/**
 * The apex glow: where it sits, km, and its angular radius. The apex is at infinity: it sits
 * beyond every body (inside the sky's sphere), so a world in front hides it.
 */
const APEX_KM = 5e9;
const APEX_RADIUS = Math.tan((6 * Math.PI) / 180);
/** Its blue-shifted tint, and its intensity at light speed (a display's cap on the D⁴ boost). */
const APEX_TINT = new Color(0.78, 0.87, 1);
const APEX_PEAK = 0.55;
/** Apparent speeds, km per real second, over which the dust fades in. */
const FADE_IN = [0.05, 1] as const;
/** True speeds, km/s, from the faintest, shortest streak to the brightest, longest: half c. */
const SLOWEST_LOG = -1;
const FASTEST_LOG = Math.log10(C_KM_S / 2);

/** A ribbon a mote: four corners (head and tail, either side), two triangles. */
function dustGeometry() {
  const seeds = new Float32Array(MOST * 12);
  const corners = new Float32Array(MOST * 8);
  const index = new Uint16Array(MOST * 6);
  let s = 0x9e3779b9;
  /* A fixed sequence, so the dust is the same each visit. */
  const random = () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
  for (let i = 0; i < MOST; i += 1) {
    const x = random();
    const y = random();
    const z = random();
    for (let c = 0; c < 4; c += 1) seeds.set([x, y, z], i * 12 + c * 3);
    corners.set([0, -1, 0, 1, 1, -1, 1, 1], i * 8);
    const v = i * 4;
    index.set([v, v + 2, v + 1, v + 1, v + 2, v + 3], i * 6);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(seeds, 3));
  geometry.setAttribute("corner", new BufferAttribute(corners, 2));
  geometry.setIndex(new BufferAttribute(index, 1));
  return geometry;
}

export function createSpeedLayer(
  { scope, viewport, camera }: VoyageKit,
  parent: Object3D,
  lut: DataTexture,
  motionUniforms: MotionUniforms,
  count: number,
) {
  const geometry = scope.own(dustGeometry());
  const size = { value: new Vector2(viewport.width, viewport.height) };
  const longestPx = { value: LONGEST_SHARE * viewport.height };
  const dust = { value: new Color(DUST) };
  const stars = { value: 0 };
  let regime: Regime = "normal";
  /* The apex glow: one quad facing the camera, dead ahead. */
  const apexUniforms = {
    intensity: { value: 0 },
    tint: { value: APEX_TINT },
  };
  const apex = new Mesh(
    scope.own(new PlaneGeometry(1, 1)),
    scope.own(
      new ShaderMaterial({
        uniforms: apexUniforms,
        vertexShader: APEX_VERT,
        fragmentShader: APEX_FRAG,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        toneMapped: false,
      }),
    ),
  );
  apex.frustumCulled = false;
  apex.visible = false;
  apex.renderOrder = 10;
  apex.scale.setScalar(2 * APEX_KM * APEX_RADIUS);
  parent.add(apex);
  const lattice = () => {
    const uniforms = {
      cell: { value: 1 },
      offset: { value: new Vector3() },
      streak: { value: new Vector3() },
      alpha: { value: 0 },
      dust,
      stars,
      bbLut: { value: lut },
      lutRange: { value: new Vector2(LUT_RANGE_K[0], LUT_RANGE_K[1]) },
      viewport: size,
      widthPx: { value: WIDTH_PX },
      longestPx,
      forward: { value: motionUniforms.forward },
      beta: motionUniforms.beta,
      gamma: motionUniforms.gamma,
    };
    const material = scope.own(
      new ShaderMaterial({
        uniforms,
        vertexShader: SPEED_VERT,
        fragmentShader: SPEED_FRAG,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        toneMapped: false,
      }),
    );
    const lines = new Mesh(geometry, material);
    lines.frustumCulled = false;
    lines.visible = false;
    parent.add(lines);
    return { lines, uniforms };
  };
  const fine = lattice();
  const coarse = lattice();
  geometry.setDrawRange(0, count * 6);
  /** How far the ship has moved through the near body's frame, km, wrapped well past the coarse cell. */
  const drift = vec3d();
  const way = new Vector3();

  const place = (
    { lines, uniforms }: typeof fine,
    cell: number,
    weight: number,
    length: number,
    longest: number,
  ) => {
    lines.visible = weight > 0.004;
    if (!lines.visible) return;
    uniforms.cell.value = cell;
    uniforms.offset.value.set(
      ((drift[0] / cell) % 1) + 1,
      ((drift[1] / cell) % 1) + 1,
      ((drift[2] / cell) % 1) + 1,
    );
    uniforms.streak.value.copy(way).multiplyScalar(Math.min(longest, length / cell));
    uniforms.alpha.value = weight;
  };

  return {
    /** The regime the dust last drew: by the seen speed, normal at rest. */
    get regime() {
      return regime;
    },
    /** Motes drawn at a quality. */
    setCount(next: number) {
      geometry.setDrawRange(0, Math.min(MOST, next) * 6);
    },
    /**
     * One frame: `on` when the ship is moving under power or the autopilot and the switch is
     * on; `velocity` the ship's through the near body's frame, km/s; `warp` ship seconds per
     * real second.
     */
    update(dt: number, on: boolean, velocity: Readonly<Vec3d>, warp: number, motion: ShipMotion) {
      const speed = Math.hypot(velocity[0], velocity[1], velocity[2]);
      const seen = speed * Math.max(0, warp);
      const presence = on
        ? clamp(Math.log10(seen / FADE_IN[0]) / Math.log10(FADE_IN[1] / FADE_IN[0]), 0, 1)
        : 0;
      regime = on ? regimeOf(seen) : "normal";
      /* The sky's light ahead, by the true speed: the time warp's flow has none. */
      const ahead = APEX_PEAK * motion.beta * motion.beta;
      apex.visible = ahead >= 0.01;
      if (apex.visible) {
        apexUniforms.intensity.value = ahead;
        apex.position.fromArray(motion.forward).multiplyScalar(APEX_KM);
        apex.quaternion.copy(camera.quaternion);
      }
      if (presence <= 0) {
        fine.lines.visible = coarse.lines.visible = false;
        return;
      }
      const blend = regimeBlend(seen);
      /* The regime's light: longer, cooler streaks in cruise; stars at warp. */
      const longest = lerp(lerp(LONGEST, CRUISE_LONGEST, blend.cruise), WARP_LONGEST, blend.warp);
      dust.value.copy(DUST).lerp(CRUISE_DUST, blend.cruise);
      stars.value = blend.warp;
      size.value.set(viewport.width, viewport.height);
      longestPx.value = LONGEST_SHARE * viewport.height;
      for (let i = 0; i < 3; i += 1) drift[i] = drift[i]! + velocity[i]! * warp * dt;
      way.set(velocity[0] / speed, velocity[1] / speed, velocity[2] / speed);
      /* The lattices a decade apart about the spacing the dust crosses at FLOW a second. */
      const decade = Math.log10(seen / FLOW);
      const low = Math.floor(decade);
      const mix = decade - low;
      const cell = 10 ** low;
      const wrap = cell * 1e4;
      for (let i = 0; i < 3; i += 1) drift[i] = drift[i]! % wrap;
      /* Truly faster always reads longer and brighter. */
      const level = clamp((Math.log10(speed) - SLOWEST_LOG) / (FASTEST_LOG - SLOWEST_LOG), 0, 1);
      const stretch = lerp(0.3, 1.8, level) * (1 + 0.6 * blend.cruise + 0.8 * blend.warp);
      const glow = lerp(0.35, 0.8, level) * presence * (1 + 0.25 * blend.warp);
      const length = seen * EXPOSURE * stretch;
      place(fine, cell, (1 - mix) * glow, length, longest);
      place(coarse, cell * 10, mix * glow, length, longest);
    },
  };
}

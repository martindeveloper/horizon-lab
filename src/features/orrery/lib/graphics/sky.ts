/**
 * The sky behind the solar system: a celestial sphere in the scene's ecliptic
 * frame, carried with the camera. Bright stars come from the shared J2000
 * catalogue; the Milky Way band is the shared painted map (`@/space/sky`),
 * whose centre direction slides along the band as the Sun orbits the Galaxy,
 * and whose shape changes from the thick-disk era to today's thin disk.
 */
import { AdditiveBlending, Color, PointsMaterial } from "three";

import { THIN_DISK_ERA } from "@/space/galaxy/model/parameters";
import { createMilkyWay as createSharedMilkyWay } from "@/space/sky/milky-way";
import { starMaterial } from "@/space/sky/stars";
import { galacticAngle } from "@/space/solar-system/model/equations";
import {
  FORMATION_BEGINS,
  PROTOSTAR_LIT,
  protostarPhase,
} from "@/space/solar-system/model/formation";
import { SUN_BIRTH } from "@/space/solar-system/model/parameters";
import { clamp01, gaussian, lcg } from "@horizon/toolkit/math";
import { pointsGeometry, softCircle } from "@horizon/toolkit/scene";

import { NAMED_STARS_FADE } from "../model/parameters";
export { fieldStars, starSize } from "@/space/sky/milky-way";
export { starMaterial } from "@/space/sky/stars";

/** The Sun's galactic orbital phase for a moment, radians; frozen before the Sun existed. */
export function galacticPhase(yearsAgo: number) {
  return galacticAngle.compute({ t: Math.min(yearsAgo, SUN_BIRTH) });
}

/** The shared Milky Way, its grains drawn with the Orrery's star points; `wake` asks for a frame. */
export function createMilkyWay(dpr: { value: number }, grains: number, wake: () => void) {
  return createSharedMilkyWay(grains, { grain: () => starMaterial(dpr), wake });
}

/** The natal cloud gathers over this long before the formation plays, years. */
const CLOUD_GATHERS = 4e6;
/** The dust left about the newborn star thins away over this long after it lights, years (art direction). */
const ENVELOPE_CLEARS = 2e6;

/**
 * How much of the natal cloud is about the viewer: gathering over the last few million years
 * before the formation plays, whole through the core's fall, thinning away as the protostar grows.
 */
export function natalCloud(yearsAgo: number) {
  return (
    clamp01(1 - (yearsAgo - FORMATION_BEGINS) / CLOUD_GATHERS) * (1 - protostarPhase(yearsAgo))
  );
}

/**
 * What the sky looks like at a moment. `era` blends thick-disk (0) to today's
 * thin disk with dust (1): the thin disk builds up between about 9 and 7
 * billion years ago. `real` is how much of the catalogue sky still holds: the
 * bright stars' proper motions scramble constellations within ~10⁵ years.
 * `dim`/`cloud` are extinction inside the natal cloud and the dust left about the young Sun.
 */
export function skyEpoch(yearsAgo: number) {
  /* The thin disk fades in over ±1 Gyr about its era; named stars over ±0.4 dex about theirs. */
  const era = clamp01((THIN_DISK_ERA + 1e9 - yearsAgo) / 2e9);
  const real =
    1 - clamp01((Math.log10(Math.max(1, yearsAgo)) - Math.log10(NAMED_STARS_FADE) + 0.5) / 0.8);
  /* The view dims with the cloud drawn about it, and the dust left once the protostar lights
     clears more slowly than the drawn cloud thins. */
  const envelope =
    yearsAgo <= PROTOSTAR_LIT ? clamp01(1 - (PROTOSTAR_LIT - yearsAgo) / ENVELOPE_CLEARS) : 0;
  const cloud = Math.max(natalCloud(yearsAgo), envelope);
  const dim = 1 - 0.68 * cloud;
  return { era, real, dim, cloud };
}

/**
 * A presolar molecular cloud: a few clumpy filaments of cold gas, seeded, drawn
 * at the camera's scale so the view is never empty before the Sun exists.
 */
export function molecularCloud(count: number) {
  const rnd = lcg(71);
  const gauss = () => gaussian(rnd);
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
  return pointsGeometry(pos, col);
}

/**
 * The cloud's dense core: a clumpy ball of cold gas, denser and warmer toward its centre,
 * seeded, drawn before the viewer at the camera's scale; it is the part that falls in.
 */
export function prestellarCore(count: number) {
  const rnd = lcg(113);
  const gauss = () => gaussian(rnd);
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const cold = new Color("#4f78c8");
  const warm = new Color("#c9a978");
  const tint = new Color();
  const clumps = 7;
  for (let i = 0; i < count; i += 1) {
    /* Most grains in a soft ball, the rest in a few clumps about it. */
    const clump = rnd() < 0.3 ? Math.floor(rnd() * clumps) : -1;
    const spread = clump < 0 ? 0.36 : 0.1;
    const angle = (clump / clumps) * Math.PI * 2;
    const away = clump < 0 ? 0 : 0.55;
    const x = away * Math.cos(angle) + gauss() * spread;
    const z = away * Math.sin(angle) + gauss() * spread;
    const y = gauss() * spread * 0.7;
    pos[i * 3] = x;
    pos[i * 3 + 1] = y;
    pos[i * 3 + 2] = z;
    const r = Math.hypot(x, y, z);
    tint.copy(cold).lerp(warm, Math.exp(-r * 4));
    const fade = (0.3 + 0.7 * Math.exp(-r * 2)) * (0.4 + rnd() * 0.6);
    col[i * 3] = tint.r * fade;
    col[i * 3 + 1] = tint.g * fade;
    col[i * 3 + 2] = tint.b * fade;
  }
  return pointsGeometry(pos, col);
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

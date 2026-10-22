/**
 * The sky behind the solar system: a celestial sphere in the scene's ecliptic
 * frame, carried with the camera. Bright stars come from the shared J2000
 * catalogue; the Milky Way band is the shared painted map (`@/space/sky`),
 * whose centre direction slides along the band as the Sun orbits the Galaxy,
 * and whose shape changes from the thick-disk era to today's thin disk.
 */
import { AdditiveBlending, Color, PointsMaterial, ShaderMaterial } from "three";

import { THIN_DISK_ERA } from "@/space/galaxy/model/parameters";
import { createMilkyWay as createSharedMilkyWay } from "@/space/sky/milky-way";
import { galacticAngle } from "@/space/solar-system/model/equations";
import { SUN_BIRTH } from "@/space/solar-system/model/parameters";
import { clamp01, gaussian, lcg } from "@horizon/toolkit/math";
import { pointsGeometry, softCircle } from "@horizon/toolkit/scene";

import { NAMED_STARS_FADE } from "../model/parameters";
import STAR_FRAG from "./shaders/star.frag.glsl";
import STAR_VERT from "./shaders/star.vert.glsl";

export { fieldStars, starSize } from "@/space/sky/milky-way";

/** The Sun's galactic orbital phase for a moment, radians; frozen before the Sun existed. */
export function galacticPhase(yearsAgo: number) {
  return galacticAngle.compute({ t: Math.min(yearsAgo, SUN_BIRTH) });
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

/** The shared Milky Way, its grains drawn with the Orrery's star points. */
export function createMilkyWay(dpr: { value: number }, grains: number) {
  return createSharedMilkyWay(grains, { grain: () => starMaterial(dpr) });
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

/**
 * The sky about the ship, drawn behind everything: the bright stars at their real distances
 * (the sky shifts as the ship covers light-years), the Sun as one star among them once the
 * ship is far enough to see it so, and the Milky Way as the painted band the Orrery draws,
 * with its grains and a faint field, carried with the ship and faded out as the Galaxy map
 * takes over light-years out. At speed the whole sky crowds ahead and shifts colour
 * (star.vert.glsl, band.frag.glsl): the ship's velocity reaches the shaders as β, γ and the
 * direction of travel.
 */
import { BufferAttribute, Points, Vector3, type DataTexture, type Object3D } from "three";

import { brightStarGeometry } from "@/space/bright-stars";
import { LY } from "@/space/galaxy/scene/frames";
import { createMilkyWay, fieldStars, starSize, type SkyCounts } from "@/space/sky/milky-way";
import { pointsGeometry, rising, type Vec3d } from "@horizon/toolkit/scene";
import { PARSEC_KM } from "@horizon/toolkit/science";

import { LUT_RANGE_K, PAINTED_PEAK, starMaterial, type MotionUniforms } from "../graphics/looks";
import { BAND_TO_MAP_LY } from "../model/parameters";
import { starDistance } from "../model/star-distances";
import type { VoyageKit } from "./kit";

/** The sky sphere's radius, km: inside the frustum, beyond the solar system's bodies. */
const SKY_RADIUS_KM = 1e10;
/** The Sun's apparent magnitude from a parsec (absolute 4.83 − 5), and its temperature. */
const SUN_MAG_AT_PC = -0.17;
const SUN_KELVIN = 5772;

/** The Sun as a sky point at the origin, a parsec's distance as its brightness reference. */
function sunGeometry() {
  const geometry = pointsGeometry(
    new Float32Array([0, 0, 0]),
    new Float32Array([1, 1, 1]),
    new Float32Array([starSize(SUN_MAG_AT_PC)]),
  );
  geometry.setAttribute("distance", new BufferAttribute(new Float32Array([1]), 1));
  geometry.setAttribute("temperature", new BufferAttribute(new Float32Array([SUN_KELVIN]), 1));
  return geometry;
}

export function createStarsLayer(
  { scope, dpr }: VoyageKit,
  parent: Object3D,
  lut: DataTexture,
  motion: MotionUniforms,
  counts: SkyCounts,
) {
  const shipPc = new Vector3();
  const material = scope.own(starMaterial(dpr, lut, motion, shipPc));
  /* The painted sky's points share the motion but fade on their own and brighten less. */
  const paintedMaterial = () => {
    const made = starMaterial(dpr, lut, motion, shipPc);
    made.uniforms.peak!.value = PAINTED_PEAK;
    return made;
  };
  const painted = scope.own(paintedMaterial());
  const sky = new Points(
    scope.own(
      brightStarGeometry({ floor: 0.55, full: 1.4, size: starSize, distanceOf: starDistance }),
    ),
    material,
  );
  const sun = new Points(scope.own(sunGeometry()), material);
  const field = new Points(fieldStars(counts.fieldStars, true), painted);
  scope.defer(() => field.geometry.dispose());
  const milkyWay = scope.own(
    createMilkyWay(counts.milkyWay, {
      /* The band fades the grains itself and disposes them with the rest. */
      grain: paintedMaterial,
      eras: "today",
      parallax: true,
      motion: {
        forward: motion.forward,
        beta: motion.beta,
        gamma: motion.gamma,
        lut,
        lutRange: LUT_RANGE_K,
      },
    }),
  );
  milkyWay.group.scale.setScalar(SKY_RADIUS_KM);
  for (const points of [sky, sun, field]) {
    points.renderOrder = -2;
    points.frustumCulled = false;
  }
  parent.add(milkyWay.group, field, sky, sun);
  material.uniforms.radius!.value = SKY_RADIUS_KM;
  painted.uniforms.radius!.value = SKY_RADIUS_KM;
  let drawn = counts;
  let presence = -1;

  return {
    /** Resamples the band's grains and the field at a new quality's counts. */
    setCounts(next: SkyCounts) {
      if (next.milkyWay !== drawn.milkyWay) milkyWay.setGrains(next.milkyWay);
      if (next.fieldStars !== drawn.fieldStars) {
        field.geometry.dispose();
        field.geometry = fieldStars(next.fieldStars, true);
      }
      drawn = next;
    },
    /** Draws the sky for the ship at `x` (km, heliocentric), `distAu` from the Sun. */
    update(x: Readonly<Vec3d>, distAu: number) {
      shipPc.set(x[0] / PARSEC_KM, x[1] / PARSEC_KM, x[2] / PARSEC_KM);
      /* The painted band is the sky from here; the Galaxy map takes over light-years out. */
      const band = 1 - rising(distAu / LY, BAND_TO_MAP_LY[0], BAND_TO_MAP_LY[1]);
      if (band !== presence) {
        presence = band;
        milkyWay.set(0, 1, band, 0);
        painted.uniforms.fade!.value = band;
        field.visible = band > 0.004;
      }
    },
  };
}

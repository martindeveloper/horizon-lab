/**
 * The sky about the ship, drawn behind everything: the bright stars at their real distances
 * (the sky shifts as the ship covers light-years), the Sun as one star among them once the
 * ship is far enough to see it so, and the Milky Way as the painted band the Orrery draws,
 * with its grains and a faint field, carried with the ship and faded out as the Galaxy map
 * takes over light-years out. At speed the whole sky crowds ahead and shifts colour
 * (star.vert.glsl, band.frag.glsl): the ship's velocity reaches the shaders as β, γ and the
 * direction of travel. α Centauri's catalogue point gives way as the α Centauri layer's discs
 * take over: a point a few million km from the ship, placed in single precision, would point
 * anywhere.
 */
import { BufferAttribute, Points, Vector3, type DataTexture, type Object3D } from "three";

import { brightStarGeometry } from "@/space/bright-stars";
import { LY } from "@/space/galaxy/scene/frames";
import { createMilkyWay, fieldStars, starSize, type SkyCounts } from "@/space/sky/milky-way";
import { STARS } from "@/space/star-catalogue";
import { starDistance } from "@/space/star-distances";
import { pointsGeometry, rising, type Vec3d } from "@horizon/toolkit/scene";
import { PARSEC_KM, SOLAR_ABSOLUTE_MAGNITUDE_V, SOLAR_TEFF_K } from "@horizon/toolkit/science";

import { LUT_SPEC, starMaterial, SURFACE_PEAK, type MotionUniforms } from "../graphics/looks";
import { ALPHA_CENTAURI_CATALOGUE_NAME } from "../model/alpha-centauri";
import { BAND_TO_MAP_LY } from "../model/parameters";
import type { VoyageKit } from "./kit";

/** The sky sphere's radius, km: inside the frustum, beyond the solar system's bodies. */
const SKY_RADIUS_KM = 1e10;
/** The Sun's apparent magnitude from a parsec: its absolute magnitude (from 10 pc) − 5. */
const SUN_MAG_AT_PC = SOLAR_ABSOLUTE_MAGNITUDE_V - 5;

/** The Sun as a sky point at the origin, a parsec's distance as its brightness reference. */
function sunGeometry() {
  const geometry = pointsGeometry(
    new Float32Array([0, 0, 0]),
    new Float32Array([1, 1, 1]),
    new Float32Array([starSize(SUN_MAG_AT_PC)]),
  );
  geometry.setAttribute("distance", new BufferAttribute(new Float32Array([1]), 1));
  geometry.setAttribute("temperature", new BufferAttribute(new Float32Array([SOLAR_TEFF_K]), 1));
  geometry.setAttribute("handover", new BufferAttribute(new Float32Array([0]), 1));
  return geometry;
}

/** The catalogue's stars, with α Centauri's point marked as the one another layer takes over. */
function catalogueGeometry() {
  const geometry = brightStarGeometry({
    floor: 0.55,
    full: 1.4,
    size: starSize,
    distanceOf: starDistance,
  });
  const handover = new Float32Array(
    STARS.map(([name]) => +(name === ALPHA_CENTAURI_CATALOGUE_NAME)),
  );
  geometry.setAttribute("handover", new BufferAttribute(handover, 1));
  return geometry;
}

export function createStarsLayer(
  { scope, dpr, invalidate }: VoyageKit,
  parent: Object3D,
  lut: DataTexture,
  motion: MotionUniforms,
  counts: SkyCounts,
) {
  const shipPc = new Vector3();
  const material = scope.own(starMaterial(dpr, lut, motion, shipPc));
  /* The painted sky's points share the motion but fade on their own and brighten as a surface. */
  const paintedMaterial = () => starMaterial(dpr, lut, motion, shipPc, true);
  const painted = scope.own(paintedMaterial());
  const sky = new Points(scope.own(catalogueGeometry()), material);
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
        lutSpec: LUT_SPEC,
        peak: SURFACE_PEAK,
      },
      wake: invalidate,
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
    /**
     * Draws the sky for the ship at `x` (km, heliocentric), `distAu` from the Sun, with α
     * Centauri's point given over to its discs by `handedOver` (0–1).
     */
    update(x: Readonly<Vec3d>, distAu: number, handedOver: number) {
      shipPc.set(x[0] / PARSEC_KM, x[1] / PARSEC_KM, x[2] / PARSEC_KM);
      material.uniforms.handedOver!.value = handedOver;
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

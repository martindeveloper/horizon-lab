/**
 * How many convection cells span a star's radius, shared by the labs that draw a photosphere
 * (Giants, Afterglow): a cell is a few pressure scale heights of the photosphere across, so
 * the Sun shows hundreds, a red giant a few huge ones. The number of scale heights is the
 * Sun's measured granule (`GRANULE_SIZE_KM`) over its own scale height, so today's Sun shows
 * exactly the cells the Sun lab draws.
 */
import { SOLAR_MEAN_MOLECULAR_WEIGHT } from "@/space/solar-composition";
import {
  SOLAR_MASS_KG,
  SOLAR_RADIUS_KM,
  SOLAR_TEFF_K,
  pressureScaleHeight,
  surfaceGravity,
} from "@horizon/toolkit/science";

import { GRANULE_SIZE_KM } from "./parameters";

const SOLAR_RADIUS_M = SOLAR_RADIUS_KM * 1e3;

/**
 * Mean mass per particle of a star's photosphere in atomic mass units: the Sun's neutral gas
 * (`SOLAR_MEAN_MOLECULAR_WEIGHT`), for every star. A teaching choice for the scale height that
 * sizes the granules.
 */
export const MEAN_MOLECULAR_WEIGHT = SOLAR_MEAN_MOLECULAR_WEIGHT;
/** A star's photospheric pressure scale height, m: the kit's law at its surface gravity and temperature. */
function scaleHeight(massSuns: number, radiusSuns: number, kelvin: number) {
  const g = surfaceGravity.compute({ M: massSuns * SOLAR_MASS_KG, R: radiusSuns * SOLAR_RADIUS_M });
  return pressureScaleHeight.compute({ T: kelvin, mu: MEAN_MOLECULAR_WEIGHT, g });
}

/** A convection cell spans this many pressure scale heights: the Sun's measured granule over its own (about 7). */
export const GRANULE_SCALE_HEIGHTS = (GRANULE_SIZE_KM * 1e3) / scaleHeight(1, 1, SOLAR_TEFF_K);

/**
 * Convection cells across a star's radius: its radius over a cell of `GRANULE_SCALE_HEIGHTS`
 * pressure scale heights of its photosphere. The Sun has hundreds; a red supergiant a handful.
 */
export function granulesAcross(massSuns: number, radiusSuns: number, kelvin: number) {
  return (
    (radiusSuns * SOLAR_RADIUS_M) /
    (GRANULE_SCALE_HEIGHTS * scaleHeight(massSuns, radiusSuns, kelvin))
  );
}

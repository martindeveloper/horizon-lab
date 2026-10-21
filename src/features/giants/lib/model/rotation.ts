/**
 * Espinosa Lara & Rieutord (2011), equations 24–32, Roche rotation model.
 * omega is Ω / sqrt(GM/Re³), NOT Ω/Ωcritical at fixed polar radius.
 * https://arxiv.org/abs/1109.3038
 */
import { SOLAR_TEFF_K } from "@horizon/toolkit/science";

/** The Roche equipotential's polar/equatorial ratio determines its rotation. */
export function rocheOmega(polarOverEquator: number) {
  if (!(polarOverEquator > 2 / 3 && polarOverEquator <= 1))
    throw new RangeError("A subcritical Roche surface needs 2/3 < Rp/Re ≤ 1");
  return Math.sqrt(2 * (1 / polarOverEquator - 1));
}

/** Radius / Re at colatitude theta, from the inner root of the Roche equipotential. */
export function rocheRadius(omega: number, theta: number) {
  if (!(omega >= 0 && omega < 1)) throw new RangeError("Roche rotation must be subcritical");
  const w2 = omega * omega;
  const sin2 = Math.sin(theta) ** 2;
  let lo = 1 / (1 + w2 / 2);
  let hi = 1;
  for (let i = 0; i < 48; i++) {
    const r = (lo + hi) / 2;
    if (1 / r + 0.5 * w2 * r * r * sin2 > 1 + w2 / 2) lo = r;
    else hi = r;
  }
  return (lo + hi) / 2;
}

/** T / (L / 4πσRe²)^¼. The analytic pole and equator limits avoid 0/0. */
export function elrTemperature(omega: number, theta: number) {
  const r = rocheRadius(omega, theta);
  if (omega < 1e-6) return 1;
  const w2 = omega * omega;
  const cos = Math.abs(Math.cos(theta));
  const sin = Math.sqrt(Math.max(0, 1 - cos * cos));
  const gravity = Math.hypot(1 / (r * r) - w2 * r * sin * sin, w2 * r * sin * cos);
  let correction: number;
  if (sin < 1e-5) correction = Math.exp((2 / 3) * w2 * r ** 3);
  else if (cos < 1e-4) correction = (1 - w2 * r ** 3) ** (-2 / 3);
  else {
    // h(theta) = cos(theta) - atanh(cos(theta)); monotone decreasing in cos(theta).
    const target = cos - Math.atanh(cos) + (w2 * r ** 3 * cos ** 3) / 3;
    let lo = 0;
    let hi = cos;
    for (let j = 0; j < 52; j++) {
      const c = (lo + hi) / 2;
      if (c - Math.atanh(c) > target) lo = c;
      else hi = c;
    }
    const c = (lo + hi) / 2;
    correction = ((1 - c * c) * cos * cos) / (c * c * sin * sin);
  }
  return (gravity * correction) ** 0.25;
}

/**
 * ELR latitude profile mapped to our existing spheroid (not an exact Roche silhouette).
 * Normalize ∫σT⁴ dA to the adopted luminosity on that drawn spheroid. The resulting
 * local temperatures are model predictions, not new measurements of the catalogue star.
 */
export function rotatingTemperatures(
  polarOverEquator: number,
  equatorialSuns: number,
  lightSuns: number,
  size = 129,
) {
  if (!(equatorialSuns > 0 && lightSuns > 0) || size < 3)
    throw new RangeError("A temperature profile needs positive size and luminosity");
  const omega = rocheOmega(polarOverEquator);
  const values = new Float64Array(size);
  let integral = 0;
  for (let j = 0; j < size; j++) {
    const y = j / (size - 1); // unit-sphere coordinate used by hitSpheroid
    const theta = Math.atan2(Math.sqrt(1 - y * y), polarOverEquator * y);
    values[j] = elrTemperature(omega, theta);
    const area = Math.sqrt(polarOverEquator ** 2 * (1 - y * y) + y * y);
    integral += (values[j]! ** 4 * area * (j === 0 || j === size - 1 ? 0.5 : 1)) / (size - 1);
  }
  const scale = SOLAR_TEFF_K * (lightSuns / (equatorialSuns ** 2 * integral)) ** 0.25;
  return values.map((value) => value * scale);
}

/** Inclination from the sightline; shader tilt is measured from the sky plane. */
export const ROTATOR_INCLINATIONS = {
  vega: 6.2, // Monnier et al. 2012, Table 2, concordance Model 3.
  achernar: 60.6, // Domiciano de Souza et al. 2014, Table 2.
} as const;

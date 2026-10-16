import { circularOrbitEnergy, circularOrbitMomentum, keplerAngularVelocity } from "./equations";
/** Relative zero-torque Page–Thorne flux, G=c=M=1; no accretion-rate normalization.
 * Integrate (E − ΩL)dL once per spin change, rather than twice per pixel per frame.
 * Reference: Page & Thorne (1974), equations 11b and 15.
 */
import { DISK_OUTER_RADIUS, DISK_PROFILE_SIZE } from "./parameters";

export { DISK_OUTER_RADIUS, DISK_PROFILE_SIZE };

export function circularOrbit(r: number, a: number) {
  return {
    energy: circularOrbitEnergy.compute({ r, a }),
    momentum: circularOrbitMomentum.compute({ r, a }),
    omega: keplerAngularVelocity.compute({ r, a }),
  };
}

export function diskFluxProfile(
  spin: number,
  inner: number,
  outer = DISK_OUTER_RADIUS,
  size = DISK_PROFILE_SIZE,
) {
  if (inner <= 1 || outer <= inner || size < 2 || !Number.isInteger(size))
    throw new RangeError("Invalid disk grid");
  const values = new Float32Array(size);
  let previous = circularOrbit(inner, spin);
  let integral = 0;
  for (let i = 1; i < size; i++) {
    const r = inner + ((outer - inner) * i) / (size - 1);
    const current = circularOrbit(r, spin);
    const weight = current.energy - current.omega * current.momentum;
    const previousWeight = previous.energy - previous.omega * previous.momentum;
    integral += 0.5 * (weight + previousWeight) * (current.momentum - previous.momentum);
    const minusDerivative = 1.5 * Math.sqrt(r) * current.omega ** 2;
    values[i] = Math.max(0, (minusDerivative * integral) / (r * weight ** 2));
    previous = current;
  }
  return values;
}

/** RGBA float texture, peak-normalized; nearest filtering plus shader interpolation
 * avoids requiring the optional float-linear-filter extension on mobile GPUs. */
export function diskProfilePixels(spin: number, inner: number) {
  const flux = diskFluxProfile(spin, inner);
  const peak = Math.max(...flux, 1e-12);
  const rgba = new Float32Array(flux.length * 4);
  for (let i = 0; i < flux.length; i++) rgba[i * 4] = (flux[i] ?? 0) / peak;
  return rgba;
}

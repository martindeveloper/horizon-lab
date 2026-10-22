import type { Photosphere } from "../atmospheres";
import type { ElementId } from "../atoms";
import type { Gas } from "../profile";

export type Instrument = {
  /** Line-of-sight speed of the source, km/s, positive when receding. */
  velocity: number;
  /** Air masses of Earth's atmosphere in the beam: 0 in space or the lab. */
  airmass: number;
  /** Resolving power λ / Δλ of the spectrograph. */
  resolution: number;
};

export type SlabObservation = Instrument & {
  kind: "slab";
  gas: Gas;
  /** Temperature of the black body behind the gas, K; null when only the gas shines. */
  background: number | null;
};

export type StarObservation = Instrument & {
  kind: "star";
  photosphere: Photosphere;
  /** km/s. */
  microturbulence: number;
  /** Changes to the Sun's abundances, dex, by element. */
  abundances?: Partial<Record<ElementId, number>>;
};

export type Observation = SlabObservation | StarObservation;

export type Spectrum = {
  /** Pixel centres, nm, evenly spaced. */
  wavelengths: Float64Array;
  /**
   * What reaches the detector: the bench's intensity, W m⁻² sr⁻¹ m⁻¹, or a star's surface
   * flux, W m⁻² m⁻¹ (πI at μ = 2/3).
   */
  flux: Float64Array;
  /** The source's continuum without lines; zeros when nothing shines behind the gas. */
  continuum: Float64Array;
  /** The largest flux or continuum in view, for scaling plots. */
  peak: number;
};

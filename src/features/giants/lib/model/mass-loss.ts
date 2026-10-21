/**
 * An illustrative red-supergiant surface outflow, independent of solar magnetic flares.
 * Emission/opacity weights dilute with inverse cloud area after launch. Grey-grain radiative
 * equilibrium supplies a cooling floor; condensation follows cooling, never precedes it.
 * Speeds, recurrence, opacity and the condensation interval are display assumptions,
 * not a reconstruction of Betelgeuse's 2019 event (Dupree et al. 2022).
 */
import { smoothstep, type Vec3 } from "@horizon/toolkit/math";

export const OUTFLOW_SLOTS = 2;
export const OUTFLOW_WINDOW_S = 210;
export const OUTFLOW_LIFE_S = 100;

export type Outflow = {
  /** Centre in view coordinates and Gaussian width, in stellar radii. */
  centre: Vec3;
  width: number;
  /** Gas emission column and dust optical depth; zero outside the event. */
  gas: number;
  dust: number;
  temperature: number;
  seed: number;
};

export const blankOutflow = (): Outflow => ({
  centre: [0, 0, 0],
  width: 0.19,
  gas: 0,
  dust: 0,
  temperature: 0,
  seed: 0,
});

/** Temperature of a grey grain heated by the finite stellar disc, not the gas temperature. */
export function grainTemperature(stellarK: number, radius: number) {
  const inverseSquare = 1 / Math.max(1, radius) ** 2;
  // Rationalized form avoids cancellation far from the star.
  const dilution = (0.5 * inverseSquare) / (1 + Math.sqrt(1 - inverseSquare));
  return stellarK * dilution ** 0.25;
}

/** Write one age of an expanding cloud; its origin/direction are assigned by the forecast. */
export function evolveOutflow(out: Outflow, age: number, stellarK: number) {
  const t = Math.max(0, age);
  const radius = 1.03 + 0.029 * t;
  out.width = 0.19 + 0.13 * (radius - 1.03);
  const expansion = out.width / 0.19;
  const grainK = grainTemperature(stellarK, radius);
  // Adiabatic cooling surrogate, bounded below by the irradiation temperature.
  out.temperature = Math.max(grainK, (1.45 * stellarK) / expansion ** 2);
  const formed = 1 - smoothstep(1300, 1700, Math.max(grainK, out.temperature));
  const envelope =
    age < 0 || age >= OUTFLOW_LIFE_S
      ? 0
      : smoothstep(0, 8, age) * (1 - smoothstep(80, OUTFLOW_LIFE_S, age));
  const column = envelope / expansion ** 2;
  out.gas = column * (1 - formed);
  out.dust = 5 * column * formed;
  return radius;
}

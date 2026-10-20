/**
 * Extreme Kerr  —  theory, near-maximal astrophysical spin.
 *
 * Kerr metric, Thorne (1974) thin-disk cap:
 *   a/M = 0.998     (not the mathematical edge a = 1)
 *   r₊/M = 1 + √(1 − a²) ≈ 1.063
 *
 * Prograde ISCO (Bardeen–Press–Teukolsky):
 *   a = 0   →  6M
 *   a → 1   →  1M
 *   a = 0.998 → ≈ 1.24M
 *
 * Irreducible mass / spin energy:
 *   M_irr = M √((1 + √(1−a²))/2)
 *   a = 1  ⇒  up to 29% of Mc² sits in the spin
 *
 * Ergosphere (equator): r = 2M. Inside it, even light must co-rotate.
 * Sky: host-galaxy wash (weather = host).
 */
import { gasTurnRate } from "../parameters";
import type { HoleSpec } from "./types";

/** Thorne's equilibrium spin; the riding beat's orbit rate follows it. */
const SPIN = 0.998;

export const kerr: HoleSpec = {
  id: "kerr",
  name: "Extreme Kerr",
  kind: "theory",
  massSolar: 3e7,
  spin: SPIN,
  inclination: 0.18,
  distance: 26,
  exposure: 1.1,
  diskBrightness: 1.25,
  starIntensity: 0.9,
  tempScale: 1.2,
  sky: "host",
  jet: 0,
  aliases: ["kerr", "extreme-kerr"],
  tour: [
    // Every move turns with the hole and leans into the drag.
    {
      phase: "wide",
      duration: 9,
      yaw: -0.9,
      inclination: 0.18,
      distance: 118,
      lift: 0.3,
      lead: 0.3,
      roll: -0.03,
      eq: "a/M = 0.998    ·    r₊ / M = 1 + √(1 − (a/M)²) ≈ 1.06",
    },
    // Dive in close; the ISCO ring tightens from 6M once the camera lands.
    {
      phase: "dolly",
      duration: 10,
      yaw: -0.8,
      inclination: 0.32,
      distance: 22,
      swing: -0.12,
      lead: -0.4,
      roll: -0.04,
      sketch: [{ kind: "rings", rings: ["isco", "horizon"], from: { isco: 6 } }],
      eq: "r_ISCO / M → 1    as    a/M → 1  (prograde)",
    },
    {
      phase: "detail",
      duration: 9,
      yaw: -0.9,
      inclination: 1.02,
      distance: 28,
      lift: 0.12,
      roll: -0.05,
      drift: -0.012,
      sketch: [{ kind: "drag" }],
      eq: "M_irr = M √((1 + √(1 − (a/M)²))/2)    ·    a/M = 1 ⇒ M − M_irr ≈ 0.29 M",
    },
    // Down onto the disk, then ride with the gas, looking along its flow: the camera moves at
    // the gas's speed (the sky aberrates and shifts) and orbits at its animated rate, so the
    // texture holds still beneath it.
    {
      phase: "hold",
      duration: 9,
      yaw: -0.6,
      inclination: 0.1,
      distance: 9,
      swing: 0.2,
      lead: 0.4,
      roll: -0.02,
      look: { yaw: 0.22, pitch: -0.03 },
      ride: 1,
      drift: -gasTurnRate(9, SPIN),
      creep: 0,
      eq: "a/M ≈ 0.998   (Thorne 1974)",
    },
    {
      phase: "wide",
      duration: 10,
      yaw: -1.4,
      inclination: 0.48,
      distance: 126,
      lift: 0.3,
      lead: -0.2,
    },
  ],
};

/**
 * GW231123  —  catalog remnant of the most massive binary black-hole merger
 * confidently detected (as of GWTC-5.0, 2026).
 *
 *   detected   2023-11-23 13:54:30 UTC, LIGO Hanford + Livingston only; ~0.1 s, ~5 cycles at 30–80 Hz
 *   m₁, m₂     137 (+23/−18) and 101 (+22/−50) M☉; total 236 M☉
 *   M_f        222 (+28/−42) M☉   LVK, ApJL 993, L25 (2025), arXiv:2507.08219 v3
 *   χ_f        0.84 (+0.08/−0.16), model-dependent (0.70–0.88 across waveforms)
 *   D_L        2.2 (+1.9/−1.5) Gpc, z ≈ 0.40; waves travelled ≈ 2–6 Gyr
 *   sky        ΔΩ₉₀ ≈ 1,700 deg² (GWTC-4.0; two detectors); no host galaxy, no light detected
 *   gap        the lighter hole lies in the pair-instability gap (~60–130 M☉) with ~83 % probability;
 *              hierarchical mergers (one or both components) are a leading explanation
 *
 * Mass and spin on the dial are the remnant's. No matter remains: the disk is off.
 * Sky: generic deep field (weather = lensed).
 */
import type { HoleSpec } from "./types";

export const gw231123: HoleSpec = {
  id: "gw231123",
  name: "GW231123",
  kind: "catalog",
  catalog: "z ≈ 0.4",
  blurb:
    "The remnant of the most massive black-hole merger detected so far, found only through gravitational waves.",
  massSolar: 222,
  spin: 0.84,
  inclination: 0.6,
  distance: 28,
  exposure: 1.1,
  diskBrightness: 0,
  starIntensity: 1.3,
  tempScale: 1,
  sky: "lensed",
  jet: 0,
  aliases: ["gw231123", "gw-231123"],
  tour: [
    {
      duration: 9.5,
      yaw: -1,
      inclination: 0.25,
      distance: 130,
      lift: 0.3,
      lead: 0.3,
      eq: "m₁ ≈ 137 M☉  +  m₂ ≈ 101 M☉   →   M_f ≈ 222 M☉",
    },
    // A quick tightening spiral, like the final orbits before the merger.
    {
      duration: 9,
      yaw: -2.2,
      inclination: 0.5,
      distance: 44,
      lead: 0.5,
      roll: -0.04,
      drift: -0.012,
      eq: "f ≈ 30–80 Hz    ·    D_L ≈ 2.2 Gpc",
    },
    {
      duration: 8.5,
      yaw: -0.5,
      inclination: 0.9,
      distance: 24,
      lead: -0.3,
      roll: -0.03,
      sketch: [{ kind: "shadow" }, { kind: "rings", rings: ["horizon"] }],
      eq: "χ_f = 0.84 (+0.08 / −0.16)",
    },
    {
      duration: 8.5,
      yaw: 0.6,
      inclination: 0.3,
      distance: 30,
      swing: 0.2,
      eq: "pair-instability gap ≈ 60–130 M☉",
    },
    { duration: 10, yaw: -1.3, inclination: 0.5, distance: 150, lift: 0.25, lead: -0.2 },
  ],
};

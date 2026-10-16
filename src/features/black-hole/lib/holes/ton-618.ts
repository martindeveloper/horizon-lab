/**
 * TON 618  —  catalog hole, hyperluminous quasar.
 *
 *   z = 2.219         Shemmer et al., ApJ 614, 547 (2004); light left ≈ 10.8 Gyr ago,
 *                     comoving distance ≈ 18 Gly (Planck 2018 cosmology)
 *   M ≈ 4–7 × 10¹⁰ M☉ single-epoch Hβ virial estimates: 6.6 × 10¹⁰ (Shemmer 2004),
 *                     4.07 × 10¹⁰ (Ge et al., AJ 157, 148, 2019); factor-of-a-few systematics
 *   a/M ≈ 0.6         not measured; a thin-disk mass limit (King 2016) needs a ≳ 0.6 at 6.6 × 10¹⁰
 *   L_bol ≈ 1–2 × 10⁴⁸ erg/s, L/L_Edd ≈ 0.14–0.37; radio-loud with an inner jet
 *   surroundings      enormous Lyα nebula (Cai et al. 2019); ~100 kpc cold-gas reservoir
 *                     and molecular outflow (Li et al., ApJL 922, L29, 2021)
 *   i                 unknown; a type-1 quasar is seen within ~45° of its axis, so the view is fairly face-on
 *
 * Mass on the dial is the lower estimate. Sky: host galaxy (weather = host).
 */
import type { HoleSpec } from "./types";

export const ton618: HoleSpec = {
  id: "ton-618",
  name: "TON 618",
  kind: "catalog",
  catalog: "z = 2.219",
  blurb:
    "A hyperluminous quasar whose light left 10.8 billion years ago; one of the heaviest black holes known.",
  massSolar: 4.07e10,
  spin: 0.6,
  inclination: 1.0,
  distance: 30,
  exposure: 0.95,
  diskBrightness: 1.35,
  starIntensity: 0.8,
  tempScale: 0.8,
  sky: "host",
  jet: 0.5,
  aliases: ["ton-618", "ton618"],
  tour: [
    // A long fall in from far away, as its light did.
    {
      duration: 10.5,
      yaw: 1.1,
      inclination: 0.5,
      distance: 160,
      lift: 0.3,
      lead: -0.3,
      eq: "z = 2.219    ·    t_light ≈ 10.8 Gyr",
    },
    {
      duration: 9.5,
      yaw: -0.9,
      inclination: 0.35,
      distance: 60,
      swing: 0.15,
      lead: 0.4,
      roll: -0.03,
    },
    {
      duration: 9,
      yaw: 0.6,
      inclination: 1.0,
      distance: 30,
      lead: -0.3,
      roll: 0.02,
      sketch: [
        { kind: "shadow", assumed: true },
        { kind: "ruler", length: 10 },
      ],
      eq: "M = f R v² / G ≈ 4–7 × 10¹⁰ M☉",
    },
    {
      duration: 8.5,
      yaw: -0.6,
      inclination: 0.7,
      distance: 34,
      swing: 0.2,
      eq: "R_s = 2GM/c² ≈ 800–1,300 au",
    },
    { duration: 10.5, yaw: 1.5, inclination: 0.6, distance: 160, lift: 0.25, lead: 0.3 },
  ],
};

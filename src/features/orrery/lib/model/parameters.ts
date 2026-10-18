import { convert } from "@horizon/toolkit/science";

/**
 * The orrery model's numbers, once. The model code computes with them and the
 * printed formulas in `equations.ts` are built from them, so changing a value
 * here changes the scene, the technical notes and the tests together.
 */

/** Sun's age: the oldest solids, CAIs, are 4567.3 ± 0.16 Myr old (Connelly et al. 2012). */
export const SUN_BIRTH = 4.567e9;
/** Gas disk lifetime after the first solids (observed disks last ~3–10 Myr). */
export const GAS_DISK_LIFETIME = 5e6;
/** Dust grains have grown into km-size planetesimals ~0.1 Myr after the first solids. */
export const PLANETESIMALS_AFTER = 1e5;
/** Runaway, then oligarchic growth gives Moon-mass embryos by ~1 Myr. */
export const EMBRYOS_AFTER = 1e6;
/** Notes turn from gas dispersal to merging versus shattering collisions here (~20 Myr). */
export const BELT_STIRRED_AFTER = 2e7;
/** The Moon-forming impact is narrated from here (~45 Myr); its date is still debated. */
export const MOON_IMPACT_AFTER = 4.5e7;
/** Water ice condenses beyond ~2–4 au in the young disk: the snow line (drawn at 3 au). */
export const SNOW_LINE_AU = 3;
/** Classic Late Heavy Bombardment date from Apollo impact-melt ages, ~3.9 Gyr ago. */
export const LHB_CLASSIC = 3.9e9;
/** The sketch starts with the gas disk gone and the giants formed. */
export const MODEL_START = 4.5e9;
/**
 * The instability and Neptune's migration are over by here. The smoothstep is steepest
 * at 4.475 Gyr ago, ~90 Myr after the CAIs, inside the 60–100 Myr window dated from
 * enstatite meteorites and Jupiter Trojan binaries (Avdellidou et al. 2024; Nesvorný et al. 2018, Nat. Astron. 2, 878).
 */
export const CLEAR_DONE = 4.45e9;

/** One kiloparsec in light-years. */
export const KPC_LY = convert(1, "kpc", "ly");
/** Sun–centre distance 8.28 kpc (GRAVITY 2021/2022: 8.275–8.277 kpc), in light-years. */
export const SUN_GALACTIC_RADIUS_LY = 27_000;
/** The Sun sits about 21 pc north of the Galactic plane (Bennett & Bovy 2019). */
export const SUN_HEIGHT_LY = 68;
/**
 * Galactic orbital period: 2πR₀/Θ₀ with R₀ = 8.28 kpc and a local circular speed of
 * 229–236 km/s (Eilers et al. 2019; Reid et al. 2019) is ~215–225 Myr.
 */
export const GALACTIC_YEAR = 220e6;
/**
 * Epicycles: the Sun moves a little faster than the local circular speed, so it is
 * near the inner end of a ~0.5 kpc radial amplitude (period ~170 Myr from the Oort
 * constants, Bovy 2017) and is climbing north (W ≈ +7 km/s, Schönrich et al. 2010)
 * through a ~±100 pc vertical oscillation (period ~85 Myr for ρ₀ ≈ 0.1 M☉/pc³).
 */
export const RADIAL_AMPLITUDE_LY = 1_600;
export const RADIAL_PERIOD = 170e6;
export const VERTICAL_AMPLITUDE_LY = 330;
export const VERTICAL_PERIOD = 85e6;
/** Orientation of the Galactic bar relative to the Sun–centre line (~28°). */
export const BAR_ANGLE_DEG = 28;
/** Mean arm pitch angle (Vallée 2017, ~13°). */
export const ARM_PITCH_DEG = 13;
/** Bar half-length ~4.3 kpc, within the 3.5–5 kpc estimates; the arms start near its ends. */
export const ARM_START_KPC = 4.3;
/** Reid et al. (2019) fit the arms with R₀ = 8.15 kpc. */
export const REID_R0_KPC = 8.15;
/**
 * Where Scutum–Centaurus, Sagittarius–Carina, Perseus and the Outer arm cross the
 * Sun–centre line in Reid et al. (2019, Table 2), in their R₀ = 8.15 kpc frame. The
 * model keeps each arm's distance from the Sun, so it moves with this model's R₀.
 */
export const ARM_CROSSINGS_KPC = [5.4, 6.9, 10.1, 12.4] as const;
/** Warp onset, amplitude, power and line of nodes: Chen et al. 2019's linear fit to all Cepheids. */
export const WARP_START_KPC = 9.3;
export const WARP_AMPLITUDE_KPC = 0.15;
export const WARP_POWER = 1;
export const WARP_NODES_DEG = 17.4;

/** The primordial planetesimal disk outside the packed giants (Morbidelli 2005, Nice model). */
export const DISK_AU = [16, 34] as const;
/** Cold classicals form near here and stay (Kaib & Volk 2022: 42–47.5 au). */
export const COLD_CLASSICAL_AU = [42, 48] as const;
/** Radii of the Oort cloud's two guide shells (art direction inside the inferred edges). */
export const OORT_SHELLS_AU = [5_000, 100_000] as const;
/** Jupiter's Trojans gather about L4 and L5, 60° ahead of and behind the planet. */
export const TROJAN_OFFSET_DEG = 60;
/** Newton steps for Kepler's equation in the swarm vertex shader (e ≤ 0.3 converges). */
export const SWARM_KEPLER_STEPS = 4;
/** The young gas disk's painted radius. */
export const GAS_DISK_RADIUS_AU = 120;
/** Dust sublimates inside roughly 0.1–0.4 au: the disk's inner cavity. */
export const DUST_CAVITY_IN_AU = 0.1;
export const DUST_CAVITY_OUT_AU = 0.42;
/** The disk fades over its outer 8 % (art direction). */
export const GAS_RIM_FRACTION = 0.92;
/** Neutral white display of the HMI intensity map; HMI is not an RGB photograph. */
export const SUN_CENTRE_RGB = [1, 1, 1] as const;
/** Linear texture intensity of the quiet photosphere; reserves headroom for faculae. */
export const SUN_MAP_QUIET_INTENSITY = 0.8;
/**
 * Solar limb darkening I(μ)/I(1) = 1 − u(1 − μ) − v(1 − μ²) for red, green and
 * blue (0.65, 0.55, 0.45 µm), from the SolarSoft darklimb_u/v fits to Allen's
 * Astrophysical Quantities: the limb keeps ~40 % of the centre's red light but
 * only ~19 % of its blue, so it is darker and redder.
 */
export const SUN_LIMB_U = [0.802, 0.914, 0.978] as const;
export const SUN_LIMB_V = [-0.198, -0.215, -0.164] as const;
/** Display choice: retain slight edge warmth, not the full narrow-band colour contrast. */
export const SUN_LIMB_CHROMA = 0.2;
/** Terminator wrap on the planets: a narrow penumbra-and-haze softening (art direction). */
export const PLANET_WRAP = 0.12;
/** Floor of a ring's brightness, as a fraction of its particles' colour, so an unlit face still reads. */
export const RING_AMBIENT = 0.08;

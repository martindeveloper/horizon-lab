import { convert } from "@horizon/toolkit/science";

/**
 * The Galaxy model's numbers, once. The model code computes with them and the printed
 * formulas in `equations.ts` are built from them, so changing a value here changes the
 * scene, the technical notes and the tests together.
 */

/** One kiloparsec in light-years. */
export const KPC_LY = convert(1, "kpc", "ly");
/** Sun–centre distance 8.28 kpc (GRAVITY 2021/2022: 8.275–8.277 kpc), in light-years. */
export const SUN_GALACTIC_RADIUS_LY = 27_000;
/** The Sun sits about 21 pc north of the Galactic plane (Bennett & Bovy 2019). */
export const SUN_HEIGHT_LY = 68;
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
/** The thin disk and bar are in place by ~8 Gyr ago (Sanders et al. 2024; Xiang & Rix 2022), years. */
export const THIN_DISK_ERA = 8e9;
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
/** Exponential thin and thick disks: scale length and height (Bland-Hawthorn & Gerhard 2016). */
export const THIN_DISK_KPC = { length: 2.6, height: 0.3 } as const;
export const THICK_DISK_KPC = { length: 2, height: 0.9 } as const;
/** The dark-matter halo sphere's radius, R₂₀₀ ≈ 200 kpc (Bland-Hawthorn & Gerhard 2016). */
export const HALO_R200_KPC = 200;
/**
 * Warp onset, amplitude, power and line of nodes: Chen et al. 2019's linear fit to all
 * Cepheids. The amplitude carries kpc^(1 − power): for the linear fit it is a pure slope.
 */
export const WARP_START_KPC = 9.3;
export const WARP_AMPLITUDE_KPC = 0.15;
export const WARP_POWER = 1;
export const WARP_NODES_DEG = 17.4;

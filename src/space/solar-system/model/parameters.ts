/**
 * The solar system model's numbers, once: the Sun's age and galactic year, the young disk,
 * Neptune's migration, the populations and the looks' constants. The model computes with
 * them and the printed formulas in `equations.ts` are built from them, so changing a value
 * here changes both simulations' scenes, their technical notes and the tests together.
 */
import { GM_KM3_S2 } from "@horizon/toolkit/bodies";

/** Sun's age: the oldest solids, CAIs, are 4567.3 ± 0.16 Myr old (Connelly et al. 2012). */
export const SUN_BIRTH = 4.567e9;
/** Earth's age: 4.54 ± 0.05 Gyr from meteorites and the oldest lead (Dalrymple 2001). */
export const EARTH_AGE = 4.54e9;
/** Gas disk lifetime after the first solids (observed disks last ~3–10 Myr). */
export const GAS_DISK_LIFETIME = 5e6;
/** Water ice condenses beyond ~2–4 au in the young disk: the snow line (drawn at 3 au). */
export const SNOW_LINE_AU = 3;
/** The sketch starts with the gas disk gone and the giants formed. */
export const MODEL_START = 4.5e9;
/**
 * The instability and Neptune's migration are over by here (a teaching choice). The drawn
 * smoothstep runs 67–117 Myr after the CAIs and is steepest at 4.475 Gyr ago, 92 Myr after
 * them, inside the 60–100 Myr window dated from enstatite meteorites and Jupiter Trojan
 * binaries (Avdellidou et al. 2024; Nesvorný et al. 2018, Nat. Astron. 2, 878).
 */
export const CLEAR_DONE = 4.45e9;

/**
 * The Sun's galactic year: one lap at its own azimuthal speed, 2πR₀/(Θ₀ + V☉). With
 * R₀ = 8.28 kpc (GRAVITY) and 247 km/s (Reid et al. 2019) it is 206 Myr; 229 + 12 km/s
 * (Eilers et al. 2019; Schönrich et al. 2010) gives 211 Myr, and R₀ = 8.18 kpc 203 Myr.
 */
export const GALACTIC_YEAR = 206e6;

/**
 * The Moon's mass over Earth's, from the toolkit's GMs (IAU 2015 nominal Earth, DE440 Moon:
 * 0.0123000): the Earth–Moon barycentre lies 1/82.3 of the way to the Moon, 4,670 km from
 * Earth's centre.
 */
export const MOON_EARTH_MASS_RATIO = GM_KM3_S2.moon / GM_KM3_S2.earth;
/** Charon's mass over Pluto's (their GMs from Brozović et al. 2015): the barycentre is 1/9.19 of the way to Charon. */
export const CHARON_PLUTO_MASS_RATIO = GM_KM3_S2.charon / GM_KM3_S2.pluto;

/** The primordial planetesimal disk outside the packed giants (Morbidelli 2005, Nice model). */
export const DISK_AU = [16, 34] as const;
/** Cold classicals form near here and stay (Kaib & Volk 2022: 42–48 au). */
export const COLD_CLASSICAL_AU = [42, 48] as const;
/** Radii of the Oort cloud's two guide shells (art direction inside the inferred edges). */
export const OORT_SHELLS_AU = [5_000, 100_000] as const;
/** Jupiter's Trojans gather about L4 and L5, 60° ahead of and behind the planet. */
export const TROJAN_OFFSET_DEG = 60;
/** Newton steps for Kepler's equation in the swarm vertex shader (e ≤ 0.3 converges). */
export const SWARM_KEPLER_STEPS = 4;
/** Newton steps for the planetesimal sample's, whose orbits reach e = 0.96 (`TRACER_PUMP.maxE`). */
export const TRACER_KEPLER_STEPS = 6;
/**
 * A planetesimal bound for the Oort cloud is flung outward with its perihelion held near
 * Neptune's reach: its eccentricity climbs to 1 − q / a (with a no less than `floorAu` and e no
 * more than `maxE`) by `peakS` of its scattering, then eases to its final value as the Galaxy's
 * tide lifts the perihelion (art direction).
 */
export const TRACER_PUMP = { perihelionAu: 40, floorAu: 50, maxE: 0.96, peakS: 0.5 } as const;
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
/**
 * Micrometre dust's phase function as three Henyey–Greenstein lobes, asymmetries and weights:
 * the fit to Saturn's G ring (Hedman & Stark 2015, ApJ 811, 67, table 7), measured from 0.5°
 * to 170° of scattering. A narrow diffraction peak, a broad forward lobe and a nearly
 * isotropic rest: within a few degrees of the Sun a dusty ring outshines its sunlit face a
 * hundredfold.
 */
export const RING_DUST_HG_G = [0.995, 0.665, 0.035] as const;
export const RING_DUST_HG_W = [0.643, 0.176, 0.181] as const;

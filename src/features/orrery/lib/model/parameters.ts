/**
 * The Orrery's own numbers: the timeline's narrated moments and the sky's eras. The solar
 * system model's live in `@/space/solar-system/model/parameters`.
 */

/** Dust grains have grown into km-size planetesimals ~0.1 Myr after the first solids. */
export const PLANETESIMALS_AFTER = 1e5;

/** Runaway, then oligarchic growth gives Moon-mass embryos by ~1 Myr. */
export const EMBRYOS_AFTER = 1e6;

/** Notes turn from gas dispersal to merging versus shattering collisions here (~20 Myr). */
export const BELT_STIRRED_AFTER = 2e7;

/**
 * The Moon-forming impact is narrated from here, 57 Myr after the first solids (4.51 Gyr ago,
 * Barboni et al. 2017); estimates run as late as 4.35 Gyr ago (Borg et al. 2011).
 */
export const MOON_IMPACT_AFTER = 5.7e7;
/** The latest estimate of the Moon-forming impact, years ago (Borg et al. 2011). */
export const MOON_IMPACT_LATEST = 4.35e9;

/** Classic Late Heavy Bombardment date from Apollo impact-melt ages, ~3.9 Gyr ago. */
export const LHB_CLASSIC = 3.9e9;

/** Bright stars' proper motions scramble the constellations within ~10⁵ years. */
export const NAMED_STARS_FADE = 1e5;

/** The timeline's oldest moment. */
export const OLDEST = 10e9;

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

/* Milestones since the clearing, years ago, as the slider's stations place them. */
/** Earth's crust, from the Jack Hills zircons (Valley et al. 2014). */
export const EARTH_CRUST = 4.4e9;
/** The last lavas Mars's dynamo magnetised (Mittelholz et al. 2020). */
export const MARS_DYNAMO_LAST = 3.7e9;
/** The Hesperian–Amazonian boundary, middle of its 2.9–3.3 Gyr window (Hartmann & Neukum 2001). */
export const MARS_DRY = 3.1e9;
/** The Vredefort impact (Kamo et al. 1996). */
export const VREDEFORT = 2.02e9;
/** The Moon's youngest dated lavas, Chang'e 5 (Li et al. 2021). */
export const MOON_LAST_LAVA = 2.03e9;
/** Saturn's rings' exposure age, years (Kempf et al. 2023). */
export const SATURN_RINGS_AGE: readonly [number, number] = [1e8, 4e8];
/** The Chicxulub impact (Renne et al. 2013). */
export const CHICXULUB = 6.604e7;

/** Bright stars' proper motions scramble the constellations within ~10⁵ years. */
export const NAMED_STARS_FADE = 1e5;

/** The timeline's oldest moment. */
export const OLDEST = 10e9;

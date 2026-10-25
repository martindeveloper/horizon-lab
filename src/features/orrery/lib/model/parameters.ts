/**
 * The Orrery's own numbers: the timeline's narrated moments and the sky's eras. The solar
 * system model's live in `@/space/solar-system/model/parameters`.
 */

/** Dust grains have grown into km-size planetesimals ~0.1 Myr after the first solids. */
export const PLANETESIMALS_AFTER = 1e5;

/** Runaway, then oligarchic growth gives Moon-mass embryos by ~1 Myr. */
export const EMBRYOS_AFTER = 1e6;

/** Jupiter's core past ~20 Earth masses within ~1 Myr of the first solids: meteorite isotopes split in two (Kruijer et al. 2017). */
export const JUPITER_CORE_AFTER = 1e6;

/** Mars half-grown 1.8 (+0.9/−1.0) Myr after the first solids, from hafnium–tungsten (Dauphas & Pourmand 2011). */
export const MARS_HALF_AFTER = 1.8e6;

/** Notes turn from gas dispersal to merging versus shattering collisions here (~20 Myr). */
export const BELT_STIRRED_AFTER = 2e7;

/* The Moon-forming impact and Saturn's rings' age are the shared model's: the scene draws both. */
export {
  MOON_IMPACT_AFTER,
  MOON_IMPACT_LATEST,
  SATURN_RINGS_AGE,
} from "@/space/solar-system/model/parameters";

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
/** The Moon's youngest sampled lavas, Chang'e 5 basalts (Li et al. 2021). */
export const MOON_LAST_LAVA = 2.03e9;
/** The Chicxulub impact (Renne et al. 2013). */
export const CHICXULUB = 6.604e7;

/**
 * The main-sequence Sun's brightening, L(t) = L☉ / (1 + 0.4 (1 − t/t☉)): Gough's (1981)
 * interpolation of standard solar models, within a few per cent of them after the first
 * ~0.2 Gyr (Feulner 2012). The young Sun shone at about 70 % of today.
 */
export const YOUNG_SUN_DIMMING = 0.4;
/** The habitable zone's conservative edges today, moist to maximum greenhouse (Kopparapu et al. 2013). */
export const HABITABLE_ZONE_AU: readonly [number, number] = [0.99, 1.7];

/** Bright stars' proper motions scramble the constellations within ~10⁵ years. */
export const NAMED_STARS_FADE = 1e5;

/** The timeline's oldest moment. */
export const OLDEST = 10e9;

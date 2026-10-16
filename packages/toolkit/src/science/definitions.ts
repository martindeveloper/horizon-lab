/**
 * The defining numbers, typed once. Units and constants derive from these, so a
 * pair like G and M☉ can never come from different editions of a catalogue.
 */

/** Speed of light, m s⁻¹ (exact, SI). */
export const SPEED_OF_LIGHT_SI = 299_792_458;
/** Newtonian constant of gravitation, m³ kg⁻¹ s⁻² (CODATA 2022; unchanged from 2018). */
export const GRAVITATIONAL_CONSTANT_SI = 6.6743e-11;
/** Solar gravitational parameter GM☉, m³ s⁻² (IAU 2015 Resolution B3, nominal; measured to ~10⁻¹⁰). */
export const SOLAR_GM_SI = 1.3271244e20;
/** Nominal solar radius, m (IAU 2015 Resolution B3). */
export const SOLAR_RADIUS_SI = 6.957e8;
/** Astronomical unit, m (exact, IAU 2012 Resolution B2). */
export const AU_SI = 149_597_870_700;
/** Julian year, s (exact, IAU). */
export const JULIAN_YEAR_SI = 365.25 * 86_400;

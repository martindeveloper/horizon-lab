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
/** Terrestrial gravitational parameter GM⊕, m³ s⁻² (IAU 2015 Resolution B3, nominal). */
export const EARTH_GM_SI = 3.986004e14;
/** Nominal solar radius, m (IAU 2015 Resolution B3). */
export const SOLAR_RADIUS_SI = 6.957e8;
/** Nominal solar luminosity, W (IAU 2015 Resolution B3). */
export const SOLAR_LUMINOSITY_SI = 3.828e26;
/** Astronomical unit, m (exact, IAU 2012 Resolution B2). */
export const AU_SI = 149_597_870_700;
/** Julian year, s (exact, IAU). */
export const JULIAN_YEAR_SI = 365.25 * 86_400;
/** Planck constant, J s (exact, SI 2019). */
export const PLANCK_CONSTANT_SI = 6.62607015e-34;
/** Boltzmann constant, J K⁻¹ (exact, SI 2019). */
export const BOLTZMANN_CONSTANT_SI = 1.380649e-23;
/** Elementary charge, C (exact, SI 2019); also the joules in one electronvolt. */
export const ELEMENTARY_CHARGE_SI = 1.602176634e-19;
/** Electron mass, kg (CODATA 2022). */
export const ELECTRON_MASS_SI = 9.1093837139e-31;
/** Proton mass, kg (CODATA 2022). */
export const PROTON_MASS_SI = 1.67262192595e-27;
/** Atomic mass constant, one twelfth of a ¹²C atom, kg (CODATA 2022). */
export const ATOMIC_MASS_CONSTANT_SI = 1.66053906892e-27;
/** Classical electron radius e² / (4πε₀ mₑ c²), m (CODATA 2022). */
export const CLASSICAL_ELECTRON_RADIUS_SI = 2.8179403205e-15;
/** Rydberg constant R∞, m⁻¹ (CODATA 2022): hydrogen's spectrum for an infinitely heavy nucleus. */
export const RYDBERG_CONSTANT_SI = 10_973_731.568_157;

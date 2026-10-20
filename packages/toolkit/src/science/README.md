# Units, constants and equations

`@horizon/toolkit/science` is the one place a simulation takes a number from:
constants, units, conversions, formulas and their display. Tests check every
value against its definition or source, and the UI prints the same objects, so
math, numbers and copy cannot drift apart. Localized words stay in the host;
symbols follow the SI and the IAU.

## Constants (`constants.ts`)

`CONSTANTS` lists each constant once with its symbol, LaTeX, SI value, unit,
whether it is exact, and its source: `speedOfLight` (exact), `gravitationalConstant`
(CODATA 2022), `astronomicalUnit` (exact, IAU 2012 B2), `parsec` (exactly
648 000/π au, IAU 2015 B2), `lightYear` (c × Julian year), `julianYear`,
`solarMass`, `solarRadius` (IAU 2015 B3 nominal), and for atoms and light
`planckConstant`, `boltzmannConstant`, `elementaryCharge` (exact, SI 2019),
`electronMass`, `atomicMassConstant` and `classicalElectronRadius` (CODATA 2022).
A page can print the table; code uses the named values whose names state their
units (`AU_KM`, `LIGHT_YEAR_KM`, `SOLAR_MASS_KG`, `SOLAR_RADIUS_KM`,
`JULIAN_YEAR_SECONDS`, `SPEED_OF_LIGHT` in m s⁻¹, `GRAVITATIONAL_CONSTANT` in SI,
`PLANCK_CONSTANT`, `BOLTZMANN_CONSTANT`, `ELECTRON_VOLT_J`, `ELECTRON_MASS_KG`,
`ATOMIC_MASS_KG`, `CLASSICAL_ELECTRON_RADIUS_M`). `RAD_PER_DEG` (π/180) is
the one degree-to-radian factor; do not retype it.

## Units and measures (`units.ts`, `measure.ts`)

`UNITS` defines lengths (Å, nm, m, km, R☉, au, ly, Mly, pc, kpc, Mpc), times (s … Gyr,
Julian century), angles (rad, °, ′, ″, mas), masses (kg, M☉, M⊕), rates (s⁻¹, km/s/Mpc for H₀), speeds (m/s, km/s,
c), K and energies (J, eV), each as a factor to its SI base. `convert(value, from, to)` refuses to
mix dimensions.

```ts
measure(5.2, "au").in("km"); // 7.78e8
measure(3.1e16, "m").best(["au", "ly", "pc"]); // ≈ 1.00 pc
measure(5.37, "au").to("ly").toString(); // "8.49 × 10⁻⁵ ly"
measure(4.24, "ly").format({ locale: "cs", symbols: { ly: "sv. r." } }); // "4,24 sv. r."
```

`readout` chooses about three significant figures (scientific below 0.001 or
from 10⁷); `formatReadout` and `formatNumber` print with cached Intl formatters,
because canvas labels redraw every frame. `formatSignificant` prints a literature
value to a chosen number of significant figures ("18,000", "5 × 10¹⁶", "10¹⁷").

## Equations (`equation.ts`, `laws.ts`)

`defineEquation` writes a formula once: Unicode text for the UI, LaTeX, its
variables with units, and how to compute it.

```ts
keplerThirdLaw.compute({ a: 5.2 }); // 11.86 (yr)
keplerThirdLaw.compute({ a: measure(778.5e6, "km") }); // inputs convert to au
keplerThirdLaw.toString(); // "P² = a³"
keplerThirdLaw.toLatex(); // "P^2 = a^3"
keplerThirdLaw.units(); // "a [au], P [yr]"
keplerThirdLaw.example({ a: 5.2 }); // "a = 5.2 au → P = 11.9 yr"
schwarzschildRadius.measure({ M: measure(1, "Msun") }).in("km"); // 2.95
```

Shared laws: `pythagoras`, `keplerThirdLaw`, `lightTravelTime`,
`schwarzschildRadius`, `parallaxDistance`, `geometricMassTime`, `tangentialVelocity`,
`angularSeparation` (haversine, degrees), `resonanceSemiMajorAxis` (Kepler III for an orbit
of k times a planet's period), `hubbleLaw` (d = v / H₀, in Mpc), and for light `planckLaw`,
`wienDisplacement`, `photonEnergy` (E = hc/λ, nm to eV) and `dopplerShift` (relativistic). A simulation's
own formulas live in its feature (`lib/equations.ts`) and are built the same
way. `Formula` is the print-only view documents use.

## Spectra and colour (`spectra.ts`, `color.ts`)

`planckRadiance(nm, K)` is Planck's law per unit wavelength (W m⁻² sr⁻¹ m⁻¹), with
`SECOND_RADIATION_CONSTANT` (hc/k), `WIEN_CONSTANT` (b, from h, c and k) and `HC_EV_NM`
(1239.84 eV nm). `dopplerFactor(km/s)` is λ/λ₀ for a receding source; `vacuumToAir(nm)`, its inverse
`airToVacuum(nm)` and `airIndex` follow the IAU convention (Morton 2000) for the air
wavelengths spectroscopists quote. Photon energies and line physics use vacuum wavelengths.

`cieObserver(nm)` is the CIE 1931 2° observer (the CIE's 5 nm table, interpolated);
`spectrumXyz` integrates a spectrum against it, `chromaticity` gives (x, y), and
`displayColor` turns XYZ into sRGB at full brightness, clipping primaries a screen cannot
make. `blackbodyColor(K)` and `wavelengthColor(nm)` are the usual two; `cssRgb` prints one.
Each takes an optional `Gamut`: `p3` computes the colour in Display P3 instead
(`xyzToLinearP3`), where spectral hues clip far less; `cssColor(rgb, alpha, gamut)` prints it
as `color(display-p3 …)` for a P3 canvas or page.

## Elements (`elements.ts`)

`PERIODIC_TABLE` holds all 118 elements, hydrogen to oganesson, keyed by symbol: atomic number,
symbol, English name (IUPAC spelling), period, group, block, and either a weight or a mass
number. `ELEMENT_SYMBOLS` lists them in order of Z, `ElementSymbol` is their type and
`isElementSymbol` checks a string. Names are English for code; hosts translate what they show.
A simulation adds its own facts about an element (abundances, spectra) in its feature.

- **Weights.** `atomicWeight` is IUPAC's abridged standard atomic weight (CIAAW: Atomic Weights
  2021 with the 2024 revisions of Zr, Gd and Lu), five significant figures where nature allows;
  where the weight varies with the source (H, Li, B, C, N, O, Mg, Si, S, Cl, Ar, Br, Tl, Pb) it
  is CIAAW's single abridged value.
- **No standard weight.** Elements with no stable isotopes and no characteristic composition on
  Earth (Tc, Pm, Po–Ac, Np–Og; `UnweighedSymbol`) have `atomicWeight: null` and `massNumber`,
  the mass number of their longest-lived known isotope (CIAAW's list, from NUBASE2020; where it
  names several, the longest recommended half-life, so Tc is 97, not the often printed 98).
  Th, Pa and U do have standard weights. Everyone else has `massNumber: null`.
- **Types.** `ChemicalElement` (with a weight) and `UnweighedElement` (with a mass number) make
  up `PeriodicElement`; `atomicWeight !== null` narrows. `PERIODIC_TABLE.Fe` is typed as a
  `ChemicalElement`, `PERIODIC_TABLE.Tc` as an `UnweighedElement`.
- **Groups.** IUPAC numbering, 1–18, with group 3 as Sc, Y, Lu, Lr. The f block is La–Yb and
  Ac–No (fourteen columns each, `block: "f"`) and has no group number (`group: null`).

`node scripts/fetch-elements.mjs` regenerates the data from CIAAW and cross-checks it against
NIST (`--check` reports a stale file); run `npm run format` after it.

## Distances (`distance.ts`)

`DistanceUnit` is `au` | `ly` | `pc`; `DistanceChoice` adds `auto`, which reads each distance
in au below half a light-year and in ly beyond (`autoDistanceUnit`, `resolveDistanceUnit`). `convertDistance`, `lightTime` (s / min /
h / d) and `formatDistance` render the shared readout "5.37 au · light-time
45 min"; the host passes translated unit symbols and the light-time phrase, and
optionally `millionWord` (and `billionWord`) so ly and pc from a million read "53.8
million ly" and from a billion "1.09 billion ly", and
`significant` to keep a rounded literature value rounded after conversion ("60,000 ly"
reads "18,000 pc"). `formatDistanceRange` prints a span with the unit once ("2.1–3.3 au").
`AU_LIGHT_SECONDS`, `LIGHT_YEAR_AU`, `PARSEC_AU` and `PARSEC_KM` derive from the
exact definitions.

## Cosmology (`cosmology.ts`)

`FlatLcdm` is H₀ (km/s/Mpc), Ωm and optionally Ωr of a flat ΛCDM universe; `PLANCK_2018`
holds the Planck 2018 VI values (H₀ 67.66, Ωm 0.3111, radiation included). Every function
takes the model as an optional argument, so a lab can print its own formula and compute
with these. `hubbleTimeGyr(H0)`; `cosmicAgeGyr(a)` and its inverse `scaleFactorAtAge(ageGyr)`
are the closed forms for matter and Λ alone (13.79 Gyr today, about 5.6 million years older
than with radiation).
`comovingDistanceMpc(z)` integrates (c / H₀) ∫ da / (a² E(a)) over √a, so it holds back to
the Big Bang (3.40 Gpc at z = 1, Planck's 13.88 Gpc at last scattering);
`particleHorizonMpc()` is the edge of the observable universe (~14.2 Gpc), and
`redshiftAtComovingDistance(mpc)` inverts the distance (Infinity at the horizon).
`cosmicAgeAtRedshiftGyr(z)` gives the age then (13.787 Gyr today, Planck's value; ~372,000
years at the microwave background), and `lookbackTimeGyr(z)` and its inverse
`redshiftAtLookback(gyr)` say how long ago light from redshift z set out. These integrate
with radiation when the model has it.

## Time (`time.ts`)

`julianDay(date)` gives the Julian Date of an instant and `J2000_JD` the
J2000.0 epoch (2 451 545.0), so `julianDay(date) − J2000_JD` is days from J2000
(`JULIAN_CENTURY_DAYS` = 36 525 per century). Dates are taken as UTC; the ~69 s
TT − UTC offset is below what most simulations resolve. Series in TT (the Sun
and the Moon) take `julianEphemerisDay(date)`, which adds `DELTA_T_SECONDS` (69).

## Sky coordinates (`sky.ts`)

Positional astronomy for an observer on Earth, after Meeus (Astronomical
Algorithms, 2nd ed.), in degrees with azimuth from north through east:
`siderealTime(date, longitude)` (local mean, eq. 12.4), `precess(ra, dec, date)`
from J2000 (ch. 21), `eclipticToEquatorial(λ, β, ε)`, `toHorizontal(ra, dec, lst,
latitude)`, `hourAngle(lst, ra)` (−180…180, negative while rising) and
`risingHourAngle(dec, latitude, horizon)` (half the arc above an altitude; 0 never
rises, 180 never sets). `equatorialToGalactic(ra, dec)` turns J2000 coordinates into
galactic longitude and latitude (IAU pole). No nutation, aberration or refraction. The Sun's and the
Moon's own positions are in `@horizon/toolkit/bodies` (almanac).

## Catalogued facts (`facts.ts`)

A fact is one figure a card prints, once: a `value` (with an optional published
`range`) or only a published `range`, a `Unit` of the kit (or `count`,
`percent`, `ratio`), a `source` id of the caller's bibliography and a `Status`
(`verified`, `derived`, `teaching-choice`, `flag`). `digits` fixes its
significant figures; `show` names the unit its message words (years as "Gyr").

`printFact(fact, value, format)` prints a figure through `formatDistance` for
lengths, in the visitor's unit, at least two significant figures. Other units
print as plain numbers in the `show` unit, with "million" and "billion" as words
from `format` and scientific notation from 10¹². `live` values print at the
readout's precision. `printFactSpan` prints a range with the unit once.
`quoteFact(locale, fact)` gives the bare number prose quotes.

## Display scales (`quantities.ts`)

- `scaleMagnitude`: a value, decimal digits and optional thousand/million/billion key.
- `lengthQuantity`: kilometres to km, au or ly.
- `durationQuantity`: seconds to ns through Julian years.

These use absolute magnitude to choose a unit and preserve the sign. Everything
rejects NaN and infinities. `digits` is display precision, not measurement
accuracy. Plural unit words and other prose are translated by the host.

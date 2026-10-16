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
`solarMass`, `solarRadius` (IAU 2015 B3 nominal). A page can print the table;
code uses the named values whose names state their units (`AU_KM`,
`LIGHT_YEAR_KM`, `SOLAR_MASS_KG`, `SOLAR_RADIUS_KM`, `JULIAN_YEAR_SECONDS`,
`SPEED_OF_LIGHT` in m s⁻¹, `GRAVITATIONAL_CONSTANT` in SI).

## Units and measures (`units.ts`, `measure.ts`)

`UNITS` defines lengths (m, km, R☉, au, ly, pc, kpc, Mpc), times (s … Gyr,
Julian century), angles (rad, °, ′, ″, mas), masses (kg, M☉), speeds (m/s, km/s,
c) and K, each as a factor to its SI base. `convert(value, from, to)` refuses to
mix dimensions.

```ts
measure(5.2, "au").in("km"); // 7.78e8
measure(3.1e16, "m").best(["au", "ly", "pc"]); // ≈ 1.00 pc
measure(5.37, "au").to("ly").toString(); // "8.49 × 10⁻⁵ ly"
measure(4.24, "ly").format({ locale: "cs", symbols: { ly: "sv. r." } }); // "4,24 sv. r."
```

`readout` chooses about three significant figures (scientific below 0.001 or
from 10⁷); `formatReadout` and `formatNumber` print with cached Intl formatters,
because canvas labels redraw every frame.

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
`schwarzschildRadius`, `parallaxDistance`, `geometricMassTime`. A simulation's
own formulas live in its feature (`lib/equations.ts`) and are built the same
way. `Formula` is the print-only view documents use.

## Distances (`distance.ts`)

`DistanceUnit` is `au` | `ly` | `pc`. `convertDistance`, `lightTime` (s / min /
h / d) and `formatDistance` render the shared readout "5.37 au · light-time
45 min"; the host passes translated unit symbols and the light-time phrase.
`AU_LIGHT_SECONDS`, `LIGHT_YEAR_AU`, `PARSEC_AU` and `PARSEC_KM` derive from the
exact definitions.

## Time (`time.ts`)

`julianDay(date)` gives the Julian Date of an instant and `J2000_JD` the
J2000.0 epoch (2 451 545.0), so `julianDay(date) − J2000_JD` is days from J2000.
Dates are taken as UTC; the ~69 s TT − UTC offset is below what the
simulations resolve.

## Display scales (`quantities.ts`)

- `scaleMagnitude`: a value, decimal digits and optional thousand/million/billion key.
- `lengthQuantity`: kilometres to km, au or ly.
- `durationQuantity`: seconds to ns through Julian years.

These use absolute magnitude to choose a unit and preserve the sign. Everything
rejects NaN and infinities. `digits` is display precision, not measurement
accuracy. Plural unit words and other prose are translated by the host.

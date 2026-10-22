# Solar System bodies

`@horizon/toolkit/bodies` is the shared catalogue of the Sun, planets, major
moons and a few named small bodies: where they are, how big and what shape,
which way their poles point and how fast they turn. It has no runtime
dependencies: no three.js, no DOM, no React. Vectors are plain
`[x, y, z]` arrays and rotations `[x, y, z, w]` quaternion components, so a
lab can feed them to any renderer (`new Quaternion().fromArray(q)` in three.js).

Names, descriptions and other prose belong to the host's messages, keyed by
the IDs here. Every number names its source next to it.

## Frame (`frames.ts`)

All positions and axes use one scene frame: X toward the vernal equinox,
Y = ecliptic north (up), Z = −y of the right-handed J2000 ecliptic frame.
`equatorialToScene(ra, dec)` and `equatorialFrameToScene(x, y, z)` rotate ICRF
equatorial coordinates into it (J2000 mean obliquity). `quaternionFromBasis`
and `turnAboutY` match three.js's `setFromRotationMatrix` and an axis-angle
multiply.

## IDs

`PlanetId`, `NamedId` (`pluto`, `sedna`, `halley`), `MoonId` and `BodyId`
(all of them plus `sun`). `SpinningId` is every body with an IAU spin model;
moons turn synchronously instead. `PLANET_IDS`, `MOON_IDS`, `GIANTS`.

## Orbits (`kepler.ts`, `ephemeris.ts`, `moons.ts`)

- `ORBIT_EQUATIONS`: the secular-element, ω, M, Kepler's equation and perifocal
  formulas, built with `defineEquation` from `@horizon/toolkit/science`, so a
  lab computes with them and prints the same objects.
- `jplElements(id, T, driftYears?, out?)`: JPL approximate elements (Standish &
  Williams, 1800–2050) for the planets, plus Pluto's row from the table's
  withdrawn earlier edition, `T` in Julian centuries from J2000
  (`centuriesSinceJ2000(date)`). `driftYears` moves the body on along that
  orbit (its mean longitude only), so a sped-up clock never runs the secular
  rates outside their fit. `out` takes the result without allocating, for a
  scene that asks every frame.
- `NAMED`: Pluto, Sedna and Halley with `elementsAt(date, extraYears)`, which
  likewise only advance each body along its orbit.
- `keplerPosition(elements)` gives a heliocentric position in au;
  `writeOrbit` / `createOrbitWriter` fill a flat XYZ buffer with the ellipse
  (the writer skips work when only M changed, or the shape moved by less than a
  float32 vertex can show, as the planets' secular drift does frame to frame). `eccentricAnomaly`, `periodYears`.
- `MOONS`: JPL mean elements per moon with its host, reference plane and
  precession periods, and the resonant librations of Mimas, Tethys, Enceladus
  and Miranda; `meanRates(moon)`, `libration(moon, d)` and `meanLongitude(id, date)`.
  Positions from them are left to the lab for now.
- `lunar-theory.ts`: the Moon's geocentric place from the truncated ELP-2000/82 theory
  (Meeus ch. 47; about 10″ and 4 km): `lunarPosition(jde)` in the ecliptic of date,
  `lunarPositionJ2000(date, out)` as J2000 ecliptic km for a scene with fixed axes.

## Sun and Moon in the sky (`almanac.ts`)

The series a sky view needs, from the Julian Ephemeris Day (`julianEphemerisDay`
in the science module); the Moon's place is `lunarPosition` (below):

- `solarEcliptic(jde)`: the Sun's apparent longitude, distance (au) and the mean
  obliquity of the date (Astronomical Almanac, good 1950–2050).
- `moonPhase(jde)`: illuminated fraction and waxing (Meeus ch. 48);
  `moonAxis(jde)`: position angle of its axis east of celestial north (ch. 53,
  within 0.2°).
- `EARTH_EQUATORIAL_RADIUS_KM` (6378.1366, IAU 2015; Meeus' 6378.14 differs by
  under 1e-6° in lunar parallax) is the `FIGURES.earth` value, and
  `LUNAR_EQUATOR_INCLINATION_DEG` (1.54242°) is the Moon's `cassini` tilt.

The module imports only the science entry, never the planet tables, so a page
that draws the sky (Horizon's header) does not load the orrery's catalogue. The
Meeus-specific coefficients (the series, the Almanac obliquity, the Moon's
mean distance 385 000.56 km) stay in their functions.

## Figures, masses, spin and rings (`figures.ts`, `masses.ts`, `rings.ts`)

- `FIGURES`: mean, equatorial and polar radii (IAU WGCCRE 2015); `flattening(id)`.
- `GM_KM3_S2` (`masses.ts`): gravitational parameters, km³ s⁻², for every body but Sedna and
  Halley (`MassiveId`): the IAU 2015 nominal Sun, Earth and Jupiter, DE440 and the JPL
  satellite ephemerides for the rest, each planet without its moons.
- `SPINS`: pole α₀, δ₀ at T and prime meridian W at d days. `poleVector(id, T)`
  is the pole in the scene frame; `bodyOrientation(id, date)` orients a unit
  sphere whose texture longitude 0 starts at local −X and whose +Y is north.
  `siderealHours(id)` is the rotation period the spin model turns a body by (negative:
  retrograde).
- `RINGS`: Saturn, Uranus and Neptune as radial zones of optical depth, colour
  and dust fraction; `ringStrip(system, texels)` bakes them into a float strip
  (opacity, opacity-weighted colour and dust), and `ringStripLevels` adds its
  mipmap chain.

## Measured maps (`maps.ts`)

Source link destinations are shared with the app and asset scripts through
`@horizon/toolkit/urls`; map metadata keeps the same resolved URL strings.

`MAPS` lists the bodies with a measured map: folder version, tier widths, the far tier's mean
colour (a placeholder while the map streams in), source, credit, licence and link. The host decides where the files live and passes that base:

```ts
tierFile("/textures/bodies", "earth", "near"); // "/textures/bodies/earth/v1/earth-near.webp"
```

Each body is versioned on its own. A rebuilt map bumps its `version`, so a published file is never overwritten.

`tierFile` returns `null` for a body without a map and shares one file between
tiers of equal width. Loading and texturing stay in the host.

The Sun entry is a representative SDO/HMI continuum mosaic from May 2024,
not a simultaneous global measurement or a live surface. Its normalized
intensity is emissive, so geometric-albedo checks do not apply. The host
removes the source display colour and limb profile during preprocessing and
applies view-dependent limb darkening at render time. The painted Sun is a
uniform neutral fallback while the observation map loads.

The Moon, Phobos, Deimos, Io, Europa, Ganymede, Callisto, Saturn's six mid-size
moons, Triton and Charon have spacecraft mosaics. The host ships one tier for each (512 pixels for the two
small Martian moons, 1024 for the rest), with plain missing-data
fill. Some sources are monochrome or enhanced multispectral colour; metadata
and the host's credits document these limits. Venus, Titan, Sedna, Halley and
Uranus's five moons retain illustrative maps. Fallback
painters remain available if an asset fails.

## Painted surfaces (`@horizon/toolkit/bodies/surfaces`)

A separate entry point, because the painters are large and only a renderer
needs them. `surfaceMap(id, w, h)` paints an equirectangular RGBA map (north
first); `surfaceJob(id, w, h)` paints the same map a few rows at a time, in GL
row order. Mean brightness follows `GEOMETRIC_ALBEDO`. Pure functions, so tests
run them without a canvas.

`surfaces/raster.ts` holds the surface point, noise, polygon coverage and row
rasteriser; `earth.ts`, `planets.ts`, `giants.ts` and `moons.ts` hold the
painters and their mapped features; `index.ts` registers them by body ID. The
colour helpers the painters share are public too: `mix(a, b, t)` blends two
`Rgb` triples and `scale(c, k)` multiplies one.

## Consumers and tests

The shared solar system (`src/space/solar-system/graphics/moons.ts`) keeps the three.js
moon adapters; the orrery (`src/features/orrery`) keeps its materials and shaders, and the
WebP map loader is `@horizon/toolkit/scene`.
The shell's header sky and the catalogue hero (`src/space/observer-sky.ts`)
keep the observer, the star list and the drawn bearings, built on the almanac.
`tests/bodies.test.mjs`, `tests/astronomy.test.mjs`, `tests/sky.test.mjs` and
`tests/maps.test.mjs` check these values against IAU, JPL Horizons and published
examples.

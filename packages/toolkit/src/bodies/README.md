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
- `jplElements(id, T)`: JPL approximate elements (Standish & Williams,
  1800–2050) for the planets, plus Pluto's row from the table's withdrawn
  earlier edition, `T` in Julian centuries from J2000
  (`centuriesSinceJ2000(date)`).
- `NAMED`: Pluto, Sedna and Halley with `elementsAt(date, extraYears)`.
- `keplerPosition(elements)` gives a heliocentric position in au;
  `writeOrbit` / `createOrbitWriter` fill a flat XYZ buffer with the ellipse
  (the writer skips work when only M changed). `eccentricAnomaly`, `periodYears`.
- `MOONS`: JPL mean elements per moon with its host, reference plane and
  precession periods; `meanRates(moon)` and `meanLongitude(id, date)`.
  Positions from them are left to the lab for now.

## Figures, spin and rings (`figures.ts`, `rings.ts`)

- `FIGURES`: mean, equatorial and polar radii (IAU WGCCRE 2015); `flattening(id)`.
- `SPINS`: pole α₀, δ₀ at T and prime meridian W at d days. `poleVector(id, T)`
  is the pole in the scene frame; `bodyOrientation(id, date)` orients a unit
  sphere whose texture longitude 0 starts at local −X and whose +Y is north.
- `RINGS`: Saturn, Uranus and Neptune as radial zones of optical depth and
  colour; `ringStrip(system, texels)` bakes them into an RGBA strip.

## Measured maps (`maps.ts`)

`MAPS` lists the bodies with a measured map: tier widths, source, credit,
licence and link. The host decides where the files live and passes that base:

```ts
tierFile("/textures/orrery", "earth", "near"); // "/textures/orrery/earth-near.webp"
```

`tierFile` returns `null` for a body without a map and shares one file between
tiers of equal width. Loading and texturing stay in the host.

The Sun entry is a representative SDO/HMI continuum mosaic from May 2024,
not a simultaneous global measurement or a live surface. Its normalized
intensity is emissive, so geometric-albedo checks do not apply. The host
removes the source display colour and limb profile during preprocessing and
applies view-dependent limb darkening at render time. The painted Sun is a
uniform neutral fallback while the observation map loads.

## Painted surfaces (`@horizon/toolkit/bodies/surfaces`)

A separate entry point, because the painters are large and only a renderer
needs them. `surfaceMap(id, w, h)` paints an equirectangular RGBA map (north
first); `surfaceJob(id, w, h)` paints the same map a few rows at a time, in GL
row order. Mean brightness follows `GEOMETRIC_ALBEDO`. Pure functions, so tests
run them without a canvas.

`surfaces/raster.ts` holds the surface point, noise, polygon coverage and row
rasteriser; `earth.ts`, `planets.ts`, `giants.ts` and `moons.ts` hold the
painters and their mapped features; `index.ts` registers them by body ID.

## Consumers and tests

The orrery (`src/features/orrery`) keeps the three.js adapters
(`lib/coordinates.ts`, `lib/moons.ts`), materials, shaders and map loading.
`tests/bodies.test.mjs`, `tests/astronomy.test.mjs` and `tests/maps.test.mjs`
check these values against IAU, JPL Horizons and published examples.

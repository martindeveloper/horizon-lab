# Orrery surface maps

Built by `scripts/build-planet-maps.mjs` from the sources below, which
`MAPS` in `packages/toolkit/src/bodies/maps.ts` also lists. Changes made to every map: reprojection
to east longitude 0° at the left edge (parametric latitude on the giants),
resampling, and WebP compression. Map-specific changes are listed under each map.

## Hubble OPAL: Jupiter, Saturn, Uranus, Neptune (CC BY 4.0)

Outer Planet Atmospheres Legacy (OPAL) global maps, DOI
[10.17909/T9G593](https://dx.doi.org/10.17909/T9G593), © NASA, ESA, A.A. Simon and
M.H. Wong, licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
This work used data acquired from the NASA/ESA Hubble Space Telescope, associated
with the OPAL program (PI: Simon, GO13937), and archived by the Space Telescope
Science Institute. References: Simon et al. 2015, ApJ 812, 55; Wong et al. 2020,
ApJS 247, 58.

- Jupiter: Cycle 32, 11 December 2025 (F631N, F502N, F467M).
- Saturn: Cycle 32, 29 August 2025 (F631N, F502N, F467M).
- Uranus: Cycle 33, 23 October 2025 (F657N, F547M, F467M).
- Neptune: Cycle 32, 24 August 2025 (F657N, F547M, F467M).

Changes: the three filters (in I/F) form red, green and blue. Each map's disc-mean
colour is set to the published true colour (Irwin et al. 2024 for Uranus and
Neptune). Areas without data (night sides, Saturn's equator behind its rings, the
limb) are filled with Horizon's painted maps.

## NASA and USGS (public domain)

- Earth: Blue Marble Next Generation, October 2004, topography and bathymetry,
  with the Blue Marble cloud layer. NASA Earth Observatory (Reto Stöckli).
  <https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/>
- Mars: Viking Orbiter global colour mosaic, 925 m per pixel. NASA, USGS
  Astrogeology Science Center. Mean colour set to Hubble true colour.
  <https://astrogeology.usgs.gov/search/map/mars_viking_global_color_mosaic_925m>
- Mercury: MESSENGER MDIS basemap 3-colour global mosaic, 665 m per pixel. NASA,
  Johns Hopkins University Applied Physics Laboratory, Carnegie Institution of
  Washington; USGS Astrogeology. Brightness only, in Mercury's true colour.
  <https://astrogeology.usgs.gov/search/map/mercury_messenger_mdis_basemap_md3_color_global_mosaic_665m>
- Pluto: New Horizons global mosaic, July 2017, 300 m per pixel. NASA, Johns
  Hopkins University Applied Physics Laboratory, Southwest Research Institute,
  Lunar and Planetary Institute; USGS Astrogeology. Brightness only, tinted by
  brightness (tholin red to nitrogen-ice cream); unimaged areas are painted.
  <https://www.usgs.gov/media/images/pluto-global-mosaic-new-horizons-july-2017>

NASA and USGS imagery is not copyrighted; credit is given as the agencies request.
Use does not imply endorsement by NASA, ESA or USGS.

## Sun: NASA SDO/HMI (public domain)

Courtesy of NASA/SDO and the AIA, EVE, and HMI science teams.

[SDO copyright permissions](https://sdo.gsfc.nasa.gov/gallery/copyright/):
SDO images and movies are not copyrighted unless explicitly noted. These
HMI browse images carry no separate copyright restriction. Educational and
informational reuse is encouraged with the credit above. This derived visual
mosaic is produced by Horizon, not an official NASA global map. No endorsement
is implied.

Source: HMI flattened continuum intensity quicklook images (HMIIF), 4096 × 4096,
from 1, 8, 15 and 22 May 2024, all at 00:00:00 UTC:

- <https://sdo.gsfc.nasa.gov/assets/img/browse/2024/05/01/20240501_000000_4096_HMIIF.jpg>
- <https://sdo.gsfc.nasa.gov/assets/img/browse/2024/05/08/20240508_000000_4096_HMIIF.jpg>
- <https://sdo.gsfc.nasa.gov/assets/img/browse/2024/05/15/20240515_000000_4096_HMIIF.jpg>
- <https://sdo.gsfc.nasa.gov/assets/img/browse/2024/05/22/20240522_000000_4096_HMIIF.jpg>

Build: `node --import tsx scripts/build-sun-map.mjs [cache-dir]` (also included
in `scripts/build-planet-maps.mjs`). Source URLs, UTC times and SHA-256 hashes
are pinned in `scripts/lib/sun-map.mjs`; cached and downloaded bytes are checked.
Files are shipped locally; the application makes no live NASA requests.

Processing and limits:

- The colourized browse palette is converted to monochrome display luminance.
  A robust median radial profile normalizes quiet-Sun brightness, removing any
  remaining limb shading. These are visualization products, not calibrated
  intensity data for quantitative solar analysis.
- Disc centres and radii are measured from the source images. North-up discs
  are projected onto the globe's east-longitude, north-up equirectangular frame
  using the IAU solar pole/rotation and the Earth viewing direction at each
  observation (including approximate light travel time and perspective).
  Earth's centre approximates SDO's viewpoint; this is not precision astrometry.
- Four dates supply complementary longitudes, rather than mirroring or repeating
  one photograph on the far side. Overlaps favour disc-centre observations;
  heavily foreshortened limb data are excluded. Solar features evolve between
  dates, so the mosaic is representative of one rotation, not one instant.
  It does not represent today's sunspots or the simulation timeline date.
- Poorly constrained latitudes fade to a uniform quiet photosphere between
  65° and 82° in either hemisphere. No sunspots are invented in missing coverage.
- Quiet intensity is stored at 0.8 in linear light, encoded as sRGB to retain
  headroom for bright detail. The emissive shader restores this normalization,
  applies a near-white tint and applies limb darkening once for the current view.
- WebP tiers: 1024 × 512 for the map, 2048 × 1024 for lighter close-ups, and
  8192 × 4096 for full close-ups. Resampling does not add observational detail.

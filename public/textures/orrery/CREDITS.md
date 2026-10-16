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

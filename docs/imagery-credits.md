# Orrery surface maps

Built by `scripts/build-planet-maps.mjs` from the sources below, which
`MAPS` in `packages/toolkit/src/bodies/maps.ts` also lists. Changes made to every map: reprojection
to east longitude 0° at the left edge (parametric latitude on the giants),
resampling, and WebP compression. Map-specific changes are listed under each map.

## Hubble OPAL: Jupiter, Saturn, Uranus, Neptune (CC BY 4.0)

Outer Planet Atmospheres Legacy (OPAL) global maps, DOI
[10.17909/T9G593](https://dx.doi.org/10.17909/T9G593), © NASA, ESA, A.A. Simon and
M.H. Wong, licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
This work used data acquired from the NASA/ESA HST Space Telescope, associated with OPAL program (PI: Simon, GO13937), and archived by the Space Telescope Science Institute, which is operated by the Association of Universities for Research in Astronomy, Inc., under NASA contract NAS 5-26555. All maps are available at http://dx.doi.org/10.17909/T9G593. References: Simon et al. 2015, ApJ 812, 55; Wong et al. 2020,
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
- Earth once its oceans are gone (Afterglow), a model: the same Blue Marble Next
  Generation topography and bathymetry without clouds, the ocean basins shown as
  bare seabed shaded by their depth, vegetation as bare soil and the ice sheets as
  rock. NASA Earth Observatory (Reto Stöckli).
  <https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/>
- Mars: Viking Orbiter global colour mosaic, 925 m per pixel. NASA, USGS
  Astrogeology Science Center. Mean colour set to Hubble true colour.
  <https://astrogeology.usgs.gov/search/map/mars_viking_global_color_mosaic_925m>
- Mercury: MESSENGER MDIS basemap 3-colour global mosaic, 665 m per pixel. NASA,
  Johns Hopkins University Applied Physics Laboratory, Carnegie Institution of
  Washington; USGS Astrogeology. Brightness only, in Mercury's true colour.
  <https://astrogeology.usgs.gov/search/map/mercury_messenger_mdis_basemap_md3_color_global_mosaic_665m>
- Ceres: Dawn Framing Camera global mosaic, survey orbit, October 2015, 400 m per
  pixel (DLR). NASA/JPL-Caltech/UCLA/MPS/DLR/IDA; USGS Astrogeology. Brightness
  only, in Ceres's near-neutral grey; the unlit south pole is painted.
  <https://astrogeology.usgs.gov/search/map/ceres_dawn_fc_global_mosaic_400m>
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

Sun Lab close-ups retain this photograph's morphology. Rebuild their appearance
stencil with `node --import tsx scripts/build-sun-spot-stencil.mjs` after pulling
the CDN mirror; it writes a new `textures/bodies/sun/spots/v<version>/` folder to upload. The generator pins the exact published `sun/v2/sun-near.webp`
SHA-256, rather than resynthesizing spots from NOAA group centres.

- Hysteresis selects dark connected components, retaining their irregular outlines,
  pores and light bridges. The thresholds (0.88 penumbral boundary, 0.8 seed and
  0.45 umbral boundary relative to quiet display intensity) are visual segmentation
  choices for this processed image, not physical classifications or thermometry.
- A sparse atlas preserves the source sampling: R holds linear continuum, G/B
  hold signed distances to the outer and umbral contours. Distances are in source
  pixels, **not depth**. Fractional contour positions allow smooth interpolation.
  A nearest-filtered page table and padded atlas tiles avoid seams and keep GPU
  memory small. Both PNGs are linear data, without sRGB decoding or atlas mipmaps.
- The distant image stays visible at every zoom. Close up, the atlas supplies the
  same spots at the finest source resolution; contour gradients orient illustrative
  filaments and umbral masks confine locally appearing and fading dots. Ordinary
  granulation is suppressed inside the masks. These added details are synthetic;
  neither higher-resolution observations, surface heights nor magnetic vectors
  have been recovered from the photograph. Other passbands and the magnetic model
  remain schematic. If the stencil is unavailable, the photograph remains visible.

## Observed moon maps (public domain)

- **Moon**: [LRO/LROC CGI Moon Kit (2025), laser-albedo polar fill](https://svs.gsfc.nasa.gov/4720/). Credit: NASA’s Scientific Visualization Studio; NASA/LRO/LROC, Arizona State University. [Original raster](https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_16bit_srgb_4k.tif).
- **Io**: [Galileo SSI / Voyager merged mosaic, muted enhanced colour; interpolated poles](https://astrogeology.usgs.gov/search/map/io_galileo_ssi_global_color_merge_mosaic_1km). Credit: NASA/JPL; USGS Astrogeology. [Original raster](https://planetarymaps.usgs.gov/mosaic/Io_Galileo_SSI_Global_Mosaic_ClrMerge_1km.tif).
- **Europa**: [Voyager / Galileo SSI mosaic, monochrome; plain south-polar fill](https://astrogeology.usgs.gov/search/map/europa_voyager_galileo_ssi_global_mosaic_500m). Credit: NASA/JPL; USGS Astrogeology. [Original raster](https://planetarymaps.usgs.gov/mosaic/Europa_Voyager_GalileoSSI_global_mosaic_500m.tif).
- **Ganymede**: [Voyager / Galileo SSI mosaic, muted multispectral colour; monochrome poles](https://astrogeology.usgs.gov/search/map/ganymede_voyager_galileo_ssi_color_global_mosaic_1_4km). Credit: NASA/JPL; USGS Astrogeology. [Original raster](https://planetarymaps.usgs.gov/mosaic/Ganymede_Voyager_GalileoSSI_Global_ClrMosaic_1435m.tif).
- **Callisto**: [Voyager / Galileo SSI mosaic, monochrome](https://astrogeology.usgs.gov/search/map/callisto_galileo_voyager_global_mosaic_1km). Credit: NASA/JPL; USGS Astrogeology. [Original raster](https://planetarymaps.usgs.gov/mosaic/Callisto_Voyager_GalileoSSI_global_mosaic_1km.tif).
- **Triton**: [Voyager 2 mosaic, muted synthetic colour; plain unobserved-area fill](https://astrogeology.usgs.gov/search/map/triton_voyager_2_global_color_mosaic_600m). Credit: NASA/JPL; USGS Astrogeology. [Original raster](https://planetarymaps.usgs.gov/mosaic/Triton_Voyager2_ClrMosaic_GlobalFill_600m.tif).
- **Phobos**: [Viking Orbiter mosaic with Mars Express, MGS and MRO images (DLR control), monochrome](https://astrogeology.usgs.gov/search/map/phobos_viking_global_mosaic_5m). Credit: NASA/JPL; Philip Stooke, University of Western Ontario; USGS Astrogeology. [Original raster](https://planetarymaps.usgs.gov/mosaic/Phobos_Viking_Mosaic_40ppd_DLRcontrol.tif).
- **Deimos**: [Viking Orbiter mosaic with MRO HiRISE detail, monochrome](https://sbn.psi.edu/pds/resource/stookemaps.html) (Stooke small bodies maps V2.0, PDS Small Bodies Node). Credit: NASA/JPL; Philip Stooke, University of Western Ontario, with C. Jongkind and M. Arntz; control by P. Thomas, Cornell. [Original image](https://sbnarchive.psi.edu/pds3/multi_mission/MULTI_SA_MULTI_6_STOOKEMAPS_V2_0/document/m2deimos/deimos_cyl_viking_mro.jpg).
- **Mimas**: [Cassini ISS final atlas mosaic (DLR, 2017), monochrome](https://www.usgs.gov/publications/final-mimas-and-enceladus-atlases-derived-cassini-iss-images). Credit: NASA/JPL/Space Science Institute; DLR (T. Roatsch et al. 2018); USGS Astrogeology. [Original archive](https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/Mimas/Cassini_DLR_Mimas.zip) (`MI_170630_DLR_basemap_degrees.tif`).
- **Enceladus**: [Cassini ISS global mosaic, monochrome](https://astrogeology.usgs.gov/search/map/enceladus_cassini_global_mosaic_110m). Credit: NASA/JPL/Space Science Institute; USGS Astrogeology. [Original raster](https://planetarymaps.usgs.gov/mosaic/Enceladus_Cassini_mosaic_global_110m.tif).
- **Tethys**: [Cassini ISS global mosaic, monochrome](https://astrogeology.usgs.gov/search/map/tethys_cassini_global_mosaic_293m). Credit: NASA/JPL/Space Science Institute; USGS Astrogeology. [Original raster](https://planetarymaps.usgs.gov/mosaic/Tethys_Cassini_mosaic_global_293m.tif).
- **Dione**: [Cassini ISS and Voyager global mosaic, monochrome](https://astrogeology.usgs.gov/search/map/dione_cassini_voyager_global_mosaic_154m). Credit: NASA/JPL/Space Science Institute; USGS Astrogeology. [Original raster](https://planetarymaps.usgs.gov/mosaic/Dione_Cassini_Voyager_mosaic_global_154m.tif).
- **Rhea**: [Cassini ISS and Voyager global mosaic, monochrome](https://astrogeology.usgs.gov/search/map/rhea_cassini_voyager_global_mosaic_417m). Credit: NASA/JPL/Space Science Institute; USGS Astrogeology. [Original raster](https://planetarymaps.usgs.gov/mosaic/Rhea_Cassini_Voyager_mosaic_global_417m.tif).
- **Iapetus**: [Cassini ISS and Voyager global mosaic, monochrome; Cassini Regio's albedo contrast restored](https://astrogeology.usgs.gov/search/map/iapetus_cassini_voyager_global_mosaic_803m). Credit: NASA/JPL/Space Science Institute; USGS Astrogeology. [Original raster](https://planetarymaps.usgs.gov/mosaic/Iapetus_Cassini_Voyager_mosaic_global_783m.tif).
- **Charon**: [New Horizons LORRI / MVIC mosaic, monochrome; plain unobserved-area fill](https://astrogeology.usgs.gov/search/map/charon_new_horizons_lorri_mvic_global_mosaic_300m). Credit: NASA, JHU APL, SwRI, Lunar and Planetary Institute; USGS Astrogeology. [Original raster](https://planetarymaps.usgs.gov/mosaic/Charon_NewHorizons_Global_Mosaic_300m_Jul2017_8bit.tif).

NASA imagery and USGS-produced mosaics are public domain; see
[NASA media guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/)
and [USGS copyright policy](https://www.usgs.gov/faqs/are-usgs-reportspublications-copyrighted).
Source URLs and SHA-256 checksums are pinned in `scripts/lib/moon-maps.mjs`.

Processing and limits:

- The maps ship at 1024 × 512, Phobos and Deimos at 512 × 256 (they are never
  more than a few pixels across), shared between detail tiers because moons have
  no independent close-up view. No external imagery requests at runtime.
- The GeoTIFFs have north-up rows and eastward projected x, regardless of the
  catalogue's positive-west coordinate labels. GeoKey 3088 has central meridian
  0° for Io, Triton and Charon, and 180° for Europa, Ganymede and Callisto.
  The former are rolled half a map; the latter already start at 0° east.
  LROC is centred on 0° and is also rolled. Stooke's Phobos and Deimos maps are
  centred on 0° with east to the right (USGS labels its Phobos copy PositiveEast,
  which puts Stickney at its IAU 49° W) and are rolled too. The Saturnian mosaics start
  at 180° whichever central meridian they record, and are rolled; Herschel, Odysseus,
  Inktomi's rays and Dione's trailing wisps land on their IAU longitudes. No raster is mirrored. Rounded
  source pixel bounds are resampled to the full 360° × 180° spherical extent.
  The scene retains its approximate synchronous moon orientation, not a
  precision libration/IAU moon-attitude ephemeris.
- Source sRGB is decoded to linear light. A smooth bounded brightness response
  sets the area-weighted observed mean to the scene's geometric-albedo scale
  without clipping bright terrain. This is display normalization, not a
  photometric calibration or a quantitative reflectance product.
- Io, Ganymede and Triton include non-visible filters; their chroma is reduced
  to 40% before brightness normalization. This is an illustrative colour
  treatment, **not** a reconstruction of calibrated natural colour.
- Europa, Callisto, Charon, Phobos, Deimos and Saturn's moons remain monochrome. No
  colour terrain is inferred. Phobos and Deimos are irregular; their planetocentric maps are drawn
  on spheres, and Phobos's seams between reverse-lit images carry Stooke's blending.
- Enceladus's albedo is near 1; the brightness response would need to saturate every
  pixel to reach it, so its mean is held at 0.85 and its terrain stays visible.
- The Iapetus mosaic evens out Cassini Regio: the dark leading hemisphere is only ~1.8×
  darker than the ice there, against ~10× in reality. The mosaic's own large-scale
  brightness (2° box blur) is raised to the power 3.9 (ln 10 / ln 1.8), which restores
  that contrast while keeping the boundary and the detail where the data puts them.
- Zero/nodata coverage is softly blended into a uniform mean-colour fill, not
  procedural craters. Europa's unobserved region below 83°S is masked explicitly.
  Triton's missing north and Charon's missing south remain plain.
- LROC's 2025 colour map uses 643/566/415 nm observations and LDAM laser albedo
  beyond about ±70°; the source fills small dropouts. Io's source interpolates
  the poles within about 5°. Ganymede's source uses monochrome polar coverage.
  Triton's source has interpolated grid lines and synthetic orange/violet/UV colour.
  Resolution and illumination vary across these historical mosaics. They do not
  depict the selected simulation date, and no bump/displacement is inferred.

### Bodies that still need an illustrative map

Venus and Titan retain generated visible cloud/haze appearances; radar or
infrared maps would incorrectly expose surfaces hidden in visible light.
The [JPL Venus texture](https://space.jpl.nasa.gov/tmaps/venus.html) explicitly
clones a Mariner image and labels it fictitious; it is not a measured global map.
Sedna has no resolved surface imagery. Halley's partial Giotto flyby views of
an irregular nucleus are not a global spherical texture. Uranus's five moons are
painted from Voyager 2's views, which saw only their southern hemispheres (their USGS
global mosaics are not adopted yet). These bodies remain illustrations built from published physical
constraints; generated maps also remain temporary load/error fallbacks:

- **Venus**: H₂SO₄ cloud deck (`p_V = 0.689`) with the planetary-scale horizontal
  Y (ψ) wave, chevron-sheared mid-latitude streaks from 4-day westward
  super-rotation and Hadley flow, dark subpolar collars (~50–62°) and bright
  polar hoods (>64°), with contrast concentrated in the blue/violet absorber
  wing (Titov et al. 2018, _Space Sci. Rev._ 214, 126).
- **Titan**: Photochemical tholin haze (`p_V = 0.22`) with super-rotational
  zonal smoothness, the seasonal north–south hemispheric albedo dichotomy,
  faint equatorial boundary band, and dark north-polar hood and vortex collar
  (Porco et al. 2005; Lorenz et al. 2004; Roman et al. 2009).
- **Sedna**: Ultra-red organic tholin mantle (`p_V = 0.32`, Pál et al. 2012)
  with brighter CH₄/N₂ volatile frost in high-latitude cold traps and ancient
  basins (Barucci et al. 2005; Emery et al. 2007), balanced across all four
  longitude quadrants to respect the small rotational light-curve amplitude
  (`Δm ≈ 0.02 mag`, Gaudi et al. 2005).
- **Halley**: Soot-dark refractory CHON/silicate lag crust (`p_V = 0.04`),
  central saddle waist, mapped Giotto HMC topography (Crater, Mountain, Chain,
  Ducktail) and localized active outgassing vents covering ~10–15 % of the
  surface (Keller et al. 1986, 1987; Stooke & Abergel 1991).
- **Miranda, Ariel, Umbriel, Titania and Oberon**: Grey ice (`p_V = 0.32`, `0.39`,
  `0.21`, `0.27`, `0.23`) with Miranda's three coronae, Ariel's canyon network,
  Umbriel's bright Wunda ring, Titania's Messina Chasmata and Gertrude, and
  Oberon's dark-floored Hamlet. Features stop where Voyager 2's coverage did:
  their northern hemispheres are plain fill.

## Spacecraft models (public domain)

NASA 3D Resources models by NASA's Visualization Technology Applications and Development
group (<https://science.nasa.gov/3d-resources/>), built by
`scripts/build-spacecraft-models.mjs`, which `SPACECRAFT` in
`src/space/spacecraft/models.ts` also lists:

- **Voyager 1 and 2**: [Voyager](https://science.nasa.gov/resource/voyager-3d-model/).
- **Pioneer 10 and 11**: Pioneer 10, from the
  [NASA 3D Resources archive](https://github.com/nasa/NASA-3D-Resources).
- **New Horizons**: [New Horizons](https://science.nasa.gov/resource/new-horizons-3d-model/).
- **Parker Solar Probe**: [Parker Solar Probe](https://science.nasa.gov/resource/parker-solar-probe-3d-model/).
- **Hubble Space Telescope**: [Hubble](https://science.nasa.gov/resource/hubble-space-telescope-3d-model/).
- **Chandra X-ray Observatory** and **James Webb Space Telescope** (the archive's lighter
  "B" model): from the [NASA 3D Resources archive](https://github.com/nasa/NASA-3D-Resources).

Changes: each model is scaled so its high-gain dish (Parker: its heat shield; Hubble: its
aft shroud; Chandra: its solar arrays; Webb: its sunshield's sun-facing layer) spans the
published width (`docs/science-sources.md`) and turned so its face looks along +z; the
scenes turn the probes' dishes to Earth, and Parker's shield, the observatories' solar
arrays and Webb's sunshield to the Sun. An exporter's helper cube is dropped, meshes
are welded, simplified and meshopt-compressed, and textures become WebP of at most
1024 px. The models' own materials are replaced by one shader lit by the Sun; their colours,
metalness and roughness are kept. Twin spacecraft share one model, and Pioneer 11 shows
Pioneer 10's. These are visual models, not engineering drawings: small parts, antennas
and booms are approximate.

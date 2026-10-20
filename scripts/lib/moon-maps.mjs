/** Source rasters are north-up, eastward GeoTIFFs. The catalogue's west-positive
 * labels are NOT the raster x direction. Central meridians from GeoKey 3088:
 * Io/Triton/Charon 0°, Europa/Ganymede/Callisto 180°. LROC is centred on 0°.
 * These spherical maps need no oblate-latitude conversion. Phobos and Deimos are
 * Stooke's simple-cylindrical mosaics on each shape model's planetocentric grid,
 * 0° at the centre and east to the right: USGS labels its copy of the Phobos map
 * PositiveEast, which puts Stickney at its IAU 49° W. The Saturnian mosaics (Cassini, with
 * Voyager fill) have central meridian 0° or 180° with the left edge at 180° either way, so
 * all are rolled; Herschel, Odysseus, Inktomi's rays and Dione's trailing wisps land on their
 * IAU longitudes. Mimas comes as DLR's basemap inside a zip (`entry`); `contrast` restores
 * large-scale albedo contrast a mosaic evened out between its images.
 */
export const MOON_MAP_SOURCES = {
  moon: {
    file: "https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_16bit_srgb_4k.tif",
    sha256: "9731fa8af425b6c2f88f277ecca82bf8c603f3743894f64ed7b25c5bfefa22ff",
    centered: true,
    saturation: 1,
  },
  io: {
    file: "https://planetarymaps.usgs.gov/mosaic/Io_Galileo_SSI_Global_Mosaic_ClrMerge_1km.tif",
    sha256: "524dcabd247c889a4e7c2a1bfd9e5fcc545c6a039b2c765da9b741befdfd00bd",
    centered: true,
    saturation: 0.4,
  },
  europa: {
    file: "https://planetarymaps.usgs.gov/mosaic/Europa_Voyager_GalileoSSI_global_mosaic_500m.tif",
    sha256: "a323f0c9ccb47d5af9902ea8297fe81f9a9708795645b80801f103c3f7c9a624",
    centered: false,
    saturation: 1,
  },
  ganymede: {
    file: "https://planetarymaps.usgs.gov/mosaic/Ganymede_Voyager_GalileoSSI_Global_ClrMosaic_1435m.tif",
    sha256: "da47087e75bc530456d8206d5100ad3c687706353700b0cb44a8400957005a33",
    centered: false,
    saturation: 0.4,
  },
  callisto: {
    file: "https://planetarymaps.usgs.gov/mosaic/Callisto_Voyager_GalileoSSI_global_mosaic_1km.tif",
    sha256: "e1f0bd2e0e05de605d067d6b5f5ededddaf31ca6c064562a1ca770f15a7dbaa3",
    centered: false,
    saturation: 1,
  },
  triton: {
    file: "https://planetarymaps.usgs.gov/mosaic/Triton_Voyager2_ClrMosaic_GlobalFill_600m.tif",
    sha256: "f20ed332e85df469725629b81d3a73ad026897fe561ec59d6245d249a09507db",
    centered: true,
    saturation: 0.4,
  },
  charon: {
    file: "https://planetarymaps.usgs.gov/mosaic/Charon_NewHorizons_Global_Mosaic_300m_Jul2017_8bit.tif",
    sha256: "4a874809e0a33a851cd026b8e4647f5875ed15807e677d413812367509564b00",
    centered: true,
    saturation: 1,
  },
  phobos: {
    file: "https://planetarymaps.usgs.gov/mosaic/Phobos_Viking_Mosaic_40ppd_DLRcontrol.tif",
    sha256: "d7934d5b209e5f31ed26297e1e85a4713d8d0aa2906111ffe4b3d60d02ae0ccb",
    centered: true,
    saturation: 1,
  },
  /* No USGS mosaic product: Stooke's map as archived at the PDS Small Bodies Node. */
  deimos: {
    file: "https://sbnarchive.psi.edu/pds3/multi_mission/MULTI_SA_MULTI_6_STOOKEMAPS_V2_0/document/m2deimos/deimos_cyl_viking_mro.jpg",
    sha256: "90ff4ac7f23ece9255774cf72f9ed9ca5be861d9f2aa136977fc2d460141ad6d",
    centered: true,
    saturation: 1,
  },
  mimas: {
    file: "https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/Mimas/Cassini_DLR_Mimas.zip",
    entry: "Cassini_DLR/MI_170630_DLR_basemap_degrees.tif",
    sha256: "4d339571ad645b2b7b43b732633574e8dc8fae7ebbed833aa4f90b10588e20f0",
    centered: true,
    saturation: 1,
  },
  enceladus: {
    file: "https://planetarymaps.usgs.gov/mosaic/Enceladus_Cassini_mosaic_global_110m.tif",
    sha256: "c9d29292141dd986e52b2a24b692df34701d1dabaee69bcb9fb64ebc6baba335",
    centered: true,
    saturation: 1,
  },
  tethys: {
    file: "https://planetarymaps.usgs.gov/mosaic/Tethys_Cassini_mosaic_global_293m.tif",
    sha256: "40723c3ebfaaa52a657827b37309bc84234811db1cf26a21d086e26aba2b3640",
    centered: true,
    saturation: 1,
  },
  dione: {
    file: "https://planetarymaps.usgs.gov/mosaic/Dione_Cassini_Voyager_mosaic_global_154m.tif",
    sha256: "5c5d796c02e3c99fde5dd034e01dd1f25905699a4885843aed445ded955e08b5",
    centered: true,
    saturation: 1,
  },
  rhea: {
    file: "https://planetarymaps.usgs.gov/mosaic/Rhea_Cassini_Voyager_mosaic_global_417m.tif",
    sha256: "ce537c3c93670a0d4ea5a64b99bffb76ff308727eb3eabeee0a38cf9f6f1abc7",
    centered: true,
    saturation: 1,
  },
  /* The mosaic evens out Cassini Regio's tenfold contrast to ~1.8×; a power restores it. */
  iapetus: {
    file: "https://planetarymaps.usgs.gov/mosaic/Iapetus_Cassini_Voyager_mosaic_global_783m.tif",
    sha256: "eb8acdbed3af495102b6ec6d3efce1f03dc6bc39bb43323c23231ce590494d6e",
    centered: true,
    saturation: 1,
    contrast: 3.9,
  },
};

/** North-up equirectangular pixel index, wrapping the prime-meridian seam. */
export function moonSourceX(x, width, centered) {
  return (x + (centered ? width / 2 : 0)) % width;
}

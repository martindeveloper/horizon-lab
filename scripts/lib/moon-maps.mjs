/** Source rasters are north-up, eastward GeoTIFFs. The catalogue's west-positive
 * labels are NOT the raster x direction. Central meridians from GeoKey 3088:
 * Io/Triton/Charon 0°, Europa/Ganymede/Callisto 180°. LROC is centred on 0°.
 * These spherical maps need no oblate-latitude conversion.
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
};

/** North-up equirectangular pixel index, wrapping the prime-meridian seam. */
export function moonSourceX(x, width, centered) {
  return (x + (centered ? width / 2 : 0)) % width;
}

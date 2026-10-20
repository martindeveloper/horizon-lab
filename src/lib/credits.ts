/**
 * Everything Horizon is built on that someone else made: imagery, data,
 * fonts and code, with the credit line and licence each asks for. The credits
 * page renders this list; tests check it against the orrery's measured maps
 * and the installed packages' own licence fields. Descriptions are translated
 * under `credits.items.<id>`; names, credit lines and licences stay as published.
 */

export type Licence =
  | "Public domain"
  /** Citation of published values or methods; does not relicense the source. */
  | "Cited"
  | "CC BY 4.0"
  | "CC BY-NC 3.0 IGO"
  | "SIL OFL 1.1"
  | "BSD-2-Clause"
  | "MIT"
  | "ISC"
  | "Apache-2.0";

export const LICENCE_URLS: Partial<Record<Licence, string>> = {
  "CC BY 4.0": "https://creativecommons.org/licenses/by/4.0/",
  "CC BY-NC 3.0 IGO": "https://creativecommons.org/licenses/by-nc/3.0/igo/",
  "SIL OFL 1.1": "https://openfontlicense.org/",
  "BSD-2-Clause": "https://opensource.org/license/bsd-2-clause",
  MIT: "https://opensource.org/license/mit",
  ISC: "https://opensource.org/license/isc-license-txt",
  "Apache-2.0": "https://www.apache.org/licenses/LICENSE-2.0",
};

export type Credit = {
  id: string;
  name: string;
  /** Who made it, in the words the source asks for. */
  by: string;
  licence: Licence;
  url: string;
  /** npm package whose own `license` field must match (software only). */
  package?: string;
  /** Sibling packages from the same project and licence. */
  covers?: string[];
};

export type CreditGroup = {
  id: "imagery" | "data" | "fonts" | "software" | "tools";
  items: Credit[];
};

export const CREDITS: readonly CreditGroup[] = [
  {
    id: "imagery",
    items: [
      {
        id: "moonMap",
        name: "LRO/LROC CGI Moon Kit (2025), laser-albedo polar fill",
        by: "NASA’s Scientific Visualization Studio; NASA/LRO/LROC, Arizona State University",
        licence: "Public domain",
        url: "https://svs.gsfc.nasa.gov/4720/",
      },
      {
        id: "ioMap",
        name: "Galileo SSI / Voyager merged mosaic, muted enhanced colour; interpolated poles",
        by: "NASA/JPL; USGS Astrogeology",
        licence: "Public domain",
        url: "https://astrogeology.usgs.gov/search/map/io_galileo_ssi_global_color_merge_mosaic_1km",
      },
      {
        id: "europaMap",
        name: "Voyager / Galileo SSI mosaic, monochrome; plain south-polar fill",
        by: "NASA/JPL; USGS Astrogeology",
        licence: "Public domain",
        url: "https://astrogeology.usgs.gov/search/map/europa_voyager_galileo_ssi_global_mosaic_500m",
      },
      {
        id: "ganymedeMap",
        name: "Voyager / Galileo SSI mosaic, muted multispectral colour; monochrome poles",
        by: "NASA/JPL; USGS Astrogeology",
        licence: "Public domain",
        url: "https://astrogeology.usgs.gov/search/map/ganymede_voyager_galileo_ssi_color_global_mosaic_1_4km",
      },
      {
        id: "callistoMap",
        name: "Voyager / Galileo SSI mosaic, monochrome",
        by: "NASA/JPL; USGS Astrogeology",
        licence: "Public domain",
        url: "https://astrogeology.usgs.gov/search/map/callisto_galileo_voyager_global_mosaic_1km",
      },
      {
        id: "tritonMap",
        name: "Voyager 2 mosaic, muted synthetic colour; plain unobserved-area fill",
        by: "NASA/JPL; USGS Astrogeology",
        licence: "Public domain",
        url: "https://astrogeology.usgs.gov/search/map/triton_voyager_2_global_color_mosaic_600m",
      },
      {
        id: "phobosMap",
        name: "Phobos Viking global mosaic (DLR control), monochrome",
        by: "NASA/JPL; Philip Stooke, University of Western Ontario; USGS Astrogeology",
        licence: "Public domain",
        url: "https://astrogeology.usgs.gov/search/map/phobos_viking_global_mosaic_5m",
      },
      {
        id: "deimosMap",
        name: "Stooke small bodies maps: Deimos, Viking with MRO HiRISE, monochrome",
        by: "NASA/JPL; Philip Stooke, University of Western Ontario (with C. Jongkind, M. Arntz); P. Thomas, Cornell; PDS Small Bodies Node",
        licence: "Public domain",
        url: "https://sbn.psi.edu/pds/resource/stookemaps.html",
      },
      {
        id: "charonMap",
        name: "New Horizons LORRI / MVIC mosaic, monochrome; plain unobserved-area fill",
        by: "NASA, JHU APL, SwRI, Lunar and Planetary Institute; USGS Astrogeology",
        licence: "Public domain",
        url: "https://astrogeology.usgs.gov/search/map/charon_new_horizons_lorri_mvic_global_mosaic_300m",
      },

      {
        id: "sdoHmi",
        name: "SDO/HMI continuum intensity (May 2024)",
        by: "Courtesy of NASA/SDO and the AIA, EVE, and HMI science teams.",
        licence: "Public domain",
        url: "https://sdo.gsfc.nasa.gov/data/",
      },
      {
        id: "opal",
        name: "Hubble OPAL global maps (2025)",
        by: "NASA, ESA, A.A. Simon, M.H. Wong. Hubble programme GO13937 (PI: Simon), archived by STScI; DOI 10.17909/T9G593",
        licence: "CC BY 4.0",
        url: "https://archive.stsci.edu/hlsp/opal",
      },
      {
        id: "blueMarble",
        name: "Blue Marble Next Generation and Blue Marble clouds",
        by: "NASA Earth Observatory (Reto Stöckli)",
        licence: "Public domain",
        url: "https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/",
      },
      {
        id: "viking",
        name: "Mars Viking global colour mosaic, 925 m",
        by: "NASA, USGS Astrogeology Science Center",
        licence: "Public domain",
        url: "https://astrogeology.usgs.gov/search/map/mars_viking_global_color_mosaic_925m",
      },
      {
        id: "messenger",
        name: "Mercury MESSENGER MDIS global mosaic, 665 m",
        by: "NASA, Johns Hopkins University APL, Carnegie Institution of Washington; USGS Astrogeology",
        licence: "Public domain",
        url: "https://astrogeology.usgs.gov/search/map/mercury_messenger_mdis_basemap_md3_color_global_mosaic_665m",
      },
      {
        id: "newHorizons",
        name: "Pluto New Horizons global mosaic, 300 m",
        by: "NASA, Johns Hopkins University APL, Southwest Research Institute, Lunar and Planetary Institute; USGS Astrogeology",
        licence: "Public domain",
        url: "https://www.usgs.gov/media/images/pluto-global-mosaic-new-horizons-july-2017",
      },
    ],
  },
  {
    id: "data",
    items: [
      {
        id: "ned",
        name: "NASA/IPAC Extragalactic Database (NED)",
        by: "IPAC, California Institute of Technology; NASA",
        licence: "Cited",
        url: "https://ned.ipac.caltech.edu/",
      },
      {
        id: "planck",
        name: "Planck 2018 cosmological parameters",
        by: "ESA; Planck Collaboration (2020), A&A 641, A6",
        licence: "Cited",
        url: "https://doi.org/10.1051/0004-6361/201833910",
      },
      {
        id: "nearbyGalaxies",
        name: "Nearby galaxies catalogue (October 2019 table)",
        by: "Alan W. McConnachie (2012), AJ 144, 4; Canadian Astronomy Data Centre",
        licence: "Cited",
        url: "https://www.cadc-ccda.hia-iha.nrc-cnrc.gc.ca/en/community/nearby/",
      },
      {
        id: "gwosc",
        name: "Gravitational Wave Open Science Center and LVK results",
        by: "LIGO Scientific Collaboration, Virgo Collaboration and KAGRA",
        licence: "CC BY 4.0",
        url: "https://gwosc.org/acknowledgement/",
      },
      {
        id: "naif",
        name: "NAIF planetary constants kernel pck00011",
        by: "NASA/JPL Navigation and Ancillary Information Facility; IAU WGCCRE",
        licence: "Cited",
        url: "https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/pck00011.tpc",
      },
      {
        id: "solarLimb",
        name: "Solar limb-darkening coefficients",
        by: "C. W. Allen, Astrophysical Quantities; D. Alexander and S. L. Freeland, SolarSoft",
        licence: "Cited",
        url: "https://hesperia.gsfc.nasa.gov/ssw/gen/idl/solar/darklimb_u.pro",
      },
      {
        id: "iauUnits",
        name: "IAU astronomical units and nominal solar values",
        by: "International Astronomical Union, resolutions 2012 B2 and 2015 B2/B3",
        licence: "Cited",
        url: "https://www.iau.org/static/resolutions/IAU2015_English.pdf",
      },
      {
        id: "si",
        name: "International System of Units (SI)",
        by: "Bureau International des Poids et Mesures (BIPM)",
        licence: "Cited",
        url: "https://www.bipm.org/en/publications/si-brochure",
      },

      {
        id: "solarProminences",
        name: "Solar prominences and filaments",
        by: "NASA / Marshall Space Flight Center",
        licence: "Cited",
        url: "https://solarscience.msfc.nasa.gov/feature2.shtml",
      },
      {
        id: "jpl",
        name: "JPL Solar System Dynamics",
        by: "NASA Jet Propulsion Laboratory, California Institute of Technology",
        licence: "Public domain",
        url: "https://ssd.jpl.nasa.gov/",
      },
      {
        id: "iau",
        name: "IAU WGCCRE report 2015 (Archinal et al. 2018)",
        by: "International Astronomical Union Working Group on Cartographic Coordinates and Rotational Elements",
        licence: "Cited",
        url: "https://doi.org/10.1007/s10569-017-9805-5",
      },
      {
        id: "nssdc",
        name: "NASA planetary fact sheets",
        by: "NASA Space Science Data Coordinated Archive",
        licence: "Public domain",
        url: "https://nssdc.gsfc.nasa.gov/planetary/factsheet/",
      },
      {
        id: "pds",
        name: "PDS Ring-Moon Systems Node",
        by: "NASA Planetary Data System, SETI Institute",
        licence: "Public domain",
        url: "https://pds-rings.seti.org/",
      },
      {
        id: "gaia",
        name: "Gaia Data Release 3",
        by: "ESA/Gaia/DPAC",
        licence: "CC BY-NC 3.0 IGO",
        url: "https://www.cosmos.esa.int/web/gaia/dr3",
      },
      {
        id: "simbad",
        name: "SIMBAD and VizieR",
        by: "CDS, Strasbourg Astronomical Observatory, France",
        licence: "Cited",
        url: "https://cds.unistra.fr/",
      },
      {
        id: "mpc",
        name: "Minor Planet Center",
        by: "IAU Minor Planet Center, Smithsonian Astrophysical Observatory",
        licence: "Cited",
        url: "https://minorplanetcenter.net/",
      },
      {
        id: "gravity",
        name: "GRAVITY Galactic Centre measurements (2021–2022)",
        by: "GRAVITY Collaboration, ESO Very Large Telescope Interferometer",
        licence: "Cited",
        url: "https://doi.org/10.1051/0004-6361/202142465",
      },
      {
        id: "eht",
        name: "Event Horizon Telescope results (2019–2025)",
        by: "Event Horizon Telescope Collaboration",
        licence: "Cited",
        url: "https://eventhorizontelescope.org/",
      },
      {
        id: "nistAsd",
        name: "NIST Atomic Spectra Database",
        by: "Kramida, Ralchenko, Reader and the NIST ASD Team, National Institute of Standards and Technology",
        licence: "Cited",
        url: "https://www.nist.gov/pml/atomic-spectra-database",
      },
      {
        id: "atlas9",
        name: "ATLAS9 model atmospheres (Castelli & Kurucz 2003)",
        by: "Fiorella Castelli and Robert L. Kurucz",
        licence: "Cited",
        url: "https://wwwuser.oats.inaf.it/fiorella.castelli/grids.html",
      },
      {
        id: "barklem",
        name: "Hydrogen-collision broadening (Barklem, Piskunov & O'Mara 2000)",
        by: "Paul Barklem, Nikolai Piskunov and Brian O'Mara, via CDS VizieR",
        licence: "Cited",
        url: "https://cdsarc.cds.unistra.fr/viz-bin/cat/J/A+AS/142/467",
      },
      {
        id: "cie",
        name: "CIE 1931 colour-matching functions",
        by: "International Commission on Illumination (CIE)",
        licence: "Cited",
        url: "https://cie.co.at/datatable/cie-1931-colour-matching-functions-2-degree-observer",
      },
      {
        id: "codata",
        name: "CODATA 2022 fundamental constants",
        by: "CODATA Task Group on Fundamental Constants; NIST",
        licence: "Cited",
        url: "https://physics.nist.gov/cuu/Constants/",
      },
      {
        id: "ciaaw",
        name: "Standard atomic weights (IUPAC CIAAW 2021)",
        by: "IUPAC Commission on Isotopic Abundances and Atomic Weights",
        licence: "Cited",
        url: "https://www.ciaaw.org/atomic-weights.htm",
      },
    ],
  },
  {
    id: "fonts",
    items: [
      {
        id: "bodoni",
        name: "Bodoni Moda",
        by: "Owen Earl (indestructible type*); packaged by Fontsource",
        licence: "SIL OFL 1.1",
        url: "https://fontsource.org/fonts/bodoni-moda",
        package: "@fontsource-variable/bodoni-moda",
      },
      {
        id: "plex",
        name: "IBM Plex Sans and IBM Plex Mono",
        by: "IBM Corp. (Mike Abbink, Bold Monday); packaged by Fontsource",
        licence: "SIL OFL 1.1",
        url: "https://github.com/IBM/plex",
        package: "@fontsource-variable/ibm-plex-sans",
        covers: ["@fontsource/ibm-plex-mono"],
      },
    ],
  },
  {
    id: "software",
    items: [
      {
        id: "helland",
        name: "Blackbody temperature-to-RGB approximation",
        by: "Tanner Helland; fit based on Mitchell Charity’s blackbody colour data",
        licence: "BSD-2-Clause",
        url: "https://tannerhelland.com/2012/09/18/convert-temperature-rgb-algorithm-code.html",
      },
      {
        id: "next",
        name: "Next.js",
        by: "Vercel",
        licence: "MIT",
        url: "https://nextjs.org/",
        package: "next",
      },
      {
        id: "react",
        name: "React and React DOM",
        by: "Meta Platforms and contributors",
        licence: "MIT",
        url: "https://react.dev/",
        package: "react",
        covers: ["react-dom"],
      },
      {
        id: "three",
        name: "three.js",
        by: "three.js authors",
        licence: "MIT",
        url: "https://threejs.org/",
        package: "three",
      },
      {
        id: "nextIntl",
        name: "next-intl",
        by: "Jan Amann",
        licence: "MIT",
        url: "https://next-intl.dev/",
        package: "next-intl",
      },
      {
        id: "nextThemes",
        name: "next-themes",
        by: "Paco Coursey",
        licence: "MIT",
        url: "https://github.com/pacocoursey/next-themes",
        package: "next-themes",
      },
      {
        id: "zustand",
        name: "Zustand",
        by: "Poimandres",
        licence: "MIT",
        url: "https://zustand.docs.pmnd.rs/",
        package: "zustand",
      },
      {
        id: "tailwind",
        name: "Tailwind CSS",
        by: "Tailwind Labs",
        licence: "MIT",
        url: "https://tailwindcss.com/",
        package: "tailwindcss",
      },
      {
        id: "motion",
        name: "Motion",
        by: "Motion Division",
        licence: "MIT",
        url: "https://motion.dev/",
        package: "motion",
      },
      {
        id: "radix",
        name: "Radix UI Slider",
        by: "WorkOS",
        licence: "MIT",
        url: "https://www.radix-ui.com/primitives",
        package: "@radix-ui/react-slider",
      },
      {
        id: "lucide",
        name: "Lucide icons",
        by: "Lucide contributors",
        licence: "ISC",
        url: "https://lucide.dev/",
        package: "lucide-react",
      },
      {
        id: "feather",
        name: "Feather icons (used by Lucide)",
        by: "Copyright (c) 2013-present Cole Bemis",
        licence: "MIT",
        url: "https://github.com/feathericons/feather",
      },
      {
        id: "tailwindMerge",
        name: "tailwind-merge",
        by: "Dany Castillo",
        licence: "MIT",
        url: "https://github.com/dcastil/tailwind-merge",
        package: "tailwind-merge",
      },
      {
        id: "clsx",
        name: "clsx",
        by: "Luke Edwards",
        licence: "MIT",
        url: "https://github.com/lukeed/clsx",
        package: "clsx",
      },
      {
        id: "vercelAnalytics",
        name: "Vercel Web Analytics",
        by: "Vercel",
        licence: "MIT",
        url: "https://vercel.com/docs/analytics",
        package: "@vercel/analytics",
      },
      {
        id: "speedInsights",
        name: "Vercel Speed Insights",
        by: "Vercel",
        licence: "Apache-2.0",
        url: "https://vercel.com/docs/speed-insights",
        package: "@vercel/speed-insights",
      },
    ],
  },
  {
    id: "tools",
    items: [
      {
        id: "typescript",
        name: "TypeScript",
        by: "Microsoft",
        licence: "Apache-2.0",
        url: "https://www.typescriptlang.org/",
        package: "typescript",
      },
      {
        id: "reactCompiler",
        name: "React Compiler",
        by: "Meta Platforms and contributors",
        licence: "MIT",
        url: "https://react.dev/learn/react-compiler",
        package: "babel-plugin-react-compiler",
      },
      {
        id: "oxc",
        name: "Oxlint and Oxfmt",
        by: "Oxc project",
        licence: "MIT",
        url: "https://oxc.rs/",
        package: "oxlint",
        covers: ["oxfmt"],
      },
      {
        id: "sharp",
        name: "sharp (libvips)",
        by: "Lovell Fuller and contributors",
        licence: "Apache-2.0",
        url: "https://sharp.pixelplumbing.com/",
        package: "sharp",
      },
      {
        id: "glslParser",
        name: "GLSL parser",
        by: "ShaderFrog",
        licence: "ISC",
        url: "https://github.com/ShaderFrog/glsl-parser",
        package: "@shaderfrog/glsl-parser",
      },
      {
        id: "tsx",
        name: "tsx",
        by: "Hiroki Osame",
        licence: "MIT",
        url: "https://tsx.is/",
        package: "tsx",
      },
    ],
  },
];

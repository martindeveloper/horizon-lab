/**
 * Everything Horizon is built on that someone else made: imagery, data,
 * fonts and code, with the credit line and licence each asks for. The credits
 * page renders this list. The moons' map credits are the toolkit's measured maps'
 * own records; tests check the rest against those maps and the installed packages'
 * own licence fields. Descriptions are translated under `credits.items.<id>`;
 * names, credit lines and licences stay as published.
 */
import { SPACECRAFT } from "@/space/spacecraft/models";
import { MAPS } from "@horizon/toolkit/bodies";
import {
  CREDIT_URLS,
  LICENCE_URLS as EXTERNAL_LICENCE_URLS,
  SOURCE_URLS,
} from "@horizon/toolkit/urls";

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
  "CC BY 4.0": EXTERNAL_LICENCE_URLS.CC_BY_4_0,
  "CC BY-NC 3.0 IGO": EXTERNAL_LICENCE_URLS.CC_BY_NC_3_0_IGO,
  "SIL OFL 1.1": EXTERNAL_LICENCE_URLS.SIL_OFL_1_1,
  "BSD-2-Clause": EXTERNAL_LICENCE_URLS.BSD_2_Clause,
  MIT: EXTERNAL_LICENCE_URLS.MIT,
  ISC: EXTERNAL_LICENCE_URLS.ISC,
  "Apache-2.0": EXTERNAL_LICENCE_URLS.Apache_2_0,
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

/** The planet maps' data products, each credited once for every map made from it. */
const MAP_PRODUCTS: readonly Credit[] = [
  {
    id: "sdoHmi",
    name: "SDO/HMI continuum intensity (May 2024)",
    by: "Courtesy of NASA/SDO and the AIA, EVE, and HMI science teams.",
    licence: "Public domain",
    url: CREDIT_URLS.sdoHmi,
  },
  {
    id: "opal",
    name: "Hubble OPAL global maps (2025)",
    by: "NASA, ESA, A.A. Simon, M.H. Wong. Hubble programme GO13937 (PI: Simon), archived by STScI; DOI 10.17909/T9G593",
    licence: "CC BY 4.0",
    url: CREDIT_URLS.opal,
  },
  {
    id: "blueMarble",
    name: "Blue Marble Next Generation and Blue Marble clouds",
    by: "NASA Earth Observatory (Reto Stöckli)",
    licence: "Public domain",
    url: CREDIT_URLS.blueMarble,
  },
  {
    id: "viking",
    name: "Mars Viking global colour mosaic, 925 m",
    by: "NASA, USGS Astrogeology Science Center",
    licence: "Public domain",
    url: CREDIT_URLS.viking,
  },
  {
    id: "messenger",
    name: "Mercury MESSENGER MDIS global mosaic, 665 m",
    by: "NASA, Johns Hopkins University APL, Carnegie Institution of Washington; USGS Astrogeology",
    licence: "Public domain",
    url: CREDIT_URLS.messenger,
  },
  {
    id: "newHorizons",
    name: "Pluto New Horizons global mosaic, 300 m",
    by: "NASA, Johns Hopkins University APL, Southwest Research Institute, Lunar and Planetary Institute; USGS Astrogeology",
    licence: "Public domain",
    url: CREDIT_URLS.newHorizons,
  },
];

/**
 * Every measured map the toolkit serves (`MAPS`) whose source no data product above covers,
 * credited as the map records it: the moons' mosaics, one each.
 */
const MAP_CREDITS: readonly Credit[] = Object.entries(MAPS)
  .filter(([, map]) => !MAP_PRODUCTS.some((product) => product.url === map.url))
  .map(([body, map]) => ({
    id: `${body}Map`,
    name: map.source,
    by: map.credit,
    licence: map.licence,
    url: map.url,
  }));

/** The spacecraft models (`SPACECRAFT`), credited once: they share their maker and licence. */
const { voyager } = SPACECRAFT;
const MODEL_CREDITS: readonly Credit[] = [
  {
    id: "spacecraftModels",
    name: "NASA 3D Resources: Voyager, Pioneer 10, New Horizons, Parker Solar Probe, Hubble, Chandra, Webb",
    by: voyager.credit,
    licence: voyager.licence,
    url: voyager.url,
  },
];

export const CREDITS: readonly CreditGroup[] = [
  { id: "imagery", items: [...MAP_CREDITS, ...MAP_PRODUCTS, ...MODEL_CREDITS] },
  {
    id: "data",
    items: [
      {
        id: "ned",
        name: "NASA/IPAC Extragalactic Database (NED)",
        by: "IPAC, California Institute of Technology; NASA",
        licence: "Cited",
        url: CREDIT_URLS.ned,
      },
      {
        id: "planck",
        name: "Planck 2018 cosmological parameters",
        by: "ESA; Planck Collaboration (2020), A&A 641, A6",
        licence: "Cited",
        url: CREDIT_URLS.planck,
      },
      {
        id: "nearbyGalaxies",
        name: "Nearby galaxies catalogue (October 2019 table)",
        by: "Alan W. McConnachie (2012), AJ 144, 4; Canadian Astronomy Data Centre",
        licence: "Cited",
        url: SOURCE_URLS.mcconnachie2019,
      },
      {
        id: "gwosc",
        name: "Gravitational Wave Open Science Center and LVK results",
        by: "LIGO Scientific Collaboration, Virgo Collaboration and KAGRA",
        licence: "CC BY 4.0",
        url: CREDIT_URLS.gwosc,
      },
      {
        id: "naif",
        name: "NAIF planetary constants kernel pck00011",
        by: "NASA/JPL Navigation and Ancillary Information Facility; IAU WGCCRE",
        licence: "Cited",
        url: CREDIT_URLS.naif,
      },
      {
        id: "solarLimb",
        name: "Solar limb-darkening coefficients",
        by: "C. W. Allen, Astrophysical Quantities; D. Alexander and S. L. Freeland, SolarSoft",
        licence: "Cited",
        url: CREDIT_URLS.solarLimb,
      },
      {
        id: "iauUnits",
        name: "IAU astronomical units and nominal solar values",
        by: "International Astronomical Union, resolutions 2012 B2 and 2015 B2/B3",
        licence: "Cited",
        url: CREDIT_URLS.iauUnits,
      },
      {
        id: "si",
        name: "International System of Units (SI)",
        by: "Bureau International des Poids et Mesures (BIPM)",
        licence: "Cited",
        url: CREDIT_URLS.si,
      },

      {
        id: "solarProminences",
        name: "Solar prominences and filaments",
        by: "NASA / Marshall Space Flight Center",
        licence: "Cited",
        url: CREDIT_URLS.solarProminences,
      },
      {
        id: "jpl",
        name: "JPL Solar System Dynamics",
        by: "NASA Jet Propulsion Laboratory, California Institute of Technology",
        licence: "Public domain",
        url: CREDIT_URLS.jpl,
      },
      {
        id: "iau",
        name: "IAU WGCCRE report 2015 (Archinal et al. 2018)",
        by: "International Astronomical Union Working Group on Cartographic Coordinates and Rotational Elements",
        licence: "Cited",
        url: CREDIT_URLS.iau,
      },
      {
        id: "nssdc",
        name: "NASA planetary fact sheets",
        by: "NASA Space Science Data Coordinated Archive",
        licence: "Public domain",
        url: CREDIT_URLS.nssdc,
      },
      {
        id: "pds",
        name: "PDS Ring-Moon Systems Node",
        by: "NASA Planetary Data System, SETI Institute",
        licence: "Public domain",
        url: CREDIT_URLS.pds,
      },
      {
        id: "gaia",
        name: "Gaia Data Release 3",
        by: "ESA/Gaia/DPAC",
        licence: "CC BY-NC 3.0 IGO",
        url: CREDIT_URLS.gaia,
      },
      {
        id: "simbad",
        name: "SIMBAD and VizieR",
        by: "CDS, Strasbourg Astronomical Observatory, France",
        licence: "Cited",
        url: CREDIT_URLS.simbad,
      },
      {
        id: "mpc",
        name: "Minor Planet Center",
        by: "IAU Minor Planet Center, Smithsonian Astrophysical Observatory",
        licence: "Cited",
        url: CREDIT_URLS.mpc,
      },
      {
        id: "gravity",
        name: "GRAVITY Galactic Centre measurements (2021–2022)",
        by: "GRAVITY Collaboration, ESO Very Large Telescope Interferometer",
        licence: "Cited",
        url: SOURCE_URLS.gravity2022,
      },
      {
        id: "eht",
        name: "Event Horizon Telescope results (2019–2025)",
        by: "Event Horizon Telescope Collaboration",
        licence: "Cited",
        url: CREDIT_URLS.eht,
      },
      {
        id: "nistAsd",
        name: "NIST Atomic Spectra Database",
        by: "Kramida, Ralchenko, Reader and the NIST ASD Team, National Institute of Standards and Technology",
        licence: "Cited",
        url: CREDIT_URLS.nistAsd,
      },
      {
        id: "atlas9",
        name: "ATLAS9 model atmospheres (Castelli & Kurucz 2003)",
        by: "Fiorella Castelli and Robert L. Kurucz",
        licence: "Cited",
        url: CREDIT_URLS.atlas9,
      },
      {
        id: "barklem",
        name: "Hydrogen-collision broadening (Barklem, Piskunov & O'Mara 2000)",
        by: "Paul Barklem, Nikolai Piskunov and Brian O'Mara, via CDS VizieR",
        licence: "Cited",
        url: CREDIT_URLS.barklem,
      },
      {
        id: "cie",
        name: "CIE 1931 colour-matching functions",
        by: "International Commission on Illumination (CIE)",
        licence: "Cited",
        url: CREDIT_URLS.cie,
      },
      {
        id: "codata",
        name: "CODATA 2022 fundamental constants",
        by: "CODATA Task Group on Fundamental Constants; NIST",
        licence: "Cited",
        url: CREDIT_URLS.codata,
      },
      {
        id: "ciaaw",
        name: "Standard atomic weights (IUPAC CIAAW 2021)",
        by: "IUPAC Commission on Isotopic Abundances and Atomic Weights",
        licence: "Cited",
        url: CREDIT_URLS.ciaaw,
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
        url: CREDIT_URLS.bodoni,
        package: "@fontsource-variable/bodoni-moda",
      },
      {
        id: "plex",
        name: "IBM Plex Sans and IBM Plex Mono",
        by: "IBM Corp. (Mike Abbink, Bold Monday); packaged by Fontsource",
        licence: "SIL OFL 1.1",
        url: CREDIT_URLS.plex,
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
        url: CREDIT_URLS.helland,
      },
      {
        id: "next",
        name: "Next.js",
        by: "Vercel",
        licence: "MIT",
        url: CREDIT_URLS.next,
        package: "next",
      },
      {
        id: "react",
        name: "React and React DOM",
        by: "Meta Platforms and contributors",
        licence: "MIT",
        url: CREDIT_URLS.react,
        package: "react",
        covers: ["react-dom"],
      },
      {
        id: "three",
        name: "three.js",
        by: "three.js authors",
        licence: "MIT",
        url: CREDIT_URLS.three,
        package: "three",
      },
      {
        id: "nextIntl",
        name: "next-intl",
        by: "Jan Amann",
        licence: "MIT",
        url: CREDIT_URLS.nextIntl,
        package: "next-intl",
      },
      {
        id: "nextThemes",
        name: "next-themes",
        by: "Paco Coursey",
        licence: "MIT",
        url: CREDIT_URLS.nextThemes,
        package: "next-themes",
      },
      {
        id: "zustand",
        name: "Zustand",
        by: "Poimandres",
        licence: "MIT",
        url: CREDIT_URLS.zustand,
        package: "zustand",
      },
      {
        id: "tailwind",
        name: "Tailwind CSS",
        by: "Tailwind Labs",
        licence: "MIT",
        url: CREDIT_URLS.tailwind,
        package: "tailwindcss",
      },
      {
        id: "motion",
        name: "Motion",
        by: "Motion Division",
        licence: "MIT",
        url: CREDIT_URLS.motion,
        package: "motion",
      },
      {
        id: "radix",
        name: "Radix UI Slider",
        by: "WorkOS",
        licence: "MIT",
        url: CREDIT_URLS.radix,
        package: "@radix-ui/react-slider",
      },
      {
        id: "lucide",
        name: "Lucide icons",
        by: "Lucide contributors",
        licence: "ISC",
        url: CREDIT_URLS.lucide,
        package: "lucide-react",
      },
      {
        id: "feather",
        name: "Feather icons (used by Lucide)",
        by: "Copyright (c) 2013-present Cole Bemis",
        licence: "MIT",
        url: CREDIT_URLS.feather,
      },
      {
        id: "tailwindMerge",
        name: "tailwind-merge",
        by: "Dany Castillo",
        licence: "MIT",
        url: CREDIT_URLS.tailwindMerge,
        package: "tailwind-merge",
      },
      {
        id: "clsx",
        name: "clsx",
        by: "Luke Edwards",
        licence: "MIT",
        url: CREDIT_URLS.clsx,
        package: "clsx",
      },
      {
        id: "vercelAnalytics",
        name: "Vercel Web Analytics",
        by: "Vercel",
        licence: "MIT",
        url: CREDIT_URLS.vercelAnalytics,
        package: "@vercel/analytics",
      },
      {
        id: "speedInsights",
        name: "Vercel Speed Insights",
        by: "Vercel",
        licence: "Apache-2.0",
        url: CREDIT_URLS.speedInsights,
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
        url: CREDIT_URLS.typescript,
        package: "typescript",
      },
      {
        id: "reactCompiler",
        name: "React Compiler",
        by: "Meta Platforms and contributors",
        licence: "MIT",
        url: CREDIT_URLS.reactCompiler,
        package: "babel-plugin-react-compiler",
      },
      {
        id: "oxc",
        name: "Oxlint and Oxfmt",
        by: "Oxc project",
        licence: "MIT",
        url: CREDIT_URLS.oxc,
        package: "oxlint",
        covers: ["oxfmt"],
      },
      {
        id: "sharp",
        name: "sharp (libvips)",
        by: "Lovell Fuller and contributors",
        licence: "Apache-2.0",
        url: CREDIT_URLS.sharp,
        package: "sharp",
      },
      {
        id: "gltfTransform",
        name: "glTF Transform",
        by: "Don McCurdy and contributors",
        licence: "MIT",
        url: CREDIT_URLS.gltfTransform,
        package: "@gltf-transform/core",
        covers: ["@gltf-transform/extensions", "@gltf-transform/functions"],
      },
      {
        id: "meshoptimizer",
        name: "meshoptimizer",
        by: "Arseny Kapoulkine",
        licence: "MIT",
        url: CREDIT_URLS.meshoptimizer,
        package: "meshoptimizer",
      },
      {
        id: "draco",
        name: "Draco",
        by: "Google",
        licence: "Apache-2.0",
        url: CREDIT_URLS.draco,
        package: "draco3dgltf",
      },
      {
        id: "glslParser",
        name: "GLSL parser",
        by: "ShaderFrog",
        licence: "ISC",
        url: CREDIT_URLS.glslParser,
        package: "@shaderfrog/glsl-parser",
      },
      {
        id: "tsx",
        name: "tsx",
        by: "Hiroki Osame",
        licence: "MIT",
        url: CREDIT_URLS.tsx,
        package: "tsx",
      },
    ],
  },
];

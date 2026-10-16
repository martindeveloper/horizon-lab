/**
 * Everything Horizon is built on that someone else made: imagery, data,
 * fonts and code, with the credit line and licence each asks for. The credits
 * page renders this list; tests check it against the orrery's measured maps
 * and the installed packages' own licence fields. Descriptions are translated
 * under `credits.items.<id>`; names, credit lines and licences stay as published.
 */

export type Licence =
  | "Public domain"
  /** Measured values taken from a publication; facts, so no licence applies. */
  | "Cited"
  | "CC BY 4.0"
  | "CC BY-SA 3.0 IGO"
  | "SIL OFL 1.1"
  | "MIT"
  | "ISC"
  | "Apache-2.0";

export const LICENCE_URLS: Partial<Record<Licence, string>> = {
  "CC BY 4.0": "https://creativecommons.org/licenses/by/4.0/",
  "CC BY-SA 3.0 IGO": "https://creativecommons.org/licenses/by-sa/3.0/igo/",
  "SIL OFL 1.1": "https://openfontlicense.org/",
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
        licence: "CC BY-SA 3.0 IGO",
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
        id: "codata",
        name: "CODATA 2022 fundamental constants",
        by: "CODATA Task Group on Fundamental Constants; NIST",
        licence: "Cited",
        url: "https://physics.nist.gov/cuu/Constants/",
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

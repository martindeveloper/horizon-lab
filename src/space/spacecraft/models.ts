import { assetUrl } from "@/lib/assets";
import type { Value } from "@/lib/facts";
import { MODELS_KEY } from "@/lib/urls";
import { keysOf } from "@horizon/toolkit/records";
import { CREDIT_URLS, DOWNLOAD_URLS } from "@horizon/toolkit/urls";

/**
 * Spacecraft drawn at their true size: the NASA 3D Resources models, rebuilt by
 * scripts/build-spacecraft-models.mjs into metres about the centre of the face (the high-gain
 * dish, Parker's heat shield, an observatory's solar arrays or sunshield), which looks down +z.
 * No three.js: cards, tests and the build read this. Published files are never overwritten; a
 * rebuild bumps the model's `version`.
 */
export type SpacecraftId =
  | "voyager"
  | "pioneer"
  | "newHorizons"
  | "parker"
  | "hubble"
  | "chandra"
  | "webb";

export type SpacecraftModel = {
  version: number;
  /**
   * The width the build scales the model by, sourced (the face's own, or Hubble's tube), and
   * what the face turns to in flight: a probe's dish to Earth; Parker's heat shield, an
   * observatory's solar arrays and Webb's sunshield to the Sun, its telescope then looking
   * across the Sun's line.
   */
  face: { across: Value; toward: "earth" | "sun" };
  /**
   * The radius a host frames the craft by, in `face.across`: a dish or shield takes in the bus
   * behind it (1), Hubble's tube is three diameters long (1.5), and solar arrays or a sunshield
   * span the craft that stands within them (0.5).
   */
  frame: number;
  /** The built model's bounding radius about its origin, m (measured by the build, which checks it). */
  radius: number;
  /** What the model was made from, and where its source file is. */
  source: string;
  download: string;
  credit: string;
  licence: "Public domain";
  url: string;
};

const NASA_3D = "NASA Visualization Technology Applications and Development (VTAD)";
const metres = (value: number, source: Value["source"], note: string): Value => ({
  value,
  unit: "m",
  digits: 3,
  source,
  status: "flag",
  note,
});

export const SPACECRAFT: Record<SpacecraftId, SpacecraftModel> = {
  voyager: {
    version: 1,
    face: {
      across: metres(3.7, "nasaVoyager", "high-gain antenna; JPL gives the reflector as 3.66 m"),
      toward: "earth",
    },
    frame: 1,
    radius: 14.3,
    source: "Voyager 3D model (NASA 3D Resources)",
    download: DOWNLOAD_URLS.voyagerModel,
    credit: NASA_3D,
    licence: "Public domain",
    url: CREDIT_URLS.nasa3d,
  },
  pioneer: {
    version: 1,
    face: { across: metres(2.74, "nssdcPioneer10", "parabolic dish, 46 cm deep"), toward: "earth" },
    frame: 1,
    radius: 6.9,
    source: "Pioneer 10 3D model (NASA 3D Resources)",
    download: DOWNLOAD_URLS.pioneerModel,
    credit: NASA_3D,
    licence: "Public domain",
    url: CREDIT_URLS.nasa3d,
  },
  newHorizons: {
    version: 1,
    face: { across: metres(2.1, "fountain2008", "high-gain antenna reflector"), toward: "earth" },
    frame: 1,
    radius: 2.5,
    source: "New Horizons 3D model (NASA 3D Resources)",
    download: DOWNLOAD_URLS.newHorizonsModel,
    credit: NASA_3D,
    licence: "Public domain",
    url: CREDIT_URLS.nasa3d,
  },
  parker: {
    version: 1,
    face: {
      across: metres(2.4, "nasaParkerShield", "Thermal Protection System, 115 mm thick"),
      toward: "sun",
    },
    frame: 1,
    radius: 7.2,
    source: "Parker Solar Probe 3D model (NASA 3D Resources)",
    download: DOWNLOAD_URLS.parkerModel,
    credit: NASA_3D,
    licence: "Public domain",
    url: CREDIT_URLS.nasa3d,
  },
  hubble: {
    version: 1,
    face: {
      across: {
        ...metres(4.2, "nasaHubbleFacts", "maximum diameter, the aft shroud; 13.3 m long"),
        status: "verified",
      },
      toward: "sun",
    },
    frame: 1.5,
    radius: 10.1,
    source: "Hubble Space Telescope 3D model (NASA 3D Resources)",
    download: DOWNLOAD_URLS.hubbleModel,
    credit: NASA_3D,
    licence: "Public domain",
    url: CREDIT_URLS.nasa3d,
  },
  chandra: {
    version: 1,
    face: {
      across: {
        ...metres(19.5, "cxcSpecs", "across the deployed solar arrays; 13.8 m long"),
        status: "verified",
      },
      toward: "sun",
    },
    frame: 0.5,
    radius: 10.8,
    source: "Chandra X-ray Observatory 3D model (NASA 3D Resources)",
    download: DOWNLOAD_URLS.chandraModel,
    credit: NASA_3D,
    licence: "Public domain",
    url: CREDIT_URLS.nasa3d,
  },
  webb: {
    version: 1,
    face: {
      across: {
        ...metres(21.197, "nasaWebbFacts", "sunshield, 21.197 m by 14.162 m"),
        digits: 5,
        status: "verified",
      },
      toward: "sun",
    },
    frame: 0.5,
    radius: 12.1,
    source: "James Webb Space Telescope (B) 3D model (NASA 3D Resources)",
    download: DOWNLOAD_URLS.webbModel,
    credit: NASA_3D,
    licence: "Public domain",
    url: CREDIT_URLS.nasa3d,
  },
};

export const SPACECRAFT_IDS = keysOf(SPACECRAFT);

/** The radius a host frames a craft by, m (`frame`). */
export const spacecraftFrame = (id: SpacecraftId) =>
  SPACECRAFT[id].face.across.value * SPACECRAFT[id].frame;

export { MODELS_KEY } from "@/lib/urls";

/** A model's file under `base`, the CDN or the local mirror (no trailing slash). */
export const spacecraftFile = (base: string, id: SpacecraftId) =>
  `${base}/${id}/v${SPACECRAFT[id].version}/${id}.glb`;

/** Where the scenes fetch a model: the CDN. */
export const spacecraftUrl = (id: SpacecraftId) => spacecraftFile(assetUrl(MODELS_KEY), id);

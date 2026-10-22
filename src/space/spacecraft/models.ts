import { assetUrl } from "@/lib/assets";
import type { Value } from "@/lib/facts";
import { keysOf } from "@horizon/toolkit/records";
import { CREDIT_URLS, DOWNLOAD_URLS } from "@horizon/toolkit/urls";

/**
 * Spacecraft drawn at their true size: the NASA 3D Resources models, rebuilt by
 * scripts/build-spacecraft-models.mjs into metres about the centre of the face (the high-gain
 * dish, or Parker's heat shield), which looks down +z. No three.js: cards, tests and the build read this.
 * Published files are never overwritten; a rebuild bumps the model's `version`.
 */
export type SpacecraftId = "voyager" | "pioneer" | "newHorizons" | "parker";

export type SpacecraftModel = {
  version: number;
  /** The part the build scales the model by: its width across, sourced, and what it faces in flight. */
  face: { across: Value; toward: "earth" | "sun" };
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
    radius: 7.2,
    source: "Parker Solar Probe 3D model (NASA 3D Resources)",
    download: DOWNLOAD_URLS.parkerModel,
    credit: NASA_3D,
    licence: "Public domain",
    url: CREDIT_URLS.nasa3d,
  },
};

export const SPACECRAFT_IDS = keysOf(SPACECRAFT);

/** The radius a host frames a craft by, m: its face's width, which takes in the bus behind it. */
export const spacecraftFrame = (id: SpacecraftId) => SPACECRAFT[id].face.across.value;

/** Bucket folder of the built models: `<key>/<id>/v<version>/<id>.glb`. */
export const MODELS_KEY = "/models/spacecraft";

/** A model's file under `base`, the CDN or the local mirror (no trailing slash). */
export const spacecraftFile = (base: string, id: SpacecraftId) =>
  `${base}/${id}/v${SPACECRAFT[id].version}/${id}.glb`;

/** Where the scenes fetch a model: the CDN. */
export const spacecraftUrl = (id: SpacecraftId) => spacecraftFile(assetUrl(MODELS_KEY), id);

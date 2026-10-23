/**
 * What a renderer reads of the Sun each frame: the contract `frame.ts` exports. Positions are
 * in the body frame, y the pole, radii in R☉ (`SOLAR_RADIUS_KM`); angles in radians; a point on
 * the surface at (lat, lon) is (cos lat cos lon, sin lat, −cos lat sin lon) (`model/surface.ts`).
 * Longitude increases in the direction of rotation (heliographic west: Stonyhurst W is
 * positive; the frame turns prograde about +y, so west is on the right seen from +x), and the white-light
 * map's central meridian at `MAP_EPOCH` is longitude zero, so a feature's model longitude is its
 * Carrington longitude minus the central meridian's then (`MAP_CENTRAL_MERIDIAN_DEG`). The frame
 * turns with the equator (`surfaceTurn`); a feature's `lon` already holds its lag behind the
 * equator. Polylines are xyz triples in a `Float32Array` with a `count` of points in use.
 */

export type PassbandId =
  | "white"
  | "halpha"
  | "he304"
  | "fe171"
  | "fe193"
  | "fe211"
  | "fe335"
  | "fe94"
  | "fe131"
  | "eclipse"
  | "magnetogram";

export type Polyline = {
  points: Float32Array;
  count: number;
  /** Sign of the radial field at the line's first footpoint. */
  polarity: 1 | -1;
  /** Reaches the source surface rather than coming back down. */
  open: boolean;
  /** |B| at the footpoint over the polar field at minimum. */
  strength: number;
  /** The plasma it carries, K. */
  kelvin: number;
};

export type Region = {
  /** Unique over a region's life; 0 in an empty slot. */
  id: number;
  lat: number;
  lon: number;
  /** Joy's law: the bipole axis's angle to the east–west line, the following pole poleward. */
  tilt: number;
  /** The group's angular radius. */
  size: number;
  /** The leading pole's polarity (Hale's law). */
  polarity: 1 | -1;
  /** Seconds since emergence. */
  age: number;
  /** 0 at emergence and death, 1 in its prime; 0 in an empty slot. */
  strength: number;
  /** GOES soft X-ray flux of its flares now, in M1 units (10⁻⁵ W/m²). */
  flare: number;
  /** Facular brightness, 0–1. */
  facula: number;
};

export type Prominence = {
  lat: number;
  lon: number;
  /** The filament channel's angle to the east–west line. */
  tilt: number;
  /** Along the channel, R. */
  length: number;
  /** Resting height, R. */
  height: number;
  /** How far it has risen, in heights: 0 at rest. */
  lift: number;
  /** Visibility, 0–1. */
  fade: number;
  /** Progress of its eruption, 0–1; 0 at rest. */
  erupting: number;
};

export type Eruption = {
  regionId: number;
  /** Progress on the eruption's timeline, 0–1. */
  s: number;
  /** The rope's height over the photosphere, R. */
  ropeHeight: number;
  /** The displayed diffusion region's ends over the photosphere, R; 0 before reconnection. */
  sheetBottom: number;
  sheetTop: number;
  /** Reconnection rate, 0–1 of its peak. */
  reconnection: number;
  /** The flare's light, 0–1 of its peak. */
  flareLight: number;
  goesClass: string;
  /** Separation of the flare ribbons across the neutral line, radians of arc on the surface. */
  ribbonGap: number;
  /** Geometric outer separatrix radius, R from the centre, including before envelope visibility. */
  cmeFront: number;
  /** Its angular half-width, radians. */
  cmeSpread: number;
  /** Visibility of the illustrative CME envelope, 0–1. */
  cmePresence: number;
  /** Contours of one reconnecting field, extruded along the neutral line into the body frame. */
  lines: EruptionLine[];
  /** Passive plasma tracer positions in the body frame, integrated from the same transport. */
  flow: Float32Array;
};

export type EruptionLine = Polyline & {
  kind: "arcade" | "postflare" | "open" | "rope";
  /** Position along the invariant direction of the reduced cross-section model. */
  slice: number;
  /** Stable flux label index, shared by both reconnection products. */
  strand: number;
};

export type SunFrame = {
  /** Model seconds. */
  time: number;
  /** 0–1, 0 at minimum. */
  cyclePhase: number;
  /** Signed global dipole strength, −1..1. */
  dipole: number;
  light: PassbandId;
  regions: Region[];
  prominences: Prominence[];
  /** In solar radii, body frame (y the pole). */
  fieldLines: Polyline[];
  /** In-place geometry revisions; array identity is stable across model updates. */
  fieldRevision: number;
  eruptionRevision: number;
  eruption: Eruption | null;
  wolfNumber: number;
  /** The equator's rotation angle, rad. */
  surfaceTurn: number;
  /** The photograph's groups belong to this frame: its cycle is the Sun's own at its moment. */
  photographed: boolean;
};

export type SunFrameInput = {
  time: number;
  /**
   * The cycle count: its fraction is the phase (0 at minimum), its integer part the cycle's
   * number, whose parity sets the polarity (Hale's law). A bare phase 0–1 is cycle 0.
   */
  cyclePhase: number;
  light: PassbandId;
  /** Scrub the eruption to this point of its timeline over the strongest region; null lets the weather run. */
  eruptionScrub: number | null;
  fieldLineCount: number;
  /**
   * The cycle is the Sun's own at this moment, as the clock's date has it (absent: it is). Once a
   * visitor has moved it, the photograph's groups have no place on the disc.
   */
  ownCycle?: boolean;
};

/**
 * The body frame on the surface, in one place: y is the pole, a point at (lat, lon) is
 * (cos lat cos lon, sin lat, −cos lat sin lon), and longitude increases in the direction of
 * rotation, heliographic west (Stonyhurst W positive; Carrington longitude less the epoch's
 * central meridian). The frame turns prograde about +y, so a point at +x is carried toward −z:
 * larger longitudes are ahead, and seen from Earth's direction (+x, north up) west is on the
 * right, as on the sky. Every renderer and the map's sampling follow this convention.
 */
import type { Vec3 } from "@horizon/toolkit/math";

/** The surface point of a latitude and longitude, unit radius. */
export function surfacePoint(lat: number, lon: number, out: Vec3 = [0, 0, 0]): Vec3 {
  const c = Math.cos(lat);
  out[0] = c * Math.cos(lon);
  out[1] = Math.sin(lat);
  out[2] = -c * Math.sin(lon);
  return out;
}

/** West at a surface point: the direction of rotation, where longitude increases. */
export function westAt(lat: number, lon: number, out: Vec3 = [0, 0, 0]): Vec3 {
  out[0] = -Math.sin(lon);
  out[1] = 0;
  out[2] = -Math.cos(lon);
  return out;
}

/** North at a surface point: along the meridian toward the pole. */
export function northAt(lat: number, lon: number, out: Vec3 = [0, 0, 0]): Vec3 {
  const s = Math.sin(lat);
  out[0] = -s * Math.cos(lon);
  out[1] = Math.cos(lat);
  out[2] = s * Math.sin(lon);
  return out;
}

const west: Vec3 = [0, 0, 0];
const north: Vec3 = [0, 0, 0];

/**
 * An axis on the surface tipped from west by `tilt`, equatorward in either hemisphere: a
 * bipole's, from its following pole to its leading one (Joy's law puts the leader nearer the
 * equator), or a filament channel's, which lies across the bipole's axis (its tilt + π/2).
 */
export function tiltedAxis(lat: number, lon: number, tilt: number, out: Vec3 = [0, 0, 0]): Vec3 {
  westAt(lat, lon, west);
  northAt(lat, lon, north);
  const poleward = lat >= 0 ? 1 : -1;
  const c = Math.cos(tilt);
  const s = Math.sin(tilt) * poleward;
  out[0] = west[0] * c - north[0] * s;
  out[1] = west[1] * c - north[1] * s;
  out[2] = west[2] * c - north[2] * s;
  return out;
}

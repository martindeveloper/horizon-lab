/** Reproject north-up HMI browse discs into the globe's east-longitude UV frame. */
import { Quaternion, Vector3 } from "three";

import {
  bodyOrientation,
  centuriesSinceJ2000,
  jplElements,
  keplerPosition,
  SUN_RADIUS_KM,
} from "@horizon/toolkit/bodies";
import { AU_KM } from "@horizon/toolkit/science";
import { DOWNLOAD_URLS } from "@horizon/toolkit/urls";

export const HMI_SOURCES = [
  ["01", "73a6cd0d0aad6873468872e3e1d34e8d09465731d6e393b15598ff49c3379e82"],
  ["08", "99eabd13624d8f6798e05b081c951465e4ae70a1ac402687242d5d3b9f883dab"],
  ["15", "5d27b02f7b695def8ad117b1bf32f6632a2dc00afd7f97a67af12163493e809a"],
  ["22", "3d277f25a64063ce8511b70ae612849908cde7b29a446416c7dd570a275be18e"],
].map(([day, sha256]) => ({
  date: `2024-05-${day}T00:00:00Z`,
  url: `${DOWNLOAD_URLS.hmiBrowse}/2024/05/${day}/202405${day}_000000_4096_HMIIF.jpg`,
  sha256,
}));

/** Earth-centred viewing geometry; SDO's geocentric offset is negligible for this visual mosaic. */
export function solarObserver(date) {
  const earth = new Vector3().fromArray(
    keplerPosition(jplElements("earth", centuriesSinceJ2000(date))),
  );
  const distance = (earth.length() * AU_KM) / SUN_RADIUS_KM;
  // Account for light travel before orienting the observed Sun.
  const emitted = new Date(date.getTime() - ((earth.length() * AU_KM) / 299792.458) * 1000);
  const toward = earth
    .normalize()
    .applyQuaternion(new Quaternion().fromArray(bodyOrientation("sun", emitted)).invert());
  const north = new Vector3(0, 1, 0).addScaledVector(toward, -toward.y).normalize();
  const right = new Vector3().crossVectors(north, toward).normalize();
  return { toward, north, right, distance };
}

export function solarSurface(lon, lat) {
  return new Vector3(-Math.cos(lon) * Math.cos(lat), Math.sin(lat), Math.sin(lon) * Math.cos(lat));
}

/** Perspective projection onto a unit-radius solar disc; hidden points have no sample. */
export function projectSolarPoint(point, observer) {
  const mu = point.dot(observer.toward);
  if (mu <= 1 / observer.distance) return null;
  const k = Math.sqrt(observer.distance ** 2 - 1) / (observer.distance - mu);
  return { x: point.dot(observer.right) * k, y: point.dot(observer.north) * k, mu };
}

export function sampleBilinear(data, width, x, y) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const dx = x - ix;
  const dy = y - iy;
  const row = iy * width + ix;
  return (
    (data[row] * (1 - dx) + data[row + 1] * dx) * (1 - dy) +
    (data[row + width] * (1 - dx) + data[row + width + 1] * dx) * dy
  );
}

export const smooth = (a, b, v) => {
  const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

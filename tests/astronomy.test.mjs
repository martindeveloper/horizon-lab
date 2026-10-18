import assert from "node:assert/strict";
/**
 * Positional astronomy against published worked examples and events. Every
 * expected value cites its source; tolerances reflect the documented accuracy
 * of each algorithm, not the test's convenience.
 *
 * Meeus = J. Meeus, Astronomical Algorithms, 2nd ed. (1998).
 */
import test from "node:test";

import {
  centuriesSinceJ2000,
  jplElements,
  keplerPosition,
  moonEcliptic,
  namedById,
  periodYears,
  keplerEquation,
  solarEcliptic,
} from "@horizon/toolkit/bodies";
import {
  eclipticToEquatorial,
  julianEphemerisDay,
  precess,
  siderealTime,
  toHorizontal,
} from "@horizon/toolkit/science";

import { equatorialToScene } from "../packages/toolkit/src/scene/frames.ts";
import { sunGalactic } from "../src/features/deep-field/lib/model/galactic-orbit.ts";
import {
  NEIGHBOURS,
  closestApproach,
  neighbourDistanceLy,
} from "../src/features/deep-field/lib/model/neighbours.ts";
import { galacticLaps } from "../src/features/orrery/lib/model/timeline.ts";
import { GALACTIC_YEAR, SUN_BIRTH } from "../src/space/solar-system/model/parameters.ts";

const near = (actual, expected, tolerance, label = "") =>
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${label} ${actual} is not within ${tolerance} of ${expected}`,
  );
/** Signed difference of two angles in degrees, in (−180, 180]. */
const angle = (a, b) => ((((a - b) % 360) + 540) % 360) - 180;
const hms = (h, m, s) => (h + m / 60 + s / 3600) * 15;
const dms = (d, m, s) => Math.sign(d || 1) * (Math.abs(d) + m / 60 + s / 3600);

/** Heliocentric ecliptic longitude (J2000 frame) of a JPL body at a date. */
function heliocentricLongitude(id, date) {
  const [x, , z] = keplerPosition(jplElements(id, centuriesSinceJ2000(date)));
  return ((Math.atan2(-z, x) * 180) / Math.PI + 360) % 360;
}

test("Greenwich sidereal time matches Meeus examples 12.a and 12.b", () => {
  // 1987 April 10, 0h UT: θ₀ = 13h10m46.3668s.
  near(siderealTime(new Date("1987-04-10T00:00:00Z"), 0), hms(13, 10, 46.3668), 1e-6, "12.a");
  // 1987 April 10, 19h21m UT: θ₀ = 8h34m57.0896s.
  near(siderealTime(new Date("1987-04-10T19:21:00Z"), 0), hms(8, 34, 57.0896), 1e-6, "12.b");
  // East longitude adds directly.
  const date = new Date("1987-04-10T00:00:00Z");
  near(angle(siderealTime(date, 15), siderealTime(date, 0) + 15), 0, 1e-9, "east longitude");
});

test("equatorial to horizontal coordinates match Meeus example 13.b", () => {
  // Venus from the US Naval Observatory, 1987 April 10, 19h21m UT. Apparent
  // sidereal time 8h34m56.853s at Greenwich; west longitude 77°03′56″.
  const lst = hms(8, 34, 56.853) - dms(77, 3, 56);
  const venus = toHorizontal(hms(23, 9, 16.641), dms(-6, 43, 11.61), lst, dms(38, 55, 17));
  near(venus.altitude, 15.1249, 5e-4, "altitude");
  // Meeus measures azimuth from the south: A = 68.0337°; from the north, +180°.
  near(venus.azimuth, 248.0337, 5e-4, "azimuth");
});

test("precession matches Meeus example 21.b once proper motion is removed", () => {
  // θ Persei from J2000.0 to 2028 November 13.19 TD. Meeus's result includes the
  // star's proper motion (+0.03425 s/yr, −0.0895″/yr over 28.86705 years):
  // α = 2h46m11.331s, δ = +49°20′54.54″. Removing it isolates precession.
  const years = 28.86705;
  const { ra, dec } = precess(
    hms(2, 44, 11.986),
    dms(49, 13, 42.48),
    new Date(Date.UTC(2028, 10, 13, 4, 33, 36)),
  );
  near(ra, hms(2, 46, 11.331) - (0.03425 * years * 15) / 3600, 2e-5, "α");
  near(dec, dms(49, 20, 54.54) + (0.0895 * years) / 3600, 2e-5, "δ");
});

test("the scene frame puts the ecliptic and the Galaxy where the IAU defines them", () => {
  // Scene +X is the vernal equinox, +Y the north ecliptic pole (RA 18h, δ = 90° − ε).
  const equinox = equatorialToScene(0, 0);
  near(equinox.x, 1, 1e-12);
  const pole = equatorialToScene(270, 90 - 23.4392794);
  near(pole.y, 1, 1e-9, "ecliptic pole");
  // The June solstice point lies at ecliptic longitude 90°: scene −Z.
  near(equatorialToScene(90, 23.4392794).z, -1, 1e-9, "solstice");
  // IAU galactic pole (RA 192.8595°, δ +27.1284°) is 60.19° from the ecliptic pole,
  // and the galactic centre (Sgr A*) lies in the galactic plane.
  const galacticPole = equatorialToScene(192.8595, 27.1284);
  near((Math.acos(galacticPole.y) * 180) / Math.PI, 60.19, 0.01, "galactic tilt");
  near(equatorialToScene(266.4168, -29.0078).dot(galacticPole), 0, 0.002, "centre in plane");
});

test("the Sun matches Meeus example 25.a and the 2026 equinoxes and solstices", () => {
  // 1992 October 13.0 TD (JDE 2448908.5): true λ = 199.90988°, R = 0.99766 au,
  // apparent α = 13h13m31.4s, δ = −7°47′06″. The low-precision series is ~0.01°.
  const sun = solarEcliptic(2448908.5);
  near(angle(sun.longitude, 199.90988), 0, 0.01, "λ");
  near(sun.distance, 0.99766, 2e-5, "R");
  const { ra, dec } = eclipticToEquatorial(sun.longitude, 0, sun.obliquity);
  near(angle(ra, hms(13, 13, 31.4)), 0, 0.01, "α");
  near(dec, dms(-7, 47, 6), 0.01, "δ");
  // Published instants (UTC) when the apparent longitude reaches 0°, 90°, 180°, 270°.
  for (const [iso, longitude] of [
    ["2026-03-20T14:46:00Z", 0],
    ["2026-06-21T08:24:00Z", 90],
    ["2026-09-23T00:05:00Z", 180],
    ["2026-12-21T20:50:00Z", 270],
  ]) {
    const at = solarEcliptic(julianEphemerisDay(new Date(iso))).longitude;
    near(angle(at, longitude), 0, 0.02, iso);
  }
});

test("the Moon is new at every published 2026 new moon and keeps to its distance range", () => {
  // UTC instants of new moon, 2026 (IMCCE/USNO). Elongation must be ~0.
  for (const iso of [
    "2026-01-18T19:52:00Z",
    "2026-02-17T12:01:00Z",
    "2026-03-19T01:23:00Z",
    "2026-04-17T11:52:00Z",
    "2026-05-16T20:01:00Z",
    "2026-06-15T02:54:00Z",
    "2026-07-14T09:44:00Z",
    "2026-08-12T17:37:00Z",
    "2026-09-11T03:27:00Z",
    "2026-10-10T15:50:00Z",
    "2026-11-09T07:02:00Z",
    "2026-12-09T00:52:00Z",
  ]) {
    const jde = julianEphemerisDay(new Date(iso));
    near(angle(moonEcliptic(jde).longitude, solarEcliptic(jde).longitude), 0, 0.03, iso);
  }
  // Geocentric distance stays within the known extremes (356,400–406,700 km).
  let min = Infinity;
  let max = 0;
  for (let hour = 0; hour < 365 * 24; hour += 1) {
    const { distance } = moonEcliptic(julianEphemerisDay(new Date(Date.UTC(2026, 0, 1, hour))));
    min = Math.min(min, distance);
    max = Math.max(max, distance);
  }
  assert.ok(min > 356_400 && min < 357_500, `perigee ${min}`);
  assert.ok(max > 405_800 && max < 406_700, `apogee ${max}`);
});

test("Kepler's equation is solved to machine precision across eccentricities", () => {
  for (const e of [0, 0.0167, 0.2, 0.5, 0.9, 0.967, 0.99]) {
    for (let k = 0; k <= 36; k += 1) {
      const M = (k / 36) * 2 * Math.PI;
      const E = keplerEquation.compute({ M, e });
      const residual = E - e * Math.sin(E) - (M % (2 * Math.PI));
      near(Math.abs(Math.sin(residual / 2)), 0, 1e-11, `e=${e} M=${M}`);
    }
  }
});

test("the JPL Earth agrees with the Almanac Sun once the equinox of date is removed", () => {
  // Two independent algorithms: JPL elements give Earth in the fixed J2000 frame;
  // the Almanac series gives the Sun's apparent longitude of date. Earth sits
  // opposite the Sun; general precession (5029.0966″ per century, IAU 2006)
  // and aberration (−20.5″) separate them.
  for (let step = 0; step < 300; step += 1) {
    const date = new Date(Date.UTC(1990, 0, 1) + step * 41.7 * 86_400_000);
    const T = centuriesSinceJ2000(date);
    const sun = solarEcliptic(julianEphemerisDay(date));
    const precession = (5029.0966 * T) / 3600;
    const expected = sun.longitude + 180 - precession + 20.5 / 3600;
    near(angle(heliocentricLongitude("earth", date), expected), 0, 0.015, date.toISOString());
    const [x, y, z] = keplerPosition(jplElements("earth", T));
    near(Math.hypot(x, y, z), sun.distance, 1e-4, "Sun–Earth distance");
  }
});

test("planets reach opposition on the published 2026–27 dates", () => {
  // At opposition a planet and Earth share a heliocentric longitude.
  // Dates from the USNO/NASA almanac; a day of error is under 1°.
  for (const [id, iso] of [
    ["jupiter", "2026-01-10T12:00:00Z"],
    ["neptune", "2026-09-26T12:00:00Z"],
    ["saturn", "2026-10-04T12:00:00Z"],
    ["uranus", "2026-11-25T12:00:00Z"],
    ["mars", "2027-02-19T12:00:00Z"],
  ]) {
    const date = new Date(iso);
    near(angle(heliocentricLongitude(id, date), heliocentricLongitude("earth", date)), 0, 0.6, id);
  }
});

test("orbital periods follow Kepler's third law to the measured sidereal periods", () => {
  // Sidereal periods in years (NASA planetary fact sheets).
  for (const [id, period] of [
    ["mercury", 0.2408],
    ["venus", 0.6152],
    ["earth", 1.0],
    ["mars", 1.8809],
    ["jupiter", 11.862],
    ["saturn", 29.457],
    ["uranus", 84.011],
    ["neptune", 164.79],
  ]) {
    const computed = periodYears(jplElements(id, 0).a);
    // P² = a³ ignores the planet's own mass (Jupiter: 0.1 %); 0.15 % covers it.
    near(computed / period, 1, 0.0015, id);
  }
});

test("comets and dwarf planets pass perihelion where and when they did or will", () => {
  const distance = (elements) => Math.hypot(...keplerPosition(elements));
  // Halley: perihelion 1986 February 9, q = 0.587 au.
  near(distance(namedById("halley").elementsAt(new Date("1986-02-09T00:00:00Z"), 0)), 0.587, 0.005);
  // Pluto (JPL table): perihelion 1989 September 5, q = 29.66 au.
  const pluto = (iso) => jplElements("pluto", centuriesSinceJ2000(new Date(iso)));
  near(distance(pluto("1989-09-05T00:00:00Z")), 29.66, 0.05, "Pluto q");
  // Sedna: perihelion about 2076, q ≈ 76.2 au.
  near(distance(namedById("sedna").elementsAt(new Date("2076-07-01T00:00:00Z"), 0)), 76.2, 0.3);
});

test("nearby stars sit at their measured distances and meet their published encounters", () => {
  const star = (id) => NEIGHBOURS.find((s) => s.id === id);
  // Proxima Centauri: 4.2465 ly (Gaia DR3 parallax 768.07 mas).
  near(neighbourDistanceLy(star("proxima"), 0), 4.2465, 0.002, "Proxima");
  // α Centauri AB (Akeson et al. 2021): closest, ~3.1 ly, in ~28,000 years on the
  // straight line (cf. Bobylev 2010: 0.91 pc at 28.4 kyr on an integrated orbit).
  const alpha = closestApproach(star("alphaCen"));
  near(alpha.ly, 3.15, 0.15, "α Cen distance");
  near(-alpha.yearsAgo, 28_000, 1_500, "α Cen time");
  // Barnard's Star: ~3.75 ly in ~9,800 years (Bobylev 2010: 1.148 pc, 9.8 kyr).
  const barnard = closestApproach(star("barnard"));
  near(barnard.ly, 3.75, 0.1, "Barnard distance");
  near(-barnard.yearsAgo, 9_800, 500, "Barnard time");
  // Scholz's Star passed through the outer Oort cloud ~70–80 kyr ago
  // (Mamajek et al. 2015: 0.82 ly, 70 +15/−10 kyr; Dupuy et al. 2019: 68.7 kau ≈ 1.09 ly,
  // 80.5 kyr; straight-line track here).
  const scholz = closestApproach(star("scholz"));
  assert.ok(scholz.ly > 0.6 && scholz.ly < 1.2, `Scholz distance ${scholz.ly}`);
  assert.ok(scholz.yearsAgo > 60_000 && scholz.yearsAgo < 85_000, `Scholz time ${scholz.yearsAgo}`);
});

test("the Sun's galactic orbit closes once per galactic year", () => {
  const today = sunGalactic(0);
  near(today[0], 27_000, 1e-9);
  near(today[1], 68, 1e-9);
  near(today[2], 0, 1e-9);
  /* One galactic year back the Sun is at the same angle; its epicycles keep their own clocks. */
  const lap = sunGalactic(GALACTIC_YEAR);
  near(Math.atan2(-lap[2], lap[0]), 0, 1e-9, "back after one lap");
  near(galacticLaps(0), SUN_BIRTH / GALACTIC_YEAR, 1e-12);
});

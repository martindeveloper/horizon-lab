import assert from "node:assert/strict";
import test from "node:test";

import {
  durationQuantity,
  lengthQuantity,
  AU_LIGHT_SECONDS,
  LIGHT_YEAR_AU,
  PARSEC_AU,
  convert,
  convertDistance,
  formatDistance,
  formatDistanceRange,
  formatSignificant,
  resolveDistanceUnit,
  PLANCK_2018,
  RAD_PER_DEG,
  angularSeparation,
  comovingDistanceMpc,
  cosmicAgeAtRedshiftGyr,
  cosmicAgeGyr,
  particleHorizonMpc,
  redshiftAtComovingDistance,
  redshiftAtLookback,
  hubbleLaw,
  hubbleTimeGyr,
  resonanceSemiMajorAxis,
  scaleFactorAtAge,
  lightTime,
  readout,
  scaleMagnitude,
  AU_KM,
  LIGHT_YEAR_KM,
  J2000_JD,
  julianDay,
  DELTA_T_SECONDS,
  JULIAN_CENTURY_DAYS,
  eclipticToEquatorial,
  equatorialToGalactic,
  hourAngle,
  julianEphemerisDay,
  lookbackTimeGyr,
  precess,
  risingHourAngle,
  siderealTime,
  toHorizontal,
} from "@horizon/toolkit/science";

const near = (actual, expected, tolerance) =>
  assert.ok(Math.abs(actual - expected) < tolerance, `${actual} vs ${expected}`);

test("scientific scaling handles boundaries, negative durations and nonfinite inputs", () => {
  assert.deepEqual(durationQuantity(1), { value: 1, unit: "s", digits: 2 });
  assert.equal(durationQuantity(0.000999).unit, "μs");
  assert.equal(durationQuantity(-60).value, -1);
  assert.equal(durationQuantity(-60).unit, "min");
  assert.equal(durationQuantity(86400).unit, "days");
  assert.equal(durationQuantity(31557600).unit, "years");
  assert.equal(lengthQuantity(AU_KM).unit, "au");
  assert.equal(lengthQuantity(-LIGHT_YEAR_KM).value, -1);
  assert.equal(scaleMagnitude(1e6).scale, "million");
  assert.throws(() => durationQuantity(NaN), RangeError);
});

test("distance units convert through exact IAU definitions and read out consistently", () => {
  assert.ok(Math.abs(AU_LIGHT_SECONDS - 499.004784) < 1e-6);
  assert.ok(Math.abs(LIGHT_YEAR_AU - 63241.077) < 0.001);
  assert.ok(Math.abs(PARSEC_AU - 206264.806) < 0.001);
  assert.ok(Math.abs(convertDistance(1, "pc", "ly") - 3.26156) < 1e-5);
  assert.equal(convertDistance(convertDistance(42, "ly", "au"), "au", "ly"), 42);
  assert.throws(() => convertDistance(Number.NaN, "au", "ly"), RangeError);

  assert.deepEqual(readout(5.374), { mantissa: 5.374, exponent: 0, digits: 2 });
  const tiny = readout(convertDistance(5.37, "au", "ly"));
  assert.equal(tiny.exponent, -5);
  assert.ok(Math.abs(tiny.mantissa - 8.49) < 0.01);
  // 9.996 × 10⁻⁵ rounds up into the next decade rather than printing "10.00".
  const edge = readout(9.996e-5);
  assert.equal(edge.exponent, -4);
  assert.ok(Math.abs(edge.mantissa - 0.9996) < 1e-9);

  const earth = lightTime(1);
  assert.equal(earth.unit, "min");
  assert.ok(Math.abs(earth.value - 8.3167464) < 1e-6);
  assert.equal(lightTime(30.1).unit, "h");
  const symbols = { au: "au", ly: "ly", pc: "pc" };
  const at = (au, unit) =>
    formatDistance(au, { unit, locale: "en", symbols, lightTimeLabel: "light-time" });
  assert.equal(at(9.32, "au"), "9.32 au · light-time 78 min");
  assert.equal(at(30.1, "au"), "30.1 au · light-time 4.2 h");
  assert.equal(at(5.37, "ly"), "8.49 × 10⁻⁵ ly · light-time 45 min");
  assert.equal(at(268_000, "pc"), "1.3 pc");
  assert.equal(at(0.1, "au"), "0.1 au");
  const steady = (au) =>
    formatDistance(au, {
      unit: "au",
      locale: "en",
      symbols,
      lightTimeLabel: "light-time",
      fixed: true,
    });
  assert.equal(steady(1), "1.00 au · light-time 8.3 min");
  assert.equal(steady(1.0822), "1.08 au · light-time 9.0 min");
});

test("literature values keep their significant figures through a unit change", () => {
  assert.equal(formatSignificant(18_396, "en", 2), "18,000");
  assert.equal(formatSignificant(4.344, "cs", 3), "4,34");
  assert.equal(formatSignificant(0.0316, "en", 2), "0.032");
  assert.equal(formatSignificant(5.4e16, "en", 1), "5 × 10¹⁶");
  assert.equal(formatSignificant(1e17, "en", 1), "10¹⁷");
  assert.equal(formatSignificant(149_597_870_700, "en", 12), "149,597,870,700");
  assert.equal(formatSignificant(2, "en", 2), "2");
  assert.equal(formatSignificant(2, "cs", 2, true), "2,0");
  assert.equal(formatSignificant(3.79e9, "en", 2), "3.8 × 10⁹");
  const symbols = { au: "au", ly: "ly", pc: "pc" };
  const options = (unit) => ({ unit, locale: "en", symbols, millionWord: "million" });
  const words = { ...options("ly"), billionWord: "billion" };
  assert.equal(formatDistance(1.09e9 * LIGHT_YEAR_AU, words), "1.09 billion ly");
  assert.equal(formatDistance(1.09e9 * LIGHT_YEAR_AU, options("ly")), "1,090 million ly");
  assert.equal(
    formatDistanceRange(0.5e9 * LIGHT_YEAR_AU, 1.5e9 * LIGHT_YEAR_AU, words),
    "0.5–1.5 billion ly",
  );
  assert.equal(
    formatDistance(0.998e9 * LIGHT_YEAR_AU, { ...words, significant: 2 }),
    "1 billion ly",
  );
  /* A fixed readout keeps its digit count across the step: no "1.000 million ly". */
  const fixed = { ...options("ly"), fixed: true };
  assert.equal(
    formatDistance(999_700 * LIGHT_YEAR_AU, fixed),
    formatDistance(1_000_000 * LIGHT_YEAR_AU, fixed),
  );
  assert.equal(
    formatDistance(0.9997e9 * LIGHT_YEAR_AU, { ...words, fixed: true }),
    formatDistance(1e9 * LIGHT_YEAR_AU, { ...words, fixed: true }),
  );
  const ly = 60_000 * LIGHT_YEAR_AU;
  assert.equal(formatDistance(ly, { ...options("pc"), significant: 2 }), "18,000 pc");
  assert.equal(formatDistance(ly, { ...options("ly"), significant: 2 }), "60,000 ly");
  assert.equal(
    formatDistance(10e6 * LIGHT_YEAR_AU, { ...options("ly"), significant: 2 }),
    "10 million ly",
  );
  assert.equal(formatDistance(convert(1, "Mly", "au"), options("ly")), "1 million ly");
  assert.equal(formatDistanceRange(2.1, 3.3, { ...options("au"), significant: 2 }), "2.1–3.3 au");
  assert.equal(
    formatDistanceRange(0.5e6 * LIGHT_YEAR_AU, 2e6 * LIGHT_YEAR_AU, {
      ...options("ly"),
      significant: 2,
    }),
    "0.5–2 million ly",
  );
  assert.equal(
    formatDistanceRange(2_000, 5_000, { ...options("ly"), significant: 1 }),
    "0.03–0.08 ly",
  );
});

test("Julian dates match the J2000 epoch", () => {
  assert.equal(julianDay(new Date("2000-01-01T12:00:00Z")), J2000_JD);
  assert.equal(julianDay(new Date("1970-01-01T00:00:00Z")), 2_440_587.5);
  const date = new Date("2026-10-18T18:00:00Z");
  near(julianEphemerisDay(date) - julianDay(date), DELTA_T_SECONDS / 86_400, 1e-9);
  assert.equal(JULIAN_CENTURY_DAYS, 36_525);
});

test("sky coordinates: angles wrap, poles and the equator behave, conversions invert", () => {
  assert.equal(RAD_PER_DEG, Math.PI / 180);
  // Sidereal time stays in 0…360 at any instant and longitude.
  for (const iso of ["1900-01-01T00:00:00Z", "2000-01-01T12:00:00Z", "2100-12-31T23:59:59Z"])
    for (const longitude of [-180, -14.78, 0, 14.78, 180]) {
      const lst = siderealTime(new Date(iso), longitude);
      assert.ok(lst >= 0 && lst < 360, `${iso} ${longitude}: ${lst}`);
    }
  // Hour angle: −180…180, negative before the meridian.
  assert.equal(hourAngle(10, 30), -20);
  assert.equal(hourAngle(350, 10), -20);
  assert.equal(hourAngle(10, 350), 20);
  // The celestial pole stands at the latitude, due north; the equator crosses the meridian at 90° − φ.
  const pole = toHorizontal(0, 90, 123, 49.9);
  near(pole.altitude, 49.9, 1e-9);
  assert.ok(Math.abs(((pole.azimuth + 180) % 360) - 180) < 1e-6);
  const meridian = toHorizontal(40, 0, 40, 49.9);
  near(meridian.altitude, 40.1, 1e-9);
  near(meridian.azimuth, 180, 1e-9);
  // The ecliptic north pole sits at RA 270°, Dec 90° − ε; the equinox stays put.
  const eclipticPole = eclipticToEquatorial(0, 90, 23.44);
  near(eclipticPole.ra, -90, 1e-9);
  near(eclipticPole.dec, 90 - 23.44, 1e-9);
  near(eclipticToEquatorial(0, 0, 23.44).ra, 0, 1e-12);
  // At J2000 precession is the identity.
  const still = precess(101.287, -16.716, new Date("2000-01-01T12:00:00Z"));
  near(still.ra, 101.287, 1e-6);
  near(still.dec, -16.716, 1e-6);
  // Rising: a quarter turn on the equator; the horizon offset narrows the arc.
  near(risingHourAngle(0, 0), 90, 1e-9);
  assert.ok(risingHourAngle(0, 49.9, 10) < 90);
  assert.equal(risingHourAngle(89, 49.9), 180);
  assert.equal(risingHourAngle(-89, 49.9), 0);
  // Galactic coordinates: the pole and M87 (l 283.78°, b 74.49°); the equinox at l 96.34°, b −60.19°.
  near(equatorialToGalactic(192.85948, 27.12825).b, 90, 1e-9);
  const m87 = equatorialToGalactic(187.7059, 12.3911);
  near(m87.l, 283.78, 0.01);
  near(m87.b, 74.49, 0.01);
  const equinox = equatorialToGalactic(0, 0);
  near(equinox.l, 96.34, 0.01);
  near(equinox.b, -60.19, 0.01);
});

test("sky angles, resonances and Hubble's law compute from the shared laws", () => {
  assert.equal(RAD_PER_DEG, Math.PI / 180);
  const near = (actual, expected, tolerance) =>
    assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} vs ${expected}`);
  near(angularSeparation.compute({ ra1: 10, dec1: 90, ra2: 200, dec2: 0 }), 90, 1e-9);
  near(angularSeparation.compute({ ra1: 0, dec1: 0, ra2: 1e-6, dec2: 0 }), 1e-6, 1e-15);
  /* Proxima and α Cen AB (Gaia DR3, Akeson 2021): 2.19°. */
  near(
    angularSeparation.compute({ ra1: 217.4289, dec1: -62.6795, ra2: 219.8994, dec2: -60.8354 }),
    2.19,
    0.01,
  );
  near(resonanceSemiMajorAxis.compute({ ap: 5.2026, k: 1 / 4 }), 2.065, 0.001);
  near(resonanceSemiMajorAxis.compute({ ap: 30.07, k: 3 / 2 }), 39.4, 0.01);
  near(hubbleLaw.compute({ v: 6_766, H0: 67.66 }), 100, 1e-9);
});

test("flat ΛCDM: Planck 2018 gives a 13.8-billion-year Universe and a(t) inverts t(a)", () => {
  const near = (actual, expected, tolerance) =>
    assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} vs ${expected}`);
  near(hubbleTimeGyr(PLANCK_2018.H0), 977.79 / 67.66, 0.01);
  const age = cosmicAgeGyr(1);
  near(age, 13.79, 0.02);
  near(scaleFactorAtAge(age), 1, 1e-12);
  near(scaleFactorAtAge(age - 10), 0.37, 0.02);
  for (const a of [0.1, 0.5, 0.9]) near(scaleFactorAtAge(cosmicAgeGyr(a)), a, 1e-12);
  // Comoving distance: Hubble's law while z is small, 3.40 Gpc at z = 1 for these parameters.
  near(comovingDistanceMpc(0.001), hubbleLaw.compute({ v: 299.792458, H0: 67.66 }), 0.01);
  near(comovingDistanceMpc(1), 3_396, 2);
  assert.equal(comovingDistanceMpc(0), 0);
  // Lookback time: none today, the whole age at the Big Bang's edge.
  assert.equal(lookbackTimeGyr(0), 0);
  near(lookbackTimeGyr(1e6), cosmicAgeAtRedshiftGyr(0), 1e-3);
  near(lookbackTimeGyr(0.08), 1.09, 0.01);
  // Back to the Big Bang: last scattering (z∗ = 1089.80) at Planck's 13,885 Mpc, the edge at
  // ~14.2 Gpc, ~372,000 years after the Big Bang; today's age agrees with Planck's 13.787 Gyr.
  near(comovingDistanceMpc(1089.8), 13_885, 15);
  near(particleHorizonMpc(), 14_160, 30);
  near(cosmicAgeAtRedshiftGyr(1089.8) * 1e9, 372_000, 5_000);
  near(cosmicAgeAtRedshiftGyr(0), 13.787, 0.005);
  near(cosmicAgeAtRedshiftGyr(1), cosmicAgeGyr(0.5), 0.01);
  // The closed form leaves radiation out: about 5.6 million years older.
  near(cosmicAgeGyr(1) - cosmicAgeAtRedshiftGyr(0), 0.0056, 0.0005);
  // Without radiation the integral still starts cleanly at the Big Bang.
  near(cosmicAgeAtRedshiftGyr(0, { H0: 67.66, omegaM: 0.3111 }), cosmicAgeGyr(1), 1e-6);
  // Lookback inverts, and so does the comoving distance (Infinity at the horizon).
  for (const t of [1, 5, 10]) near(lookbackTimeGyr(redshiftAtLookback(t)), t, 1e-9);
  for (const z of [0.004, 0.073, 1, 1089.8])
    near(redshiftAtComovingDistance(comovingDistanceMpc(z)) / z, 1, 1e-6);
  assert.equal(redshiftAtComovingDistance(0), 0);
  assert.equal(redshiftAtComovingDistance(particleHorizonMpc()), Number.POSITIVE_INFINITY);
});

test("auto distances read in au inside half a light-year and in ly beyond", () => {
  const symbols = { au: "au", ly: "ly", pc: "pc" };
  const auto = { unit: "auto", locale: "en", symbols, millionWord: "million" };
  assert.equal(resolveDistanceUnit("auto", 30), "au");
  assert.equal(resolveDistanceUnit("auto", LIGHT_YEAR_AU), "ly");
  assert.equal(resolveDistanceUnit("pc", 30), "pc");
  assert.equal(formatDistance(5_000, auto), "5,000 au");
  assert.equal(formatDistance(4.24 * LIGHT_YEAR_AU, auto), "4.24 ly");
  assert.equal(formatDistance(53.8e6 * LIGHT_YEAR_AU, auto), "53.8 million ly");
  assert.equal(formatDistanceRange(100_000, 200_000, { ...auto, significant: 2 }), "1.6–3.2 ly");
});

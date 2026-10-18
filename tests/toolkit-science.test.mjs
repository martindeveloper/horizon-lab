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
  lightTime,
  readout,
  scaleMagnitude,
  AU_KM,
  LIGHT_YEAR_KM,
  J2000_JD,
  julianDay,
} from "@horizon/toolkit/science";

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
  assert.equal(formatSignificant(3.79e9, "en", 2), "3.8 × 10⁹");
  const symbols = { au: "au", ly: "ly", pc: "pc" };
  const options = (unit) => ({ unit, locale: "en", symbols, millionWord: "million" });
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
});

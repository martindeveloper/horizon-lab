import assert from "node:assert/strict";
/**
 * The orrery's bodies against published values: spin axes and rates (IAU
 * WGCCRE 2015, Archinal et al. 2018; NASA planetary fact sheets), figures,
 * ring radii, the major moons' orbits against JPL Horizons, and the painted
 * maps' colours, brightness and coastlines.
 */
import test from "node:test";

import { Vector3 } from "three";

import {
  EARTH_EQUATORIAL_RADIUS_KM,
  FIGURES,
  LUNAR_EQUATOR_INCLINATION_DEG,
  MOONS,
  PLANET_IDS,
  PLANET_RADIUS_KM,
  RINGS,
  SPINS,
  centuriesSinceJ2000,
  ephemerisSelfCheck,
  flattening,
  jplElements,
  keplerPosition,
  meanLongitude,
  meanRates,
  orbitShape,
  ringStrip,
  ringExposure,
  ringStripLevels,
} from "@horizon/toolkit/bodies";
import {
  GEOMETRIC_ALBEDO,
  GREAT_RED_SPOT,
  earthLandFraction,
  surfaceMap,
} from "@horizon/toolkit/bodies/surfaces";
import {
  bodyOrientation,
  equatorialFrameToScene,
  equatorialToScene,
  poleVector,
} from "@horizon/toolkit/scene";

import { moonOffset, moonOrientation } from "../src/space/solar-system/graphics/moons.ts";
import { moonOrbitShape } from "../src/space/solar-system/model/moon-orbits.ts";

const near = (actual, expected, tolerance, label = "") =>
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${label} ${actual} is not within ${tolerance} of ${expected}`,
  );
const RAD = Math.PI / 180;
const T2026 = centuriesSinceJ2000(new Date("2026-10-15T00:00:00Z"));

/** Spin angular momentum: the IAU north pole, flipped for a retrograde rotator. */
function spinAxis(id) {
  const pole = poleVector(id, T2026);
  return SPINS[id].meridian(1) < SPINS[id].meridian(0) ? pole.negate() : pole;
}
function orbitNormal(id) {
  const el = jplElements(id, T2026);
  const i = el.i * RAD;
  const node = el.node * RAD;
  return new Vector3(Math.sin(i) * Math.sin(node), Math.cos(i), Math.sin(i) * Math.cos(node));
}

test("axial tilts match the planetary fact sheets, retrograde rotators included", () => {
  // NASA NSSDC fact sheets, obliquity to orbit; Pluto from the IAU 2015 pole (119.6°).
  const tilt = {
    mercury: 0.034,
    venus: 177.36,
    earth: 23.44,
    mars: 25.19,
    jupiter: 3.13,
    saturn: 26.73,
    uranus: 97.77,
    neptune: 28.32,
    pluto: 119.6,
  };
  for (const [id, expected] of Object.entries(tilt))
    near(Math.acos(spinAxis(id).dot(orbitNormal(id))) / RAD, expected, 0.1, id);
  // The Sun's equator is inclined 7.25° to the ecliptic.
  near(Math.acos(poleVector("sun", T2026).y) / RAD, 7.25, 0.02, "sun");
});

test("sidereal rotation periods match current measurements", () => {
  const hours = (id) => (360 * 24) / (SPINS[id].meridian(1) - SPINS[id].meridian(0));
  near(hours("sun") / 24, 25.38, 0.01, "Sun (Carrington)");
  near(hours("mercury") / 24, 58.6462, 0.001, "Mercury");
  near(hours("venus") / 24, -243.0226, 0.001, "Venus (Margot et al. 2021)");
  near(hours("earth"), 23.9345, 0.0001, "Earth");
  near(hours("mars"), 24.6229, 0.0001, "Mars");
  near(hours("jupiter"), 9.925, 0.0005, "Jupiter System III");
  near(hours("saturn"), 10 + 33 / 60 + 38 / 3600, 0.0005, "Saturn (Mankovich et al. 2019)");
  near(hours("uranus"), -17.247864, 0.00001, "Uranus (Lamy et al. 2025)");
  near(hours("neptune"), 15.9663, 0.0005, "Neptune (Karkoschka 2011, adopted by the IAU in 2015)");
  near(hours("pluto") / 24, 6.3872, 0.0001, "Pluto");
});

test("figures: IAU radii, flattening of the oblate planets", () => {
  near(PLANET_RADIUS_KM.mercury, 2439.4, 0.05, "Mercury mean radius (IAU 2015)");
  for (const id of PLANET_IDS) {
    const { meanKm, equatorialKm, polarKm } = FIGURES[id];
    assert.equal(meanKm, PLANET_RADIUS_KM[id], id);
    near(Math.cbrt(equatorialKm ** 2 * polarKm) / meanKm, 1, 2e-4, `${id} volume`);
  }
  near(flattening("earth"), 1 / 298.257, 2e-5, "Earth");
  near(flattening("mars"), 0.00589, 2e-5, "Mars");
  near(flattening("jupiter"), 0.06499, 2e-5, "Jupiter (Juno 1-bar figure)");
  near(flattening("saturn"), 0.09796, 2e-5, "Saturn");
  near(flattening("uranus"), 0.02293, 2e-5, "Uranus");
  near(flattening("neptune"), 0.01708, 2e-5, "Neptune");
  near(FIGURES.sun.meanKm, 695_700, 1, "nominal solar radius");
  near(FIGURES.pluto.meanKm, 1188.3, 0.1, "Pluto (New Horizons)");
});

test("the Earth turns to today's angle: Greenwich faces the sidereal time", () => {
  // Meeus 12: GMST at J2000.0 (2000 Jan 1, 12h UT) is 280.4606°.
  const date = new Date("2000-01-01T12:00:00Z");
  const greenwich = new Vector3(-1, 0, 0).applyQuaternion(bodyOrientation("earth", date));
  const angle = Math.acos(Math.min(1, greenwich.dot(equatorialToScene(280.4606, 0)))) / RAD;
  assert.ok(angle < 0.5, `Greenwich is ${angle}° off`);
  const north = new Vector3(0, 1, 0).applyQuaternion(bodyOrientation("earth", date));
  assert.ok(north.angleTo(equatorialToScene(0, 90)) / RAD < 0.01);
});

test("rings: Saturn's divisions and Uranus's epsilon ring sit at their radii", () => {
  const texels = 1024;
  const at = (system, km) => {
    const t = Math.floor(((km - system.innerKm) / (system.outerKm - system.innerKm)) * texels);
    return ringStrip(system, texels).opacity[t];
  };
  const saturn = RINGS.saturn;
  assert.ok(at(saturn, 105_000) > 0.9, "B ring is nearly opaque");
  assert.ok(at(saturn, 80_000) < 0.15, "C ring is thin");
  assert.ok(at(saturn, 119_500) < 0.15, "Cassini Division");
  assert.ok(at(saturn, 133_589) < at(saturn, 132_000) / 2, "Encke gap");
  assert.ok(at(saturn, 138_000) < 0.01, "Roche division");
  near(136_770 / FIGURES.saturn.equatorialKm, 2.269, 0.001, "A ring edge in Saturn radii");
  const uranus = RINGS.uranus;
  assert.ok(at(uranus, 51_149) > 0.5, "ε ring");
  assert.ok(at(uranus, 50_500) === 0, "gap inside ε");
  assert.equal(RINGS.jupiter, undefined, "Jupiter's τ ≈ 5 × 10⁻⁶ rings stay undrawn");
});

test("rings: Neptune's faint dusty rings survive the strip and its mipmaps", () => {
  const neptune = RINGS.neptune;
  const levels = ringStripLevels(neptune, 1024);
  const strip = levels[0];
  const at = (km) =>
    Math.floor(((km - neptune.innerKm) / (neptune.outerKm - neptune.innerKm)) * strip.texels);
  near(strip.opacity[at(41_900)], 1e-4, 1e-6, "Galle, τ ≈ 10⁻⁴");
  near(strip.dust[at(41_900)], 0.55, 1e-6, "Galle's dust");
  assert.equal(strip.opacity[at(50_000)], 0, "the gap inside Lassell");
  assert.equal(levels.at(-1).texels, 1, "the chain ends at one texel");
  const total = (level) => level.opacity.reduce((sum, a) => sum + a, 0) / level.texels;
  for (const level of levels)
    near(total(level), total(strip), 1e-6, `mean opacity at ${level.texels}`);
  const weighted = (level) =>
    level.opacity.reduce((sum, a, t) => sum + a * level.dust[t], 0) / level.texels;
  near(weighted(levels.at(-1)), weighted(strip), 1e-7, "dust, weighted by opacity, is kept");
});

test("rings: a long exposure lifts only the systems darker than Saturn's", () => {
  assert.equal(ringExposure(RINGS.saturn), 1);
  const uranus = ringExposure(RINGS.uranus);
  const neptune = ringExposure(RINGS.neptune);
  assert.ok(uranus > 10 && uranus < 30, `Uranus ${uranus}`);
  assert.ok(neptune > 20 * uranus, `Neptune's dusty rings are far fainter: ${neptune}`);
});

const W = 128;
const H = 64;
const linear = (c) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
/** Area-weighted mean linear colour and luminance of a map. */
function mean(id) {
  const px = surfaceMap(id, W, H);
  let r = 0;
  let g = 0;
  let b = 0;
  let total = 0;
  for (let y = 0; y < H; y += 1) {
    const weight = Math.cos((90 - ((y + 0.5) / H) * 180) * RAD);
    for (let x = 0; x < W; x += 1) {
      const i = (y * W + x) * 4;
      r += linear(px[i]) * weight;
      g += linear(px[i + 1]) * weight;
      b += linear(px[i + 2]) * weight;
      total += weight;
    }
  }
  r /= total;
  g /= total;
  b /= total;
  return { r, g, b, luminance: 0.2126 * r + 0.7152 * g + 0.0722 * b };
}

test("map brightness follows each body's geometric albedo", () => {
  for (const [id, albedo] of Object.entries(GEOMETRIC_ALBEDO)) {
    const ratio = mean(id).luminance / albedo;
    assert.ok(ratio > 0.8 && ratio < 1.5, `${id}: luminance / albedo = ${ratio}`);
  }
});

test("true colours: butterscotch Mars, Uranus and Neptune alike, Neptune a little bluer", () => {
  const mars = mean("mars");
  assert.ok(mars.g / mars.r > 0.45 && mars.b / mars.r < 0.45, "Mars is tan, not red");
  const uranus = mean("uranus");
  const neptune = mean("neptune");
  near(neptune.luminance / uranus.luminance, 1, 0.2, "similar lightness");
  assert.ok(neptune.b / neptune.g > uranus.b / uranus.g, "Neptune bluer");
  assert.ok(uranus.g > uranus.r && neptune.g > neptune.r, "both greenish blue, not deep blue");
});

test("Earth's coastlines enclose 29 % land; the Great Red Spot has its current size", () => {
  near(earthLandFraction(256, 128), 0.292, 0.015, "land fraction");
  const kmPerDeg = (FIGURES.jupiter.equatorialKm * Math.PI) / 180;
  const long = GREAT_RED_SPOT.longDeg * kmPerDeg * Math.cos(GREAT_RED_SPOT.lat * RAD);
  assert.ok(long > 13_000 && long < 17_000, `GRS ${long} km long`);
});

test("moons: IAU mean radii and sidereal periods", () => {
  // IAU WGCCRE 2015 (Archinal et al. 2018); Charon from New Horizons.
  const radius = {
    moon: 1737.4,
    phobos: 11.08,
    deimos: 6.2,
    io: 1821.49,
    europa: 1560.8,
    ganymede: 2631.2,
    callisto: 2410.3,
    mimas: 198.2,
    enceladus: 252.1,
    tethys: 531.1,
    dione: 561.4,
    rhea: 763.5,
    titan: 2574.76,
    iapetus: 734.3,
    miranda: 235.8,
    ariel: 578.9,
    umbriel: 584.7,
    titania: 788.9,
    oberon: 761.4,
    triton: 1352.6,
    charon: 606,
  };
  // NSSDC satellite fact sheets, days; Triton's is retrograde.
  const period = {
    moon: 27.321661,
    phobos: 0.31891023,
    deimos: 1.2624407,
    io: 1.769138,
    europa: 3.551181,
    ganymede: 7.154553,
    callisto: 16.689018,
    mimas: 0.9424218,
    enceladus: 1.370218,
    tethys: 1.887802,
    dione: 2.736915,
    rhea: 4.5175,
    titan: 15.945421,
    iapetus: 79.330183,
    miranda: 1.413479,
    ariel: 2.520379,
    umbriel: 4.144176,
    titania: 8.705867,
    oberon: 13.463234,
    triton: 5.876854,
    charon: 6.387221,
  };
  assert.deepEqual(MOONS.map((m) => m.id).sort(), Object.keys(radius).sort());
  for (const moon of MOONS) {
    near(FIGURES[moon.id].meanKm, radius[moon.id], 0.01, moon.id);
    // Inertial rate along the orbit: dM/dt + dω/dt + dΩ/dt · cos i.
    const rates = meanRates(moon);
    const turn = rates.M + rates.omega + rates.node * Math.cos(moon.i * RAD);
    near(360 / turn, period[moon.id], period[moon.id] * 3e-5, `${moon.id} period`);
  }
});

test("moons sit where JPL Horizons puts them today", () => {
  // Horizons planet-centred ICRF vectors (km) for 2026-10-15 00:00 TDB: DE441/LE441,
  // MAR099, JUP365, SAT441, URA184, NEP097, PLU060.
  const horizons = {
    moon: [-128_936.0, -334_443.7, -182_898.8],
    phobos: [-5_640.2, -7_566.3, -842.6],
    deimos: [-21_450.2, -4_733.1, 8_225.6],
    io: [254_581.1, 300_375.9, 147_380.7],
    europa: [-559_924.8, -320_120.3, -162_863.7],
    ganymede: [986_502.4, 362_873.3, 190_067.5],
    callisto: [-1_782_107.0, 590_853.7, 251_952.9],
    mimas: [159_409.6, -87_847.6, -2_224.2],
    enceladus: [232_544.6, -42_434.4, -16_870.8],
    tethys: [-205_093.1, 211_547.3, -2_791.3],
    dione: [-376_072.0, 2_661.9, 32_058.3],
    rhea: [174_129.3, 494_679.0, -53_121.7],
    titan: [1_108_664.4, -418_700.5, -70_154.1],
    iapetus: [3_059_929.4, -1_410_485.1, -870_214.7],
    miranda: [123_178.4, -40_359.9, 8_207.9],
    ariel: [70_818.5, -62_128.2, 166_157.1],
    umbriel: [256_138.5, -65_718.8, 30_271.7],
    titania: [401_587.7, -44_922.2, -164_097.8],
    oberon: [325_631.8, 58_886.6, -479_858.3],
    triton: [-231_759.2, -225_181.6, -146_460.0],
    charon: [13_430.2, 11_206.9, -8_829.0],
  };
  const date = new Date("2026-10-15T00:00:00Z");
  for (const moon of MOONS) {
    const [x, y, z] = horizons[moon.id];
    const truth = equatorialFrameToScene(x, y, z);
    const model = moonOffset(moon.id, date);
    // The Moon's mean elements leave out the Sun's pull (evection, variation): ~3°.
    const tolerance = moon.id === "moon" ? 3 : 0.5;
    near(model.angleTo(truth) / RAD, 0, tolerance, `${moon.id} direction`);
    near(
      model.length() * 149_597_870.7,
      truth.length(),
      truth.length() * 0.02,
      `${moon.id} distance`,
    );
  }
});

test("resonant moons follow their librations through the fitted decades", () => {
  // Horizons planet-centred ICRF vectors (km) at 00:00 TDB (SAT441, URA184). Mimas swings
  // 44° in longitude over the 70.56-year Mimas–Tethys cycle: a steady mean motion that fits
  // one date misses the others by degrees.
  const horizons = {
    "2002-06-01": {
      mimas: [32_623.7, 177_778.2, -20_366.5],
      enceladus: [76_696.0, 225_301.9, -23_226.1],
      tethys: [140_171.0, -258_862.5, 12_597.3],
      miranda: [123_154.8, -10_884.2, -39_804.4],
    },
    "2031-06-01": {
      mimas: [73_504.7, 173_689.1, -14_171.3],
      enceladus: [-142_556.3, 190_686.3, -1_758.8],
      tethys: [-245_293.8, -160_869.5, 27_756.9],
      miranda: [-99_663.7, -7_133.6, 83_044.4],
    },
  };
  for (const [day, moons] of Object.entries(horizons)) {
    const date = new Date(`${day}T00:00:00Z`);
    for (const [id, [x, y, z]] of Object.entries(moons)) {
      const model = moonOffset(id, date);
      near(model.angleTo(equatorialFrameToScene(x, y, z)) / RAD, 0, 0.5, `${id} ${day}`);
    }
  }
});

test("Io, Europa and Ganymede keep the Laplace resonance", () => {
  // λ_Io − 3 λ_Europa + 2 λ_Ganymede librates about 180° by only ~0.07°.
  for (const iso of ["2000-01-01T12:00:00Z", "2026-10-15T00:00:00Z", "2040-06-01T00:00:00Z"]) {
    const date = new Date(iso);
    const phi = meanLongitude("io", date) - 3 * meanLongitude("europa", date);
    const laplace = (((phi + 2 * meanLongitude("ganymede", date)) % 360) + 360) % 360;
    near(laplace, 180, 0.5, iso);
  }
});

test("moons rotate synchronously, the Moon in its Cassini state", () => {
  const date = new Date("2026-10-15T00:00:00Z");
  const later = new Date(date.getTime() + 3 * 86_400_000);
  for (const moon of MOONS) {
    for (const when of [date, later]) {
      // Longitude 0 (local −X) faces the planet along the mean orbit; eccentricity adds libration.
      const facing = new Vector3(-1, 0, 0).applyQuaternion(moonOrientation(moon.id, when));
      const planet = moonOffset(moon.id, when).negate().normalize();
      // Libration in longitude reaches 2e; the Moon's tilted axis adds 6.7° in latitude.
      const libration = Math.hypot((2 * moon.e) / RAD, moon.cassini ? 6.7 : 0) + 0.5;
      assert.ok(facing.angleTo(planet) / RAD < libration, `${moon.id} faces its planet`);
    }
  }
  const spin = new Vector3(0, 1, 0).applyQuaternion(moonOrientation("moon", date));
  near(spin.angleTo(new Vector3(0, 1, 0)) / RAD, 1.54, 0.01, "Moon's axis from the ecliptic pole");
  const a = moonOffset("moon", date);
  const b = moonOffset("moon", new Date(date.getTime() + 86_400_000));
  near(spin.angleTo(a.cross(b)) / RAD, 6.7, 0.1, "Moon's axis from its orbit normal");
});

test("the sky almanac and the orrery agree on Earth's radius and the Moon's tilt", () => {
  assert.equal(FIGURES.earth.equatorialKm, EARTH_EQUATORIAL_RADIUS_KM);
  near(EARTH_EQUATORIAL_RADIUS_KM, 6378.14, 0.01, "Meeus' 6378.14 km");
  assert.equal(MOONS.find((moon) => moon.id === "moon").cassini, LUNAR_EQUATOR_INCLINATION_DEG);
  near(LUNAR_EQUATOR_INCLINATION_DEG, 1 + 32 / 60 + 32.7 / 3600, 1e-5, "I = 1°32′32.7″");
});

test("moon maps: brightness follows albedo, Europa brightest of the Galileans, Callisto darkest", () => {
  for (const moon of MOONS) assert.ok(GEOMETRIC_ALBEDO[moon.id], `${moon.id} has an albedo`);
  const order = ["europa", "io", "ganymede", "callisto"].map((id) => mean(id).luminance);
  for (let i = 1; i < order.length; i += 1)
    assert.ok(order[i] < order[i - 1], `Galilean order ${i}`);
  const titan = mean("titan");
  assert.ok(titan.r > titan.g && titan.g > titan.b * 1.5, "Titan's haze is orange");
  assert.ok(mean("moon").luminance < mean("charon").luminance, "the Moon is darker than Charon");
});

test("illustrative maps follow measured physical constraints for Venus, Titan, Sedna and Halley", () => {
  // Venus: polar hoods (>70°) are brighter and less blue-absorbed than the subpolar collar (~56°).
  const venusPx = surfaceMap("venus", W, H);
  const rowMean = (px, y) => {
    let r = 0,
      g = 0,
      b = 0;
    for (let x = 0; x < W; x += 1) {
      const i = (y * W + x) * 4;
      r += linear(px[i]);
      g += linear(px[i + 1]);
      b += linear(px[i + 2]);
    }
    return { r: r / W, g: g / W, b: b / W, lum: (0.2126 * r + 0.7152 * g + 0.0722 * b) / W };
  };
  const venusHood = rowMean(venusPx, Math.floor(((90 - 78) / 180) * H));
  const venusCollar = rowMean(venusPx, Math.floor(((90 - 56) / 180) * H));
  assert.ok(venusHood.lum > venusCollar.lum, "Venus polar hood is brighter than subpolar collar");
  assert.ok(
    venusHood.b / venusHood.r > venusCollar.b / venusCollar.r,
    "Venus UV/blue absorber dims blue more in the subpolar collar than in the polar hood",
  );

  // Titan: southern hemisphere brighter than northern hood, and zonally smooth (<1.5 % along a parallel).
  const titanPx = surfaceMap("titan", W, H);
  const titanSouth = rowMean(titanPx, Math.floor(((90 - -30) / 180) * H));
  const titanNorth = rowMean(titanPx, Math.floor(((90 - 30) / 180) * H));
  const titanHood = rowMean(titanPx, Math.floor(((90 - 62) / 180) * H));
  assert.ok(
    titanSouth.lum > titanNorth.lum && titanNorth.lum > titanHood.lum,
    "Titan hemispheric dichotomy and dark north-polar hood",
  );

  // Sedna: ultra-red tholin colour and longitudinally balanced light curve (Gaudi et al. 2005).
  const sedna = mean("sedna");
  assert.ok(sedna.r > sedna.g * 1.8 && sedna.g > sedna.b * 1.6, "Sedna is ultra-red");
  const sednaPx = surfaceMap("sedna", W, H);
  const quadLum = [0, 0, 0, 0];
  for (let y = 0; y < H; y += 1) {
    const wgt = Math.cos((90 - ((y + 0.5) / H) * 180) * RAD);
    for (let x = 0; x < W; x += 1) {
      const i = (y * W + x) * 4;
      const lum =
        0.2126 * linear(sednaPx[i]) +
        0.7152 * linear(sednaPx[i + 1]) +
        0.0722 * linear(sednaPx[i + 2]);
      quadLum[Math.floor((x / W) * 4)] += lum * wgt;
    }
  }
  const qMax = Math.max(...quadLum);
  const qMin = Math.min(...quadLum);
  assert.ok((qMax - qMin) / ((qMax + qMin) / 2) < 0.03, "Sedna rotational variation stays small");

  // Halley: >85 % dark refractory crust, with localized brighter active vent regions (Keller et al. 1987).
  const halleyPx = surfaceMap("halley", W, H);
  let darkArea = 0,
    ventArea = 0,
    totalArea = 0;
  for (let y = 0; y < H; y += 1) {
    const wgt = Math.cos((90 - ((y + 0.5) / H) * 180) * RAD);
    for (let x = 0; x < W; x += 1) {
      const i = (y * W + x) * 4;
      const lum =
        0.2126 * linear(halleyPx[i]) +
        0.7152 * linear(halleyPx[i + 1]) +
        0.0722 * linear(halleyPx[i + 2]);
      if (lum < 0.06) darkArea += wgt;
      if (lum > 0.07) ventArea += wgt;
      totalArea += wgt;
    }
  }
  assert.ok(darkArea / totalArea > 0.85, "Halley's dark crust covers >85 % of the surface");
  assert.ok(ventArea / totalArea > 0.02 && ventArea / totalArea < 0.15, "Discrete active vents");
});

test("Motion's sped-up clock moves the planets along today's orbits without ageing them", () => {
  const now = jplElements("saturn", T2026);
  /* A million years of drift is far outside the 1800–2050 fit: only the planet moves on. */
  const later = jplElements("saturn", T2026, 1e6);
  for (const key of ["a", "e", "i", "omega", "node"]) assert.equal(later[key], now[key], key);
  /* A year of drift carries Saturn about a 29.4th of the way round. */
  const year = jplElements("saturn", T2026, 1);
  assert.ok(Math.abs(year.M - now.M - 360 / 29.45) < 0.05, `${year.M - now.M}`);
});

test("planet elements written into a reused record match fresh ones", () => {
  const out = { a: 0, e: 0, i: 0, omega: 0, node: 0, M: 0 };
  for (const id of [...PLANET_IDS, "pluto"])
    for (const [T, drift] of [
      [T2026, 0],
      [-1.7, 250],
    ]) {
      assert.equal(jplElements(id, T, drift, out), out);
      assert.deepEqual(out, jplElements(id, T, drift), `${id} ${T}`);
    }
});

test("the ephemeris passes its own consistency checks, here rather than on every WebGL startup", () => {
  assert.deepEqual(ephemerisSelfCheck(), []);
});

/** The point at eccentric anomaly E on a shape, as the orbit line's vertex stage builds it. */
const onShape = ({ a, e, p, q }, E) =>
  p.map((pk, k) => pk * a * (Math.cos(E) - e) + q[k] * a * Math.sqrt(1 - e * e) * Math.sin(E));

test("an orbit's shape is the ellipse its body moves on, the body at its anomaly", () => {
  const el = { a: 20, e: 0.8, i: 63, omega: 120, node: 45, M: 37 };
  const shape = orbitShape(el, true);
  const body = keplerPosition(el);
  onShape(shape, shape.E).forEach((x, k) => assert.ok(Math.abs(x - body[k]) < 1e-9));
  assert.ok(Math.abs(Math.hypot(...onShape(shape, 0)) - 4) < 1e-9);
  assert.ok(Math.abs(Math.hypot(...onShape(shape, Math.PI)) - 36) < 1e-9);
  /* Moving on along the orbit moves the body, not the ellipse. */
  const later = orbitShape({ ...el, M: 180 }, true);
  assert.deepEqual([later.a, later.e, later.p, later.q], [shape.a, shape.e, shape.p, shape.q]);
  /* Not elliptical: a circle of radius a in the ecliptic (the scene's y is its pole). */
  const circle = orbitShape(el, false);
  assert.equal(circle.e, 0);
  assert.ok(Math.abs(circle.p[1]) < 1e-12 && Math.abs(circle.q[1]) < 1e-12);
  for (const E of [0, 1, 2, 4]) assert.ok(Math.abs(Math.hypot(...onShape(circle, E)) - 20) < 1e-9);
});

test("a moon's orbit shape carries the moon where its offset puts it", () => {
  const date = new Date(Date.UTC(2026, 9, 22));
  for (const moon of MOONS.filter((m) => m.id !== "moon")) {
    const shape = moonOrbitShape(moon.id, date);
    const offset = moonOffset(moon.id, date);
    const at = onShape(shape, shape.E);
    assert.ok(Math.hypot(at[0] - offset.x, at[1] - offset.y, at[2] - offset.z) < 1e-12, moon.id);
  }
});

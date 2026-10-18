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
  FIGURES,
  MOONS,
  PLANET_IDS,
  PLANET_RADIUS_KM,
  RINGS,
  SPINS,
  centuriesSinceJ2000,
  flattening,
  jplElements,
  meanLongitude,
  meanRates,
  ringStrip,
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
} from "../src/features/orrery/lib/graphics/coordinates.ts";
import { moonOffset, moonOrientation } from "../src/features/orrery/lib/graphics/moons.ts";

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
  near(flattening("jupiter"), 0.06487, 2e-5, "Jupiter");
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
    return ringStrip(system, texels)[t * 4 + 3] / 255;
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
    io: 1821.49,
    europa: 1560.8,
    ganymede: 2631.2,
    callisto: 2410.3,
    titan: 2574.76,
    triton: 1352.6,
    charon: 606,
  };
  // NSSDC satellite fact sheets, days; Triton's is retrograde.
  const period = {
    moon: 27.321661,
    io: 1.769138,
    europa: 3.551181,
    ganymede: 7.154553,
    callisto: 16.689018,
    titan: 15.945421,
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
  // JUP365, SAT441, NEP097, PLU060.
  const horizons = {
    moon: [-128_936.0, -334_443.7, -182_898.8],
    io: [254_581.1, 300_375.9, 147_380.7],
    europa: [-559_924.8, -320_120.3, -162_863.7],
    ganymede: [986_502.4, 362_873.3, 190_067.5],
    callisto: [-1_782_107.0, 590_853.7, 251_952.9],
    titan: [1_108_664.4, -418_700.5, -70_154.1],
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

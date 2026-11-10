import assert from "node:assert/strict";
import test from "node:test";

import { createTranslator } from "next-intl";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  CONSTANTS,
  SPEED_OF_LIGHT,
  convert,
  meanDensity,
  printFactSpan,
  stefanBoltzmann,
} from "@horizon/toolkit/science";

import { CardSources } from "../src/features/giants/components/card-sources.tsx";
import { cardSources } from "../src/features/giants/components/card-specs.ts";
import { rungCard, tourFigure } from "../src/features/giants/components/format.ts";
import { RUNG_FACTS, drawn, radiusMetres } from "../src/features/giants/lib/model/catalogue.ts";
import { compare } from "../src/features/giants/lib/model/compare.ts";
import { GIANTS_EQUATIONS, oblateDensity } from "../src/features/giants/lib/model/equations.ts";
import { lightLapSeconds, spheroidDensity } from "../src/features/giants/lib/model/physics.ts";
import { rocheOmega } from "../src/features/giants/lib/model/rotation.ts";
import { RUNGS } from "../src/features/giants/lib/model/rungs.ts";
import { TOUR } from "../src/features/giants/lib/model/tour.ts";
import { factSources } from "../src/lib/facts.ts";
import { SOURCES } from "../src/lib/sources.ts";
import { featureMessages } from "./messages-helper.mjs";
import { closeRelative } from "./toolkit-helpers.mjs";

test("spheroid density uses both axes, with the spherical limit and volume scaling", () => {
  const M = (8 * Math.PI) / 3;
  closeRelative(spheroidDensity(M, 2, 0.5), 1);
  closeRelative(spheroidDensity(2 * M, 2, 0.5), 2);
  closeRelative(spheroidDensity(M, 4, 0.5), 0.25);
  closeRelative(spheroidDensity(M, 2, 1), 0.5);
  closeRelative(oblateDensity.compute({ M, a: 2, b: 0.5 }), 1);
  for (const R of [1, 1e4, 1e9])
    closeRelative(spheroidDensity(M, R, R), meanDensity.compute({ M, R }));
});

test("flattened catalogue bodies use spheroid densities and all three input intervals", () => {
  // kg/m³ from the adopted masses and equatorial/polar dimensions, not equatorial spheres.
  closeRelative(RUNG_FACTS.earth.density.value * 1000, 5513.413, 1e-6);
  closeRelative(RUNG_FACTS.jupiter.density.value * 1000, 1326.54, 1e-6);
  closeRelative(RUNG_FACTS.vega.density.value * 1000, 168.687, 1e-6);
  closeRelative(RUNG_FACTS.achernar.density.value * 1000, 14.82236, 1e-6);

  const { mass, radius, polar, density } = RUNG_FACTS.achernar;
  // Lowest density: lowest mass and largest axes; highest: largest mass and smallest axes.
  const volume = (a, b) =>
    ((4 * Math.PI) / 3) * convert(a, "Rsun", "m") ** 2 * convert(b, "Rsun", "m");
  closeRelative(
    density.range[0] * 1000,
    convert(mass.range[0], "Msun", "kg") / volume(radius.range[1], polar.range[1]),
  );
  closeRelative(
    density.range[1] * 1000,
    convert(mass.range[1], "Msun", "kg") / volume(radius.range[0], polar.range[0]),
  );
  // Pin the adopted envelope too: silently dropping polar uncertainty must fail.
  closeRelative(density.range[0] * 1000, 11.74121, 1e-6);
  closeRelative(density.range[1] * 1000, 18.5218, 1e-6);
});

test("UY Scuti derives one consistent size from the adopted 2024 luminosity and temperature", () => {
  const { teff, luminosity, radius, mass, density, thinness } = RUNG_FACTS["uy-scuti"];
  assert.equal(teff.value, 3550);
  assert.deepEqual(teff.range, [3380, 3720]);
  // Healy's 2024-04-11 catalogue: log L/L☉ and the asymmetric bolometric-magnitude errors.
  const L = 10 ** 5.094500706018924;
  closeRelative(luminosity.value, L, 1e-5);
  closeRelative(luminosity.range[0], L * 10 ** (-0.4 * 0.3629788612930296), 1e-5);
  closeRelative(luminosity.range[1], L * 10 ** (0.4 * 0.3254371536723425), 1e-5);
  closeRelative(stefanBoltzmann.compute({ R: radius.value, T: teff.value }), luminosity.value);
  closeRelative(radius.value, 932.06345, 1e-7);
  closeRelative(radius.range[0], 718.15847, 1e-7);
  closeRelative(radius.range[1], 1194.41976, 1e-7);
  assert.deepEqual(factSources(radius), ["healy2024"]);
  assert.equal(mass, undefined, "an older assumed mass is not a measurement for this solution");
  assert.equal(density, undefined);
  assert.equal(thinness, undefined);
});

test("black-hole drawing separates the horizon, photon sphere and apparent critical curve", () => {
  const G = CONSTANTS.gravitationalConstant.value;
  for (const { id } of RUNGS.filter(({ kind }) => kind === "horizon")) {
    const facts = RUNG_FACTS[id];
    const M = convert(drawn(facts.mass), facts.mass.unit, "kg");
    const rs = radiusMetres(id).radius;
    const rph = GIANTS_EQUATIONS["photon-sphere"].compute({ M });
    const impact = GIANTS_EQUATIONS["critical-impact"].compute({ M });
    closeRelative(rs, (2 * G * M) / SPEED_OF_LIGHT ** 2);
    closeRelative(rph, (3 * G * M) / SPEED_OF_LIGHT ** 2);
    // Schwarzschild null-geodesic turning-point relation, evaluated at the photon sphere.
    closeRelative(impact ** 2, rph ** 3 / (rph - rs));
    assert.ok(rs < rph && rph < impact);
    // The card's circumference/c is not the circular photon's distant-observer period.
    closeRelative(drawn(facts.lap), (2 * Math.PI * rs) / SPEED_OF_LIGHT);
    assert.ok((2 * Math.PI * impact) / SPEED_OF_LIGHT > 2.5 * drawn(facts.lap));
  }
});

test("circumference/c preserves radius bounds and uses the drawn radius for span-only figures", () => {
  for (const { id } of RUNGS) {
    const { radius, lap } = RUNG_FACTS[id];
    const metres = (r) => convert(r, radius.unit, "m");
    closeRelative(drawn(lap), lightLapSeconds(radiusMetres(id).radius));
    if (radius.range) {
      closeRelative(lap.range[0], lightLapSeconds(metres(radius.range[0])));
      closeRelative(lap.range[1], lightLapSeconds(metres(radius.range[1])));
    }
  }
  const span = { unit: "s", source: "horizon", status: "derived", range: [4, 9] };
  assert.equal(
    drawn(span),
    6,
    "a range without a best estimate is not animated at its lower bound",
  );
});

test("cards retain measured, derived and span-only intervals in both locales and converted units", () => {
  const cases = [
    ["neutron-star", "radius", RUNG_FACTS["neutron-star"].radius],
    ["sirius-b", "radius", { ...RUNG_FACTS["sirius-b"].radius, show: "km" }],
    ["betelgeuse", "mass", RUNG_FACTS.betelgeuse.mass],
    ["m87", "horizon", RUNG_FACTS.m87.radius],
    ["ton-618", "mass", RUNG_FACTS["ton-618"].mass],
    ["achernar", "density", RUNG_FACTS.achernar.density],
    ["uy-scuti", "lap", { ...RUNG_FACTS["uy-scuti"].lap, show: "h" }],
    ["neutron-star", "distance", RUNG_FACTS["neutron-star"].distance],
  ];
  for (const locale of ["en", "cs"]) {
    const t = createTranslator({ locale, messages: featureMessages("giants", locale) });
    for (const [id, row, fact] of cases) {
      const card = rungCard(t, { unit: "ly", locale }, id, (key) => t.has(key));
      const expected = printFactSpan(fact, {
        unit: "ly",
        locale,
        symbols: { ly: t("units.ly"), au: t("units.au"), pc: t("units.pc") },
        millionWord: t("names.million"),
        billionWord: t("names.billion"),
      });
      assert.ok(
        card.facts.find(({ id }) => id === row).value.includes(expected),
        `${locale} ${id}.${row} retains ${expected}`,
      );
    }
  }
});

test("derived figures and their visible source disclosure retain every contributing reference", () => {
  assert.deepEqual(
    new Set(factSources(RUNG_FACTS.sirius.luminosity)),
    new Set(["kervella2003", "bond2017"]),
  );
  assert.deepEqual(
    new Set(factSources(RUNG_FACTS.achernar.density)),
    new Set(["kervella2022", "domiciano2014"]),
  );
  assert.deepEqual(
    new Set(cardSources("jupiter").find(({ id }) => id === "density").sources),
    new Set(["iau2015b3", "galanti2026"]),
  );
  for (const locale of ["en", "cs"]) {
    const t = createTranslator({ locale, messages: featureMessages("giants", locale) });
    const html = renderToStaticMarkup(createElement(CardSources, { id: "achernar", t }));
    for (const key of ["kervella2022", "domiciano2014"])
      assert.ok(html.includes(`href="${SOURCES[key].link}"`), `${key} is reachable from the card`);
  }
});

test("volume comparisons agree with density and exclude coordinate volumes of horizons", () => {
  for (const [id, against] of [
    ["jupiter", "earth"],
    ["vega", "sun"],
    ["achernar", "sun"],
  ]) {
    const result = compare(id, against);
    const densities = RUNG_FACTS[id].density.value / RUNG_FACTS[against].density.value;
    closeRelative(result.volume, result.mass / densities);
    closeRelative(result.volume * compare(against, id).volume, 1);
    assert.ok(
      Math.abs(result.volume / result.width ** 3 - 1) > 0.05,
      "flattening materially changes volume",
    );
  }
  for (const { id } of RUNGS.filter(({ kind }) => kind === "horizon")) {
    assert.equal(compare(id, "earth").volume, undefined);
    assert.equal(compare("sun", id).volume, undefined);
    assert.ok(compare(id, "earth").width > 0, "horizon widths remain comparable");
  }
});

test("tour readouts carry length units and preserve the card's published intervals", () => {
  for (const locale of ["en", "cs"]) {
    const t = createTranslator({ locale, messages: featureMessages("giants", locale) });
    const d = { locale, unit: "auto" };
    const step = (id) => TOUR.find((s) => s.id === id);
    assert.equal(
      tourFigure(step("pulsar"), t, d),
      locale === "en" ? "11.5–13.8 km" : "11,5–13,8 km",
    );
    assert.equal(
      tourFigure(step("giants"), t, d),
      locale === "en" ? "3.26–4.09 au" : "3,26–4,09 au",
    );
    for (const [id, row] of [
      ["dwarf", "density"],
      ["heavy", "luminosity"],
    ]) {
      const current = step(id);
      const card = rungCard(t, d, current.rung, (key) => t.has(key));
      const readout = tourFigure(current, t, d);
      assert.ok(readout.includes("–"), `${id} retains its interval`);
      assert.ok(card.facts.find(({ id }) => id === row).value.includes(readout));
    }
  }
});

test("a flattened star's catalogued turn is the one its Roche shape needs", () => {
  for (const id of ["vega", "achernar"]) {
    const { radius, polar, mass, rotation } = RUNG_FACTS[id];
    const Re = convert(radius.value, radius.unit, "m");
    const GM = CONSTANTS.gravitationalConstant.value * convert(mass.value, mass.unit, "kg");
    const rate = rocheOmega(polar.value / radius.value) * Math.sqrt(GM / Re ** 3);
    const roche = convert((2 * Math.PI) / rate, "s", rotation.unit);
    const [fastest, slowest] = rotation.range;
    assert.ok(roche > fastest && roche < slowest, `${id}: ${roche} ${rotation.unit}`);
  }
});

test("Stephenson 2-18's model uses the same distance as its adopted luminosity", () => {
  const { distance, teff, luminosity, radius } = RUNG_FACTS["stephenson-2-18"];
  // Fok et al. 2012, Tables 6 and 8: RSGC2 SW, St2-18.
  assert.equal(convert(distance.value, distance.unit, "kpc"), 5.5);
  assert.equal(teff.value, 3200);
  closeRelative(luminosity.value, 10 ** 5.64, 0.0015);
  closeRelative(stefanBoltzmann.compute({ R: radius.value, T: teff.value }), luminosity.value);
  assert.deepEqual(factSources(distance), factSources(luminosity));
  assert.equal(distance.range, undefined, "the adopted model distance has no published interval");
});

test("TON 618 retains both virial estimates and propagates both references to its horizon", () => {
  const { mass, radius, lap } = RUNG_FACTS["ton-618"];
  // Ge et al. 2019 and Shemmer et al. 2004, their Table 2 entries.
  closeRelative(mass.range[0], 10 ** 10.61, 0.001);
  closeRelative(mass.range[1], 10 ** 10.82, 0.002);
  for (const fact of [mass, radius, lap])
    assert.deepEqual(new Set(factSources(fact)), new Set(["ge2019", "shemmer2004"]));
});

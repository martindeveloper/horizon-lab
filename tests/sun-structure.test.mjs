import assert from "node:assert/strict";
import test from "node:test";

import { GRAVITATIONAL_CONSTANT, SOLAR_MASS_KG, SOLAR_TEFF_K } from "@horizon/toolkit/science";

import { RADIUS_M, TACHOCLINE_R } from "../src/space/sun/model/parameters.ts";
import {
  CORE_EDGE_R,
  LAYERS,
  LAYER_ZONES,
  MODEL_MASS_KG,
  OPACITY_WALK_M,
  STRUCTURE_RADII,
  diffusionTime,
  gravityAt,
  hydrostaticGradient,
  layerAt,
  massAt,
  photonDiffusionTime,
  pressureGradientAt,
  structureAt,
} from "../src/space/sun/model/structure.ts";

const YEAR_S = 365.25 * 86_400;

test("the Model S table runs from the centre to the photosphere, monotonic in radius", () => {
  assert.ok(STRUCTURE_RADII.length >= 100);
  assert.equal(STRUCTURE_RADII[0], 0);
  assert.equal(STRUCTURE_RADII.at(-1), 1);
  for (let i = 1; i < STRUCTURE_RADII.length; i++)
    assert.ok(STRUCTURE_RADII[i] > STRUCTURE_RADII[i - 1], `row ${i}`);
});

test("temperature, density and pressure fall outward; luminosity and hydrogen rise to the surface", () => {
  let previous = structureAt(0);
  for (let i = 1; i < STRUCTURE_RADII.length; i++) {
    const point = structureAt(STRUCTURE_RADII[i]);
    assert.ok(point.T < previous.T, `T at ${STRUCTURE_RADII[i]}`);
    assert.ok(point.rho < previous.rho, `ρ at ${STRUCTURE_RADII[i]}`);
    assert.ok(point.P < previous.P, `P at ${STRUCTURE_RADII[i]}`);
    assert.ok(point.L >= previous.L, `L at ${STRUCTURE_RADII[i]}`);
    assert.ok(point.X >= previous.X - 1e-9, `X at ${STRUCTURE_RADII[i]}`);
    previous = point;
  }
  assert.equal(structureAt(1).L, 1);
  assert.equal(structureAt(0).L, 0);
});

test("the centre and the surface read as the standard solar model", () => {
  const centre = structureAt(0);
  assert.ok(centre.T > 1.5e7 && centre.T < 1.6e7, "15.7 MK");
  assert.ok(centre.rho > 1.5e5 && centre.rho < 1.6e5, "150 g/cm³");
  assert.ok(centre.X > 0.3 && centre.X < 0.4, "hydrogen half burnt");
  const surface = structureAt(1);
  assert.ok(
    Math.abs(surface.T - SOLAR_TEFF_K) < 60,
    "the photosphere at the effective temperature",
  );
  assert.ok(surface.rho > 1e-4 && surface.rho < 4e-4, "2 × 10⁻⁷ g/cm³");
  assert.ok(surface.X > 0.73 && surface.X < 0.75);
});

test("interpolation is continuous and clamps outside the table", () => {
  const a = structureAt(0.4999);
  const b = structureAt(0.5001);
  assert.ok(Math.abs(Math.log(a.T / b.T)) < 1e-3);
  assert.ok(Math.abs(Math.log(a.rho / b.rho)) < 1e-2);
  assert.deepEqual(structureAt(-1), structureAt(0));
  assert.deepEqual(structureAt(2), structureAt(1));
  const out = { T: 0, rho: 0, P: 0, L: 0, X: 0, kappa: 0 };
  assert.equal(structureAt(0.3, out), out, "writes into the given point");
});

test("layer bounds follow from the table: a quarter-radius core, the tachocline under the convection zone", () => {
  assert.ok(CORE_EDGE_R > 0.2 && CORE_EDGE_R < 0.3, `core edge ${CORE_EDGE_R}`);
  assert.ok(structureAt(CORE_EDGE_R).L >= 0.99 - 1e-6);
  assert.equal(LAYERS.tachocline, TACHOCLINE_R);
  assert.equal(LAYERS.core, CORE_EDGE_R);
  assert.equal(LAYERS.photosphere, 1);
  for (let i = 1; i < LAYER_ZONES.length - 1; i++)
    assert.equal(
      LAYER_ZONES[i].inner,
      LAYER_ZONES[i - 1].outer,
      `${LAYER_ZONES[i].id} starts where ${LAYER_ZONES[i - 1].id} ends`,
    );
  assert.equal(layerAt(0.1).id, "core");
  assert.equal(layerAt(0.5).id, "radiative");
  assert.equal(layerAt(0.7).id, "tachocline");
  assert.equal(layerAt(0.9).id, "convection");
  assert.equal(layerAt(1).id, "photosphere");
});

test("the table holds a solar mass and is in hydrostatic equilibrium", () => {
  assert.ok(Math.abs(MODEL_MASS_KG / SOLAR_MASS_KG - 1) < 0.02, `${MODEL_MASS_KG}`);
  assert.ok(
    massAt(CORE_EDGE_R) / MODEL_MASS_KG > 0.3,
    "the core holds a third of the mass or more",
  );
  assert.ok(gravityAt(1) > 270 && gravityAt(1) < 280, "274 m/s² at the surface");
  assert.equal(gravityAt(0), 0);
  for (const x of [0.3, 0.5, 0.7, 0.9]) {
    const { rho } = structureAt(x);
    const expected = hydrostaticGradient(rho, gravityAt(x));
    assert.ok(Math.abs(pressureGradientAt(x) / expected - 1) < 0.15, `dP/dr at ${x}`);
  }
});

test("the conventional shell diffusion estimate to the convection boundary is of order 10⁵ years", () => {
  const years = photonDiffusionTime() / YEAR_S;
  assert.ok(years > 5e4 && years < 3e5, `${years} yr`);
  assert.ok(OPACITY_WALK_M > 0);
});

test("the shell estimate has the Mitalas–Sills constant-mean-free-path limit", () => {
  // Their eq. 9 gives 3 R²/(c l). For R=10 m and l=0.01 m,
  // the opacity-walk integral is R²/(2l) = 5000 m.
  assert.ok(Math.abs(diffusionTime(5000) - 0.00010006922855944561) < 1e-15);
});

test("finite central density gives M proportional to r cubed and gravity proportional to r", () => {
  const rho = structureAt(0).rho;
  for (const x of [1e-9, 1e-7, 1e-6, 1e-5]) {
    const r = x * RADIUS_M;
    const centralMass = (4 * Math.PI * rho * r ** 3) / 3;
    const centralGravity = (4 * Math.PI * GRAVITATIONAL_CONSTANT * rho * r) / 3;
    assert.ok(Math.abs(massAt(x) / centralMass - 1) < 0.001, `mass at ${x} R`);
    assert.ok(Math.abs(gravityAt(x) / centralGravity - 1) < 0.001, `gravity at ${x} R`);
  }
  for (const x of STRUCTURE_RADII.slice(1, -1)) {
    assert.ok(massAt(x - 1e-10) <= massAt(x));
    assert.ok(massAt(x) <= massAt(x + 1e-10));
  }
});

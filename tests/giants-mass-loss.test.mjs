import assert from "node:assert/strict";
import test from "node:test";

import { weatherUniforms } from "../src/features/giants/lib/graphics/weather-uniforms.ts";
import { createForecast, weatherAt } from "../src/features/giants/lib/model/activity.ts";
import { LOOKS } from "../src/features/giants/lib/model/looks.ts";
import {
  blankOutflow,
  evolveOutflow,
  grainTemperature,
  OUTFLOW_LIFE_S,
} from "../src/features/giants/lib/model/mass-loss.ts";
import { rungIndex } from "../src/features/giants/lib/model/rungs.ts";

const near = (a, b, tolerance = 1e-9) =>
  assert.ok(Math.abs(a - b) <= tolerance * Math.max(1, Math.abs(b)), `${a} != ${b}`);

test("grey grains recover the finite-disc surface limit and distant radiative equilibrium", () => {
  const star = 3600;
  near(grainTemperature(star, 1), star * 2 ** -0.25);
  for (const radius of [100, 1000, 1000000])
    near(grainTemperature(star, radius), star / Math.sqrt(2 * radius), 1e-5);
  let previous = Infinity;
  for (let r = 1; r < 10; r += 0.05) {
    const T = grainTemperature(star, r);
    assert.ok(T < previous);
    previous = T;
  }
});

test("surface outflows expand, cool, dilute and form dust only after cooling", () => {
  const cloud = blankOutflow();
  let radius = 0,
    width = 0,
    temperature = Infinity;
  let gasSeen = false,
    dustSeen = false;
  for (let age = 0; age < OUTFLOW_LIFE_S; age += 0.25) {
    const r = evolveOutflow(cloud, age, 3600);
    assert.ok(r > radius && cloud.width > width && cloud.temperature <= temperature);
    assert.ok(cloud.temperature >= grainTemperature(3600, r));
    assert.ok(cloud.gas >= 0 && cloud.dust >= 0);
    if (cloud.temperature >= 1700) assert.equal(cloud.dust, 0);
    if (age > 8 && age < 80) near((cloud.gas + cloud.dust / 5) * cloud.width ** 2, 0.19 ** 2, 1e-8);
    gasSeen ||= cloud.gas > 0 && cloud.dust === 0;
    dustSeen ||= cloud.dust > 0 && cloud.temperature < 1700;
    [radius, width, temperature] = [r, cloud.width, cloud.temperature];
  }
  assert.ok(gasSeen && dustSeen);
  for (const age of [-1, 0, OUTFLOW_LIFE_S, OUTFLOW_LIFE_S + 10]) {
    evolveOutflow(cloud, age, 3600);
    assert.equal(cloud.gas + cloud.dust, 0, "no popping at birth or end of the event");
  }
});

test("red-supergiant outbursts keep their launch direction, occur intermittently and create no solar flares", () => {
  const forecast = createForecast();
  for (const id of ["betelgeuse", "antares", "uy-scuti", "vy-cma", "stephenson-2-18"]) {
    const look = LOOKS[rungIndex(id)];
    const globe = { ...look, temperature: look.equatorK };
    const directions = new Map();
    let active = 0,
      quiet = 0,
      dusty = 0;
    for (let time = 0; time <= 630; time += 2) {
      const w = forecast.at(look.activity, globe, time);
      assert.equal(w.corona, 0);
      assert.ok(w.flashes.every((f) => f.strength === 0));
      assert.ok(w.loops.every((l) => l.brightness === 0));
      assert.ok(w.ejections.every((e) => e.brightness === 0));
      const clouds = w.outflows.filter((c) => c.gas + c.dust > 0);
      if (clouds.length) active++;
      else quiet++;
      for (const c of clouds) {
        dusty += Number(c.dust > 0);
        const radius = Math.hypot(...c.centre);
        assert.ok(
          radius >= 1 && radius + 3.5 * c.width < 6,
          "cloud remains inside the drawn reach",
        );
        const dir = c.centre.map((x) => x / radius);
        const previous = directions.get(c.seed);
        if (previous) {
          dir.forEach((x, i) => near(x, previous.dir[i]));
          assert.ok(radius > previous.radius, "detached material moves radially outwards");
        }
        directions.set(c.seed, { dir, radius });
      }
    }
    assert.ok(active > 0 && quiet > 0 && dusty > 0, id);
    assert.ok(directions.size >= 2, id);
  }
});

test("outflow textures clear when focus leaves and switching to the Sun does not retain giant dust", () => {
  const look = LOOKS[rungIndex("betelgeuse")];
  const globe = { ...look, temperature: look.equatorK };
  const weather = weatherAt(look.activity, globe, 0);
  assert.ok(weather.outflows.some((c) => c.dust > 0));
  const uniforms = weatherUniforms();
  const texture = uniforms.uniforms.uOutflows.value;
  let disposed = false;
  texture.addEventListener("dispose", () => {
    disposed = true;
  });
  uniforms.fill(weather, (look.equatorK + look.poleK) / 2);
  assert.ok(texture.image.data.some((n) => n > 0));
  uniforms.fill(null);
  assert.ok(texture.image.data.every((n) => n === 0));
  const clearedVersion = texture.version;
  uniforms.fill(null);
  assert.equal(texture.version, clearedVersion, "inactive clouds do not upload every frame");
  const forecast = createForecast();
  forecast.at("plumes", globe, 0);
  const sun = forecast.at("solar", globe, 0);
  assert.ok(sun.outflows.every((c) => c.gas + c.dust === 0));
  uniforms.dispose();
  assert.ok(disposed);
});

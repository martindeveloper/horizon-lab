import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { test } from "node:test";

import { FEATURES, featureFlag } from "../src/config.ts";
import { registered, simulationForPath, simulations } from "../src/lib/simulations.ts";

test("a feature switch is on only in development with the debug tools, unless overridden", () => {
  assert.equal(featureFlag(undefined, "development", true), true);
  assert.equal(featureFlag(undefined, "development", false), false);
  assert.equal(featureFlag(undefined, "preview", true), false);
  assert.equal(featureFlag(undefined, "production", true), false);
  assert.equal(featureFlag("on", "production", false), true);
  assert.equal(featureFlag("off", "development", true), false);
  assert.equal(featureFlag("maybe", "development", true), true);
  assert.equal(featureFlag(undefined, "production", false, true), true, "a released switch is on");
  assert.equal(featureFlag("off", "production", false, true), false, "and can still be turned off");
});

test("the catalogue holds a switched simulation only while its switch is on", () => {
  const voyage = registered.find(({ id }) => id === "voyage");
  assert.equal(voyage.feature, "voyage");
  assert.equal(simulations.includes(voyage), FEATURES.voyage);
  assert.equal(simulationForPath(voyage.href) === voyage, FEATURES.voyage);
  assert.equal(simulationForPath(`${voyage.href}/saturn`) === voyage, FEATURES.voyage);
  /* The rest of the catalogue has no switch and is always there. */
  for (const manifest of registered)
    if (!("feature" in manifest)) assert.ok(simulations.includes(manifest), manifest.id);
});

for (const flag of ["on", "off"])
  test(`manifest gates agree across the catalogue, static routes and metadata with switches ${flag}`, () => {
    execFileSync(process.execPath, ["--import", "tsx", "tests/fixtures/simulation-gating.mjs"], {
      cwd: new URL("../", import.meta.url),
      env: {
        ...process.env,
        NEXT_PUBLIC_FEATURE_GIANTS: flag,
        NEXT_PUBLIC_FEATURE_SUN: flag,
        NEXT_PUBLIC_FEATURE_VOYAGE: flag,
      },
      stdio: "pipe",
    });
  });

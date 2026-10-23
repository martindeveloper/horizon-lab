import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

import { NextIntlClientProvider, createTranslator } from "next-intl";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PerspectiveCamera, Vector3 } from "three";

import { PLANCK_2018, convert, formatFigure } from "@horizon/toolkit/science";

import {
  HaloEvidence,
  LensingView,
  ExpansionView,
} from "../src/features/deep-field/components/dark-universe.tsx";
import {
  expansionAt,
  EXPANSION_CURVE,
  EXPANSION_FACTS,
} from "../src/features/deep-field/lib/model/dark-universe.ts";
import { TOUR } from "../src/features/deep-field/lib/model/tour.ts";
import { createCameraRig } from "../src/features/deep-field/lib/scene/camera-rig.ts";
import { dropsSelection, useDeepField } from "../src/features/deep-field/lib/store.ts";
import {
  DARK_HALO,
  HALO_INPUTS,
  HALO_FACTS,
  HALO_R200_KPC,
  HALO_FRAME_LY,
  CRITICAL_DENSITY,
  haloVisibility,
  haloDensity,
  haloMass,
} from "../src/space/galaxy/model/dark-halo.ts";
import { galaxyToWorld, LY } from "../src/space/galaxy/scene/frames.ts";
import { featureMessages, layoutMessages, leaves } from "./messages-helper.mjs";
import { close } from "./toolkit-helpers.mjs";

test("halo normalization and density radius agree with their physical definitions", () => {
  // Feng et al. 2026 Table 2 Mean: enclosed dark mass, not total Galaxy mass.
  close(haloMass(18, DARK_HALO) / 1.32e11, 1, 1e-10);
  assert.ok(DARK_HALO.rs >= HALO_INPUTS.solarRadius.value, "documented extended branch");
  // Independently integrate the density in radial shells to check the NFW mass formula.
  const r = 18,
    dr = r / 20_000;
  let mass = 0;
  for (let i = 0; i < 20_000; i++) {
    const radius = (i + 0.5) * dr;
    mass += 4 * Math.PI * radius ** 2 * haloDensity(radius, DARK_HALO) * dr;
  }
  close(mass / haloMass(r, DARK_HALO), 1, 1e-7);
  const mean = haloMass(HALO_R200_KPC, DARK_HALO) / (((4 * Math.PI) / 3) * HALO_R200_KPC ** 3);
  close(mean / CRITICAL_DENSITY, HALO_INPUTS.overdensity.value, 1e-8);
  close(convert(HALO_FACTS.width.value, "Mly", "kpc"), 2 * HALO_R200_KPC, 1e-9);
  assert.ok(haloDensity(HALO_R200_KPC * 1.1, DARK_HALO) > 0, "R200 is not a hard cutoff");
});

test("halo framing preserves its evidence card through the cosmic handoff", () => {
  const halo = { kind: "galaxy", id: "halo" };
  close(haloVisibility(HALO_FRAME_LY), 1);
  assert.equal(dropsSelection(halo, "cosmos", null, true), false);
  assert.equal(dropsSelection(halo, "cosmos", null, false), true);
  assert.equal(haloVisibility(1000), 0, "no local-sky wash");
  assert.equal(haloVisibility(HALO_FRAME_LY * 2), 0, "no halo on the distant web");
  const state = { selection: halo };
  const rig = createCameraRig(new PerspectiveCamera(), {
    state: () => state,
    reduceMotion: { matches: true },
  });
  rig.snap({ distance: HALO_FRAME_LY * LY });
  rig.step(1);
  rig.home();
  const centre = galaxyToWorld(0, 0, 0, new Vector3());
  close(rig.aim.distanceTo(centre) / LY, 0);
  state.selection = null;
  rig.step(1);
  rig.home();
  assert.ok(rig.aim.distanceTo(centre) / LY > 1000, "returns to the ordinary cosmic framing");
});

test("expansion follows Friedmann evolution and distinguishes H from acceleration", () => {
  const now = expansionAt(1),
    earlier = expansionAt(0.25);
  close(now.hubble, PLANCK_2018.H0);
  close(now.darkEnergy, 1 - PLANCK_2018.omegaM - PLANCK_2018.omegaR);
  assert.ok(earlier.deceleration > 0 && now.deceleration < 0);
  assert.ok(earlier.hubble > now.hubble, "H falls even though late expansion accelerates");
  assert.ok(earlier.darkEnergy < now.darkEnergy);
  let previous = 0;
  for (const p of EXPANSION_CURVE) {
    close(p.matter + p.radiation + p.darkEnergy, 1);
    assert.ok(p.age > previous);
    previous = p.age;
  }
  for (const a of [0, -1, NaN, Infinity]) assert.throws(() => expansionAt(a), RangeError);
});

test("published lensing snapshot retains signed data and its unobserved exterior", () => {
  const raw = readFileSync(new URL("../public/data/deep-field/cosmos-web.json", import.meta.url));
  const source = JSON.parse(
    readFileSync(new URL("../src/space/cosmos/model/data/cosmos-web-source.json", import.meta.url)),
  );
  const map = JSON.parse(raw);
  assert.equal(createHash("sha256").update(raw).digest("hex"), source.snapshotSha256);
  assert.equal(map.values.length, map.width * map.height);
  const valid = map.values.filter((v) => v !== null);
  assert.equal(valid.length, source.validPixels);
  assert.ok(valid.some((v) => v < 0) && valid.some((v) => v > 0));
  assert.ok(
    valid.length < map.values.length,
    "exterior is masked rather than filled with mock mass",
  );
  close(Math.min(...valid) * map.scale, source.min);
  close(Math.max(...valid) * map.scale, source.max);
});

test("Guide restricts halo overlays to its halo stop and Drift restores manual preferences", () => {
  const initial = useDeepField.getState();
  const api = useDeepField.getState;
  try {
    api().patchShow({ halo: true, haloBoundary: true });
    const manual = { ...api().show };
    api().startGuide();
    for (let index = 0; index < TOUR.length; index++) {
      api().goGuide(index);
      assert.equal(api().show.halo, TOUR[index].dark === "halo");
      assert.equal(api().show.haloBoundary, false);
    }
    api().endGuide();
    assert.deepEqual(api().show, manual);
    api().startDrift();
    assert.equal(api().show.halo, false);
    assert.equal(api().show.haloBoundary, false);
    api().stopDrift();
    assert.deepEqual(api().show, manual);
  } finally {
    useDeepField.setState(initial, true);
  }
});

test("dark-universe figures and accessible details render strictly in both locales", () => {
  for (const locale of ["en", "cs"]) {
    const messages = featureMessages("deep-field", locale);
    const fail = (error) => {
      throw error;
    };
    const t = createTranslator({ locale, messages, onError: fail });
    const args = {
      radius: formatFigure(locale, HALO_FACTS.r200, { withUnit: true }).text,
      z: formatFigure(locale, EXPANSION_FACTS.redshift).text,
      radial: formatFigure(locale, EXPANSION_FACTS.radial, { style: "error" }).text,
      transverse: formatFigure(locale, EXPANSION_FACTS.transverse, { style: "error" }).text,
    };
    for (const [key] of leaves(messages.dark, "dark"))
      assert.doesNotMatch(t(key, args), /[{}]|NaN|undefined/, `${locale}:${key}`);
    for (const Component of [HaloEvidence, LensingView, ExpansionView]) {
      const html = renderToStaticMarkup(
        createElement(
          NextIntlClientProvider,
          {
            locale,
            messages: layoutMessages("deep-field", locale),
            timeZone: "UTC",
            onError: fail,
          },
          createElement(Component),
        ),
      );
      assert.doesNotMatch(html, /NaN|undefined/);
      assert.match(html, /role="note"/);
    }
  }
});

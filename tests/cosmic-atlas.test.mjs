import assert from "node:assert/strict";
import test from "node:test";

import {
  Group,
  LineBasicMaterial,
  MeshBasicMaterial,
  PointsMaterial,
  Quaternion,
  SpriteMaterial,
  Vector3,
} from "three";

import { DisposalScope } from "@horizon/toolkit/rendering";
import {
  PLANCK_2018,
  comovingDistanceMpc,
  convert,
  equatorialToGalactic,
} from "@horizon/toolkit/science";

import { observedCloud, surveyPositions } from "../src/space/cosmos/graphics/atlas.ts";
import { createCosmosLooks } from "../src/space/cosmos/graphics/looks.ts";
import { ATLAS_FACTS } from "../src/space/cosmos/model/atlas-facts.ts";
import {
  ATLAS_DEFAULT_SHOW,
  ATLAS_H,
  ATLAS_LANDMARKS,
  ATLAS_SUN,
  BASINS,
  CLASSIX_CLUSTERS,
  KNOTS,
  VOIDS,
  atlasVisibility,
  equivalentRadius,
  hMpcToMly,
  observedPosition,
  reconstructedPosition,
} from "../src/space/cosmos/model/atlas.ts";
import { SUPERGALACTIC, cmbCz } from "../src/space/cosmos/model/cosmos.ts";
import cf4 from "../src/space/cosmos/model/data/cf4.json" with { type: "json" };
import desi from "../src/space/cosmos/model/data/desi.json" with { type: "json" };
import { createCosmosAtlas } from "../src/space/cosmos/scene/cosmos-atlas.ts";
import { createCosmosMarks } from "../src/space/cosmos/scene/cosmos-marks.ts";

const near = (a, b, tolerance = 1e-8) => assert.ok(Math.abs(a - b) < tolerance, `${a} vs ${b}`);
const fromSun = (p) => new Vector3(...p).sub(new Vector3(...ATLAS_SUN));

test("catalogue frames rotate and translate once, and h⁻¹ lengths use h₁₀₀", () => {
  assert.deepEqual(reconstructedPosition([0, 0, 0]), ATLAS_SUN);
  for (let axis = 0; axis < 3; axis++) {
    const sg = [0, 0, 0];
    sg[axis] = 100;
    const vector = fromSun(reconstructedPosition(sg));
    near(vector.length(), convert(100 / ATLAS_H, "Mpc", "Mly"));
    near(vector.normalize().dot(new Vector3(...Object.values(SUPERGALACTIC)[axis])), 1);
  }
  const radius = hMpcToMly(equivalentRadius((4 * Math.PI) / 3));
  near(radius, hMpcToMly(1));
  // A measured sky direction is retained; the radial coordinate alone uses cosmology.
  const ra = 194.854,
    dec = 27.946,
    z = 0.024;
  const { l, b } = equatorialToGalactic(ra, dec);
  const c = convert(1, "c", "km/s");
  const corrected = cmbCz(l, b, z * c) / c;
  const observer = fromSun(observedPosition(ra, dec, z, "observer"));
  const cmb = fromSun(observedPosition(ra, dec, corrected, "cmb"));
  near(observer.distanceTo(cmb), 0);
  near(observer.length(), convert(comovingDistanceMpc(corrected, PLANCK_2018), "Mpc", "Mly"));
});

test("observed geometry contains real catalogue positions and quality changes only subsample", () => {
  const positions = surveyPositions();
  const positive = cf4.rows.filter((r) => r[3] > 0);
  assert.equal(positions.length, positive.length + desi.rows.length);
  const row = positive[0];
  assert.deepEqual(
    positions[0],
    observedPosition(row[1], row[2], row[3] / convert(1, "c", "km/s"), "cmb"),
  );
  const last = desi.rows.at(-1);
  assert.deepEqual(positions.at(-1), observedPosition(last[1], last[2], last[3], "observer"));
  for (const p of positions) assert.ok(p.every(Number.isFinite));
  const high = observedCloud(1),
    low = observedCloud(0.5);
  const hp = high.getAttribute("position"),
    lp = low.getAttribute("position");
  for (let i = 0; i < lp.count; i++) {
    assert.deepEqual(
      Array.from(lp.array.slice(i * 3, i * 3 + 3)),
      Array.from(hp.array.slice(i * 6, i * 6 + 3)),
    );
  }
  assert.ok(CLASSIX_CLUSTERS.every((c) => c.at.every(Number.isFinite)));
  high.dispose();
  low.dispose();
});

test("reconstruction size guides and probabilities preserve their distinct meanings", () => {
  for (const v of VOIDS) {
    assert.ok(v.robustRadiusMly > 0 && v.robustRadiusMly <= v.radiusMly);
    // The published effective radii are rounded to a tenth of h⁻¹ Mpc.
    near(v.radius, equivalentRadius(v.volume), 0.13);
    near(v.robustRadius, equivalentRadius(v.robustVolume), 0.13);
  }
  for (const k of KNOTS) assert.ok(k.robustVolume > 0 && k.robustVolume <= k.volume);
  for (const b of BASINS)
    assert.ok(b.probability > 0 && b.probability <= 100 && b.sigma.every((s) => s > 0));
  assert.equal(ATLAS_FACTS.shapleyBasin.probability.value, 90);
  assert.equal(ATLAS_FACTS.shapleyBasin.membership.value, 58);
  assert.equal(ATLAS_FACTS.ophiuchusBasin.probability.value, 62);
  assert.equal(ATLAS_FACTS.ophiuchusBasin.membership.value, 39);
  assert.ok(
    ATLAS_FACTS.vela.mass.value > KNOTS.find((k) => k.name === "Vela").mass,
    "full overdensity and collapsing knot have different mass definitions",
  );
});

function looks() {
  return {
    cosmos: { observed: new PointsMaterial(), classix: new PointsMaterial() },
    atlasBasin: new LineBasicMaterial(),
    atlasVoid: new LineBasicMaterial(),
    atlasRobust: new LineBasicMaterial(),
    atlasCentre: new PointsMaterial(),
    atlasVoidCentre: new PointsMaterial(),
    atlasKnot: new PointsMaterial(),
    ghost: new MeshBasicMaterial({ visible: false }),
  };
}

test("Data, Illustration and Both mask rendered layers without changing the saved filters", () => {
  const preferences = Object.freeze({
    ...ATLAS_DEFAULT_SHOW,
    cosmicVoids: false,
    cosmicGuides: true,
  });
  const scope = new DisposalScope();
  const materials = looks();
  const atlas = createCosmosAtlas(scope, materials, new Group(), { share: 0.1 });
  for (const mode of ["data", "illustration", "both"]) {
    const layers = atlasVisibility({ ...preferences, cosmicMode: mode });
    atlas.update(2.8e9, 1, layers, new Quaternion(), "localVoid");
    const points = atlas.root.children.filter((object) => object.isPoints);
    assert.equal(
      points.find((p) => p.material === materials.cosmos.observed).visible,
      mode !== "illustration",
    );
    assert.equal(
      points.find((p) => p.material === materials.atlasCentre).visible,
      mode !== "illustration",
    );
    assert.equal(
      points.find((p) => p.material === materials.atlasVoidCentre).visible,
      false,
      "mode changes retain the void filter",
    );
    assert.equal(
      layers.cosmicIllustrations,
      mode !== "data",
      "Laniakea flows return in Both and Illustration",
    );
    assert.equal(layers.cosmicGuides, mode !== "illustration");
    if (mode === "illustration")
      atlas.root.traverseVisible((object) =>
        assert.ok(!object.isLineSegments, "no data guides leak into Illustration"),
      );
  }
  assert.equal(preferences.cosmicVoids, false);
  assert.equal(preferences.cosmicGuides, true);
  scope.dispose();
});

test("atlas switches, expansion and disposal affect the intended rendered data", () => {
  const scope = new DisposalScope(),
    materials = looks(),
    parent = new Group();
  const atlas = createCosmosAtlas(scope, materials, parent, { share: 0.5 });
  const show = { ...ATLAS_DEFAULT_SHOW, cosmicMeasured: false, cosmicVoids: false };
  atlas.update(2.8e9, 1, show, new Quaternion(), "vela");
  const points = atlas.root.children.filter((o) => o.isPoints);
  assert.equal(points.find((o) => o.material === materials.cosmos.observed).visible, false);
  assert.equal(points.find((o) => o.material === materials.cosmos.classix).visible, false);
  assert.equal(points.find((o) => o.material === materials.atlasVoidCentre).visible, false);
  assert.equal(points.find((o) => o.material === materials.atlasCentre).visible, true);
  assert.equal(
    atlas.root.children.filter((o) => o.isGroup && o.visible).length,
    1,
    "only Vela's size guide remains",
  );
  atlas.setExpansion(0.5, new Vector3(...ATLAS_SUN));
  atlas.root.updateMatrixWorld();
  const p = atlas.root.localToWorld(new Vector3(...ATLAS_LANDMARKS.vela.at));
  near(fromSun(p.toArray()).length(), fromSun(ATLAS_LANDMARKS.vela.at).length() * 0.5);
  const old = points[0].geometry;
  let retired = 0;
  old.addEventListener("dispose", () => retired++);
  atlas.setDetail({ share: 1 });
  assert.equal(retired, 1);
  const geometries = new Set();
  atlas.root.traverse((o) => {
    if (o.geometry) geometries.add(o.geometry);
  });
  let disposed = 0;
  for (const g of geometries) g.addEventListener("dispose", () => disposed++);
  scope.dispose();
  scope.dispose();
  assert.equal(
    disposed,
    geometries.size,
    "shared glyphs and replacement geometry are disposed once",
  );
});

test("overview markers stay small on screen and hollow, distinct from measured galaxy points", () => {
  const materials = createCosmosLooks({
    points: () => new PointsMaterial(),
    sprite: () => new SpriteMaterial(),
    ghost: new MeshBasicMaterial(),
  });
  for (const material of [materials.atlasCentre, materials.atlasVoidCentre, materials.atlasKnot]) {
    assert.equal(material.sizeAttenuation, false, "zoom cannot enlarge a symbolic centre");
    assert.ok(material.size > 0 && material.size <= 6);
    const { data, width, height } = material.map.image;
    const centre = ((height / 2) * width + width / 2) * 4;
    assert.equal(data[centre + 3], 0, "centre remains hollow");
    assert.ok(
      data.some((value, i) => i % 4 === 3 && value > 0),
      "outline is visible",
    );
  }
  materials.dispose();
  materials.ghost.dispose();
});

test("only the inspected structure reveals its true-scale guides unless the full overlay is requested", () => {
  const scope = new DisposalScope();
  const atlas = createCosmosAtlas(scope, looks(), new Group(), { share: 0.1 });
  const visibleLines = () => {
    const lines = [];
    atlas.root.traverseVisible((object) => {
      if (object.isLineSegments) lines.push(object);
    });
    return lines;
  };
  const update = (selected = null, patch = {}) =>
    atlas.update(2.8e9, 1, { ...ATLAS_DEFAULT_SHOW, ...patch }, new Quaternion(), selected);
  update();
  assert.equal(visibleLines().length, 0, "overview contains no sprawling guides");
  update("localVoid");
  assert.equal(visibleLines().length, 2, "selected void shows its two different volume guides");
  assert.deepEqual(visibleLines()[0].parent.position.toArray(), ATLAS_LANDMARKS.localVoid.at);
  near(visibleLines()[0].scale.x, VOIDS.find((v) => v.id === 10).radiusMly);
  update("shapleyBasin");
  assert.equal(visibleLines().length, 1, "selection replaces the previous guides");
  assert.equal(
    visibleLines()[0].geometry.getAttribute("position").count,
    6,
    "three uncertainty axes",
  );
  update("localVoid", { cosmicVoids: false });
  assert.equal(visibleLines().length, 0, "hidden layers stay hidden even when selected");
  update(null, { cosmicGuides: true });
  assert.equal(
    visibleLines().length,
    BASINS.length + 1 + VOIDS.length * 2,
    "all guides remain accessible",
  );
  update(null, { cosmicGuides: true, cosmicVoids: false });
  assert.equal(visibleLines().length, BASINS.length + 1, "full overlay respects layer filters");
  update();
  assert.equal(visibleLines().length, 0, "closing inspection restores the clear overview");
  scope.dispose();
});

test("hidden reconstruction layers have no labels or raycast targets; legacy hosts keep their drawing", () => {
  const scope = new DisposalScope(),
    root = new Group();
  const marks = createCosmosMarks(
    scope,
    looks(),
    root,
    {
      milkyWay: new Group(),
      andromeda: new Group(),
      triangulum: new Group(),
      cluster: () => ({ group: new Group() }),
    },
    new Vector3(),
  );
  const labels = new Map();
  const place = (key, _x, _y, _z, alpha) => labels.set(key, alpha);
  const update = (show) => marks.update(2.8e9, 1, 1, place, () => {}, show);
  update({ ...ATLAS_DEFAULT_SHOW });
  assert.ok(marks.pickables.some((m) => m.visible && m.userData.pick.id === "localVoid"));
  update({ ...ATLAS_DEFAULT_SHOW, cosmicVoids: false });
  assert.equal(labels.get("localVoid"), 0);
  assert.ok(!marks.pickables.some((m) => m.visible && m.userData.pick.id === "localVoid"));
  update(atlasVisibility({}));
  for (const id of Object.keys(ATLAS_LANDMARKS)) assert.equal(labels.get(id), 0);
  assert.equal(atlasVisibility({}).cosmicIllustrations, true);
  marks.hide(place);
  assert.ok(marks.pickables.every((m) => !m.visible));
  scope.dispose();
});

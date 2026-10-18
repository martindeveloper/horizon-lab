import assert from "node:assert/strict";
import test from "node:test";

import {
  ANCHORS,
  LOCAL_TURNAROUND,
  SUPERGALACTIC,
  UNIVERSE_AGE_GYR,
  anchorAt,
  anchorById,
  anchorToday,
  andromedaApart,
  clusterGathered,
  cosmicAim,
  scaleAt,
  supergalacticLatitude,
} from "../src/features/orrery/lib/model/cosmos.ts";
import { VIEWS, viewForDistance } from "../src/features/orrery/lib/model/views.ts";

const near = (actual, expected, tolerance, message) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${message}: ${actual} vs ${expected}`);
const length = (v) => Math.hypot(v[0], v[1], v[2]);

test("flat ΛCDM: today's age, and space a little over a third of today's size 10 Gyr ago", () => {
  near(UNIVERSE_AGE_GYR, 13.79, 0.03, "age");
  near(scaleAt(0), 1, 1e-9, "today");
  near(scaleAt(10e9), 0.37, 0.02, "10 Gyr ago (z ≈ 1.7)");
  let last = 1;
  for (let y = 0; y <= 10e9; y += 0.25e9) {
    const a = scaleAt(y);
    assert.ok(a <= last + 1e-12, "shrinks into the past");
    last = a;
  }
});

test("Andromeda's timing-argument orbit passes through today and turned around ~1 Mpc out", () => {
  near(andromedaApart(0), 2.5, 1e-6, "today");
  assert.ok(LOCAL_TURNAROUND.mly > 3 && LOCAL_TURNAROUND.mly < 4, "turnaround ~1 Mpc");
  assert.ok(LOCAL_TURNAROUND.yearsAgo > 4e9 && LOCAL_TURNAROUND.yearsAgo < 7e9, "when");
  assert.ok(andromedaApart(1e9) > 2.5, "farther a billion years ago");
  assert.ok(andromedaApart(10e9) < LOCAL_TURNAROUND.mly, "closer again before the turn");
  /* Closing at ~110 km/s today: 1 Myr ago it was ~0.36 kly farther. */
  near((andromedaApart(1e6) - andromedaApart(0)) * 1e6, 367, 15, "closing speed in ly/Myr");
});

test("named places land where catalogues put them, in the supergalactic plane", () => {
  const { x, y, z } = SUPERGALACTIC;
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  near(dot(x, y), 0, 1e-12, "x ⟂ y");
  near(dot(y, z), 0, 1e-12, "y ⟂ z");
  near(length(y), 1, 1e-12, "unit");
  const virgo = anchorById("virgoCluster");
  /* M87 at SGB −2.35° (de Vaucouleurs), 53.8 Mly away. */
  near(supergalacticLatitude(anchorToday(virgo)), -2.35, 0.2, "Virgo SGB");
  near(length(anchorToday(virgo)), 53.8, 0.1, "Virgo distance");
  for (const a of ANCHORS) assert.ok(a.mly > 0 && Math.abs(a.b) <= 90, a.id);
});

test("over time the expansion carries clusters, while the Local Group keeps to itself", () => {
  const virgo = anchorById("virgoCluster");
  near(length(anchorAt(virgo, 10e9)), 53.8 * scaleAt(10e9), 0.1, "Virgo rides the expansion");
  const lmc = anchorById("lmc");
  near(length(anchorAt(lmc, 10e9)), length(anchorToday(lmc)), 1e-9, "the LMC stays bound");
  assert.equal(clusterGathered(0), 1);
  assert.ok(clusterGathered(10e9) > 0.1 && clusterGathered(10e9) < 0.4);
});

test("the camera's aim leaves the galactic centre for each structure's heart", () => {
  assert.equal(length(cosmicAim(200_000, 0)), 0);
  const ga = anchorToday(anchorById("greatAttractor"));
  near(length(cosmicAim(760e6, 0)), length(ga), 1e-6, "Laniakea turns about the Great Attractor");
  let last = 0;
  for (let ly = 3e5; ly <= 7.6e8; ly *= 1.05) {
    const d = length(cosmicAim(ly, 0));
    assert.ok(Math.abs(d - last) < Math.max(1, ly / 1e6) * 0.5, `no jump at ${ly}`);
    last = d;
  }
  for (const view of VIEWS.filter((v) => v.realm === "cosmos"))
    assert.equal(viewForDistance(view.dist, "cosmos"), view.id, view.id);
  /* On out to the web, the aim glides from the Great Attractor to the web's landmarks. */
  for (let ly = 7.6e8; ly <= 2.8e9; ly *= 1.05) {
    const d = length(cosmicAim(ly, 0));
    assert.ok(Math.abs(d - last) < (ly / 1e6) * 0.5, `no jump at ${ly}`);
    last = d;
  }
});

test("the cosmic web's landmarks sit at their measured directions and redshift distances", async () => {
  const { redshiftMly, hubbleMly } = await import("../src/features/orrery/lib/model/cosmos.ts");
  const at = (id) => anchorById(id);
  near(at("perseusCluster").l, 150.58, 0.02, "Perseus (NGC 1275)");
  near(at("perseusCluster").b, -13.26, 0.02, "Perseus (NGC 1275)");
  near(at("comaCluster").b, 88, 0.1, "Coma near the galactic pole");
  near(at("shapleyCore").l, 312.0, 0.05, "Abell 3558");
  near(at("shapleyCore").b, 30.7, 0.05, "Abell 3558");
  /* About a billion light-years at z = 0.073, where Hubble's law runs ~2 % long. */
  near(at("sloanGreatWall").mly, 1_060, 40, "Sloan Great Wall");
  near(redshiftMly(21_900) / hubbleMly(21_900), 0.983, 0.003, "comoving vs Hubble's law");
  near(redshiftMly(3_000), hubbleMly(3_000), 1, "the two agree close by");
  /* All ride the expansion. */
  for (const id of ["perseusCluster", "comaCluster", "shapleyCore", "sloanGreatWall"])
    near(length(anchorAt(at(id), 5e9)), length(anchorToday(at(id))) * scaleAt(5e9), 1e-6, id);
});

test("a flight across maps keeps a selection made for its destination", async () => {
  const { dropsSelection } = await import("../src/features/orrery/lib/store.ts");
  const laniakea = { kind: "cosmos", id: "laniakea" };
  const earth = { kind: "planet", id: "earth" };
  /* Planets → Laniakea passes through the Galaxy map on the way. */
  assert.equal(dropsSelection(laniakea, "galaxy", "cosmos"), false);
  assert.equal(dropsSelection(earth, "galaxy", "solar"), false, "and back down to a planet");
  /* Zooming by hand (no flight) into another map lets it go. */
  assert.equal(dropsSelection(laniakea, "galaxy", null), true);
  assert.equal(dropsSelection(laniakea, "cosmos", null), false);
});

test("cosmic distances read in the chosen unit, millions as a word", async () => {
  const { formatDistance, LIGHT_YEAR_AU } = await import("@horizon/toolkit/science");
  const options = (unit) => ({
    unit,
    locale: "en",
    symbols: { au: "au", ly: "ly", pc: "pc" },
    millionWord: "million",
  });
  const virgo = 53.8e6 * LIGHT_YEAR_AU;
  assert.equal(formatDistance(virgo, options("ly")), "53.8 million ly");
  assert.equal(formatDistance(virgo, options("pc")), "16.5 million pc");
  assert.match(formatDistance(virgo, options("au")), /× 10¹² au$/);
  assert.equal(formatDistance(9e5 * LIGHT_YEAR_AU, options("ly")), "900,000 ly");
});

test("every label on the cosmic map has a card", async () => {
  const { COSMOS_LABELS } = await import("../src/features/orrery/lib/model/cosmos.ts");
  const { readFileSync } = await import("node:fs");
  const layer = readFileSync(
    new URL("../src/features/orrery/lib/scene/cosmos-layer.ts", import.meta.url),
    "utf8",
  );
  const en = JSON.parse(
    readFileSync(new URL("../src/features/orrery/messages/en.json", import.meta.url), "utf8"),
  );
  for (const key of COSMOS_LABELS) {
    const mark = layer.match(
      new RegExp(`key: "${key}",\\s*pick: \\{ kind: "(\\w+)", id: "(\\w+)" \\}`),
    );
    assert.ok(mark, `${key} has a target`);
    const [, kind, id] = mark;
    const card = kind === "cosmos" ? en.cards.cosmos[id] : en.cards[kind]?.[id];
    assert.ok(card?.title && card?.body, `${key} opens a card (${kind}.${id})`);
  }
});

test("zooming out holds on the Local Group over its own sheet before turning to Virgo", async () => {
  const { COSMIC_VIEW_LY, localGroupCentre } =
    await import("../src/features/orrery/lib/model/cosmos.ts");
  const lg = length(localGroupCentre(0));
  for (let ly = COSMIC_VIEW_LY.localGroup; ly <= COSMIC_VIEW_LY.sheet; ly *= 1.1)
    near(length(cosmicAim(ly, 0)), lg, 1e-9, `still on the Local Group at ${ly}`);
  assert.ok(length(cosmicAim(COSMIC_VIEW_LY.virgo, 0)) > 20, "then on toward Virgo");
  const order = VIEWS.filter((v) => v.realm === "cosmos").map((v) => v.id);
  assert.deepEqual(order, [
    "local-group",
    "local-sheet",
    "virgo-cluster",
    "virgo-supercluster",
    "laniakea",
    "cosmic-web",
  ]);
});

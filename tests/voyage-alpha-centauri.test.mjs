import assert from "node:assert/strict";
import test from "node:test";

/** α Centauri as Voyage places it: B's orbit about A and Proxima's place, against published figures. */
import { AU_KM, LIGHT_YEAR_KM } from "@horizon/toolkit/science";

import {
  AB_ORBIT,
  ALPHA_CENTAURI,
  alphaCentauriAt,
  companionOffsetAu,
  julianYear,
} from "../src/features/voyage/lib/model/alpha-centauri.ts";

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const at = (id, date) => alphaCentauriAt(id, date, [0, 0, 0]);

test("B orbits A between periastron and apastron, closing after one period", () => {
  const aAu = AB_ORBIT.aArcsec * 1.33;
  const near = aAu * (1 - AB_ORBIT.e);
  const far = aAu * (1 + AB_ORBIT.e);
  /* At periastron (1955.57, 2035.48) the pair is at its closest; a quarter period later, not. */
  const periastron = AB_ORBIT.periastronYr + 2 * AB_ORBIT.periodYr;
  const closest = companionOffsetAu(periastron);
  const rClosest = Math.hypot(closest.north, closest.east, closest.away);
  assert.ok(Math.abs(rClosest - near) < near * 0.01, `${rClosest} au at periastron`);
  const open = companionOffsetAu(periastron + AB_ORBIT.periodYr / 2);
  const rOpen = Math.hypot(open.north, open.east, open.away);
  assert.ok(Math.abs(rOpen - far) < far * 0.01, `${rOpen} au at apastron`);
  for (const year of [2000, 2026, 2060, 2100]) {
    const r = Math.hypot(...Object.values(companionOffsetAu(year)));
    assert.ok(r >= near * 0.99 && r <= far * 1.01, `${r} au in ${year}`);
    const again = companionOffsetAu(year + AB_ORBIT.periodYr);
    const back = companionOffsetAu(year);
    assert.ok(Math.abs(again.north - back.north) < 1e-6 && Math.abs(again.east - back.east) < 1e-6);
  }
  /* The pair's closest on the sky, 4″ in 2016 (about 5.3 au); 14″ in 2000 (about 19 au). */
  const closing = companionOffsetAu(2016);
  const sky2016 = Math.hypot(closing.north, closing.east);
  assert.ok(Math.abs(sky2016 - 4.0 * 1.33) < 0.6, `${sky2016} au on the sky in 2016`);
  const wide = companionOffsetAu(2000);
  const sky2000 = Math.hypot(wide.north, wide.east);
  assert.ok(Math.abs(sky2000 - 14.1 * 1.33) < 1, `${sky2000} au on the sky in 2000`);
});

test("the three stars stand at their published places about the Sun", () => {
  const date = new Date("2026-10-20T00:00:00Z");
  assert.ok(Math.abs(julianYear(date) - 2026.8) < 0.01);
  const a = at("alphaCenA", date);
  const b = at("alphaCenB", date);
  const proxima = at("proxima", date);
  assert.ok(Math.abs(dist(proxima, [0, 0, 0]) / LIGHT_YEAR_KM - 4.246) < 0.01);
  /* A and B: tens of au apart; Proxima about 13,000 au (0.2 ly) from them. */
  const ab = dist(a, b) / AU_KM;
  assert.ok(ab > 11 && ab < 36, `${ab} au`);
  const ap = dist(a, proxima) / AU_KM;
  assert.ok(Math.abs(ap - 12_950) < 2_000, `${ap} au`);
  for (const star of ALPHA_CENTAURI) {
    assert.ok(star.radiusKm > 0 && star.kelvin > 0);
    assert.ok(at(star.id, date).every(Number.isFinite));
  }
  /* B moves on its orbit: a different place a decade on. */
  const later = new Date("2036-10-20T00:00:00Z");
  assert.ok(dist(at("alphaCenB", later), b) / AU_KM > 1);
  assert.deepEqual(at("alphaCenA", later), a);
});

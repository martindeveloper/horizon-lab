/**
 * The eruption's front against the observed kinematics of flare-associated CMEs, on the model's
 * own two-hour timeline. The model's reconnection rate stands in for the flare's hard X-rays and
 * its delayed light for the soft X-rays, as the Neupert effect relates them.
 *
 *  - Zhang et al. 2001, ApJ 559, 452: three phases. An initiation phase below ~80 km/s before the
 *    flare; an impulsive acceleration of 100–500 m/s² through the flare's rise, ceasing near the
 *    soft X-ray peak; then propagation at a constant or slowly falling speed.
 *  - Bein et al. 2011, ApJ 738, 191 (95 CMEs): peak accelerations of 20–6800 m/s², 74% reached
 *    below 0.5 R☉ above the surface.
 *  - Bein et al. 2012, ApJ 755, 44: the acceleration starts before the flare in 75% of events,
 *    peaks within ±5 min of the soft X-ray derivative's peak in 60%, and ends after the soft
 *    X-ray peak in 77%. Temmer et al. 2008, ApJ 673, L95: acceleration and hard X-ray peaks
 *    within ~5 min.
 *  - Yashiro et al. 2005, JGR 110, A12S05: median CME speeds of 432 km/s with C-class and
 *    1556 km/s with X-class flares; the model erupts only from M5 and stronger flares.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { eruptionAt, flareLightAt, reconnectionAt } from "../src/space/sun/model/eruption.ts";
import {
  CME_FINAL_HEIGHT_R,
  ERUPTION_SECONDS,
  RADIUS_M,
  X_POINT_S,
} from "../src/space/sun/model/parameters.ts";

const MINUTE = 60 / ERUPTION_SECONDS;
const INITIATION_MAX_KM_S = 80;
const PEAK_ACCELERATION_M_S2 = [20, 6800];
const PEAK_ACCELERATION_HEIGHT_R = 0.5;
const PEAK_SYNC_MIN = 5;
const ACCELERATION_TAIL_MIN = 30;
const CME_SPEED_C_X_KM_S = [432, 1556];
/** The acceleration phase lasts while the acceleration stays above this share of its peak. */
const PHASE_SHARE = 0.1;
/** Propagation: the speed may still drift by this share, as the sheet's last reconnection ends. */
const COASTING_SHARE = 0.1;

const N = 1200;
const ds = 1 / N;
const dt = ds * ERUPTION_SECONDS;
const front = (s) => eruptionAt(s).cmeFront * RADIUS_M;
/* Interior samples only: the timeline clamps at its ends, where a centred difference would halve. */
const kinematics = Array.from({ length: N - 1 }, (_, i) => {
  const s = (i + 1) / N;
  const h = front(s);
  const v = (front(s + ds) - front(s - ds)) / (2 * dt);
  const a = (front(s + ds) - 2 * h + front(s - ds)) / (dt * dt);
  return { s, h, v, a, rate: reconnectionAt(s), light: flareLightAt(s) };
});
const peakOf = (key) => kinematics.reduce((best, k) => (k[key] > best[key] ? k : best));
const accelerationPeak = peakOf("a");
const phaseEnd = kinematics.findLast((k) => k.a >= PHASE_SHARE * accelerationPeak.a);
const onset = kinematics.find((k) => k.s >= X_POINT_S);

test("an initiation phase: the front already rises slowly when the flare begins", () => {
  for (const k of kinematics) {
    if (k.s >= X_POINT_S) break;
    assert.ok(k.v >= -1 && k.v < INITIATION_MAX_KM_S * 1e3, `${k.v} m/s at ${k.s}`);
  }
  assert.ok(onset.v > 0, "the rise has begun before the flare's onset");
});

test("the impulsive acceleration peaks with the flare's energy release and ends after its soft X-ray peak", () => {
  const ratePeak = peakOf("rate");
  const lightPeak = peakOf("light");
  assert.ok(
    Math.abs(accelerationPeak.s - ratePeak.s) <= PEAK_SYNC_MIN * MINUTE,
    `acceleration peaks at ${accelerationPeak.s}, the reconnection rate at ${ratePeak.s}`,
  );
  assert.ok(
    phaseEnd.s >= lightPeak.s && phaseEnd.s <= lightPeak.s + ACCELERATION_TAIL_MIN * MINUTE,
    `acceleration ends at ${phaseEnd.s}, the soft X-rays peak at ${lightPeak.s}`,
  );
});

test("then the ejection coasts at the speed of a CME from an M-class flare", () => {
  const end = kinematics.at(-1);
  for (const k of kinematics) {
    if (k.s <= phaseEnd.s) continue;
    assert.ok(
      Math.abs(k.v - end.v) <= COASTING_SHARE * end.v,
      `${k.v} m/s at ${k.s} against ${end.v} m/s at the end`,
    );
  }
  assert.ok(end.v / 1e3 > CME_SPEED_C_X_KM_S[0] && end.v / 1e3 < CME_SPEED_C_X_KM_S[1], `${end.v}`);
  assert.ok(Math.abs(front(1) / RADIUS_M - CME_FINAL_HEIGHT_R) < 1e-6);
});

test("the peak acceleration and the height it is reached at are those of flare-driven CMEs", () => {
  assert.ok(
    accelerationPeak.a > PEAK_ACCELERATION_M_S2[0] &&
      accelerationPeak.a < PEAK_ACCELERATION_M_S2[1],
    `${accelerationPeak.a} m/s²`,
  );
  assert.ok(
    accelerationPeak.h / RADIUS_M - 1 < PEAK_ACCELERATION_HEIGHT_R,
    `peak acceleration at ${accelerationPeak.h / RADIUS_M} R`,
  );
});

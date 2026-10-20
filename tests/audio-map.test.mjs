import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAudioMap,
  cueTime,
  detectCues,
  loadAudioMap,
  parseAudioMap,
} from "@horizon/toolkit/audio";

/** A track with a sinking intro, a rise, a plateau with a swell, a breath, a peak and a fade. */
function envelope() {
  const loud = [];
  const bright = [];
  for (let t = 0; t < 240; t++) {
    let v = -24;
    if (t < 40) v = -24 - (t / 40) * 12; // sinks to −36
    else if (t < 50) v = -36 + ((t - 40) / 10) * 14; // rises to −22
    else if (t >= 84 && t < 92) v = -18; // a swell
    else if (t >= 196 && t < 204) v = -38; // a breath
    else if (t >= 208 && t < 216) v = -15; // the peak
    else if (t >= 228) v = -22 - ((t - 228) / 12) * 8; // fades
    loud.push(v);
    bright.push(t >= 150 && t < 170 ? 500 : 300);
  }
  return { loud, bright };
}

test("cues are found from the envelopes: entrance, quiet, swells, breaths, bright, surge, peak, fade", () => {
  const { loud, bright } = envelope();
  const cues = detectCues(loud, bright, 1, 240);
  const at = (id) => cues.find((c) => c.id === id)?.at;
  const near = (kind, t, tolerance) =>
    cues.some((c) => c.kind === kind && Math.abs(c.at - t) <= tolerance);
  assert.equal(at("start"), 0);
  assert.equal(at("end"), 240);
  assert.ok(Math.abs(at("rise") - 40) <= 4, `rise at ${at("rise")}`);
  assert.ok(Math.abs(at("quiet") - 200) <= 6, `quiet at ${at("quiet")}`);
  assert.ok(Math.abs(at("peak") - 212) <= 6, `peak at ${at("peak")}`);
  assert.ok(Math.abs(at("surge") - 203) <= 6, `surge at ${at("surge")}`);
  assert.ok(near("swell", 88, 8), "the swell");
  assert.ok(near("breath", 40, 8), "the intro's bottom is a breath");
  assert.ok(near("bright", 160, 10), "the bright passage");
  assert.ok(at("fade") >= 224 && at("fade") <= 234, `fade at ${at("fade")}`);
  assert.deepEqual(
    cues.map((c) => c.at),
    cues.map((c) => c.at).sort((a, b) => a - b),
    "cues come in time order",
  );
  /* Silence around the music carries no cues; a level track has only its ends and peak. */
  const padded = detectCues([-70, -70, ...loud, -70], [0, 0, ...bright, 0], 1, 243);
  assert.ok(Math.abs(cueTime({ cues: padded }, "rise") - 42) <= 4);
  const flat = detectCues(Array(100).fill(-22), Array(100).fill(300), 1, 100);
  assert.deepEqual(
    flat.map((c) => c.kind),
    ["start", "peak", "end"],
  );
});

test("a built map round-trips through its JSON and a bad one is refused", async () => {
  const { loud, bright } = envelope();
  const map = buildAudioMap({
    track: "test",
    duration: 248,
    crossfade: 8,
    step: 1,
    loudness: loud,
    brightness: bright,
  });
  assert.equal(map.period, 240);
  assert.deepEqual(parseAudioMap(structuredClone(map)), map);
  assert.equal(parseAudioMap({ ...map, version: 2 }), null);
  assert.equal(parseAudioMap({ ...map, loudness: ["loud"] }), null);
  assert.equal(parseAudioMap({ ...map, cues: [{ id: "x" }] }), null);
  assert.equal(parseAudioMap(null), null);
  assert.equal(cueTime(map, "nothing"), undefined);
  /* Loading: a good map, a missing one and a failed fetch. */
  const ok = async () => ({ ok: true, json: async () => map });
  const missing = async () => ({ ok: false, json: async () => ({}) });
  const broken = async () => {
    throw new Error("offline");
  };
  assert.deepEqual(await loadAudioMap("x", ok), map);
  assert.equal(await loadAudioMap("x", missing), null);
  assert.equal(await loadAudioMap("x", broken), null);
});

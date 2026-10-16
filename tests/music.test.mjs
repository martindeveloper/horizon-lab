import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import test from "node:test";

const saved = new Map();
globalThis.sessionStorage = {
  getItem: (key) => saved.get(key) ?? null,
  setItem: (key, value) => saved.set(key, String(value)),
  removeItem: (key) => saved.delete(key),
};
const { MusicPlayer, equalPowerCurve, crossfadeDelay } = await import("@horizon/toolkit/audio");
const { ambientMusic } = await import("../src/components/shell/ambient-music.ts");

test("loop crossfade keeps constant power and ends with the track", () => {
  const out = equalPowerCurve(false);
  const into = equalPowerCurve(true);
  assert.equal(out[0], 1);
  assert.equal(into[0], 0);
  assert.ok(Math.abs(out.at(-1)) < 1e-6 && Math.abs(into.at(-1) - 1) < 1e-6);
  for (let i = 0; i < out.length; i++)
    assert.ok(Math.abs(out[i] ** 2 + into[i] ** 2 - 1) < 1e-6, `power dips at step ${i}`);
  assert.equal(crossfadeDelay(261.5, 0, 8), 253.5);
  assert.equal(crossfadeDelay(261.5, 258, 8), 0, "Late timers start the next deck at once");
});

test("players construct without browser globals and remember only when asked", () => {
  const track = { title: "Test", sources: [{ src: "/a.webm", type: "audio/webm" }] };
  const plain = new MusicPlayer(track);
  assert.equal(plain.getState(), "paused");
  saved.set("horizon:music", "on");
  assert.equal(plain.remembered, false, "No storage key, no memory");
  assert.equal(ambientMusic.remembered, true);
  assert.equal(saved.get("horizon:music"), "on");
  const quiet = new MusicPlayer(track, { storageKey: "horizon:music:off" });
  assert.equal(quiet.remembered, false);
  assert.ok(ambientMusic.track.sources.every((source) => source.src.startsWith("/audio/")));
});

test("published ambient audio is small and free of generator metadata", () => {
  for (const name of ["interstellar-drift.webm", "interstellar-drift.m4a"]) {
    const url = new URL(`../public/audio/${name}`, import.meta.url);
    assert.ok(statSync(url).size < 4.5 * 1024 * 1024, `${name} is too large for the web`);
    assert.doesNotMatch(readFileSync(url, "latin1"), /suno|created=|Lavf\d/i, name);
  }
});

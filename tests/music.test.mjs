import assert from "node:assert/strict";
import { statSync } from "node:fs";
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
  assert.ok(
    ambientMusic.tracks.every((item) =>
      item.sources.every((source) => source.src.startsWith("/audio/")),
    ),
  );
});

test("a playlist skips while paused and wraps; a single track has nowhere to go", () => {
  const tracks = ["A", "B", "C"].map((title) => ({
    title,
    sources: [{ src: `/${title}.webm`, type: "audio/webm" }],
  }));
  const playlist = new MusicPlayer(tracks);
  let heard = 0;
  const stop = playlist.subscribe(() => heard++);
  assert.equal(playlist.getTrack(), 0);
  assert.equal(playlist.getBuffering(), false, "Nothing loads before the first play");
  playlist.next();
  playlist.next();
  assert.equal(playlist.track.title, "C");
  playlist.next();
  assert.equal(playlist.getTrack(), 0, "Past the last track it wraps");
  assert.equal(heard, 3);
  assert.equal(playlist.getBuffering(), false, "A paused skip loads nothing");
  stop();
  const single = new MusicPlayer(tracks[0]);
  single.next();
  assert.equal(single.getTrack(), 0);
  assert.equal(single.tracks.length, 1);
  assert.throws(() => new MusicPlayer([]));
});

test("published ambient audio stays within its download budget", () => {
  const files = ambientMusic.tracks.flatMap((item) => item.sources.map((source) => source.src));
  for (const name of files.map((src) => src.replace("/audio/", ""))) {
    const url = new URL(`../public/audio/${name}`, import.meta.url);
    assert.ok(statSync(url).size < 4.5 * 1024 * 1024, `${name} is too large for the web`);
  }
});

# Audio

Import from `@horizon/toolkit/audio`. Importing or constructing touches no
browser globals; the Web Audio graph is built on the first `play()`, which must
come from a user gesture.

- `MusicPlayer(tracks, options)`: background music. One track loops; a playlist
  runs on and wraps.
  - `tracks`: a `{ title, artist?, sources }` or an array of them. Sources are in
    order of preference, e.g. Opus/WebM, then AAC/M4A. Safari and iOS skip WebM
    when another source exists: WebKit plays it outside Web Audio, so gains
    cannot fade it.
    Sources may live on another origin (a CDN) if it sends CORS headers;
    without them Web Audio plays silence.
  - `options`: `fadeIn` (3 s), `fadeOut` (1.5 s), `crossfade` (8 s), `skipFade`
    (2.5 s), `prefetch` (30 s), `level` (0..1, default 1: what play fades up to)
    and `storageKey` (default `null`; set it to remember "on" in sessionStorage).
  - `play()` resolves to `false` when autoplay policy blocks it. `pause()`,
    `toggle()` and `next()` are bound, as are `getState()`, `getTrack()` (the
    playlist index), `getBuffering()` (playing is wanted but the audible track
    is still loading: the first play, a skip or a stall) and `subscribe()`,
    which suit React's `useSyncExternalStore`.
    `track` is the current track.
  - `setLevel(level, seconds = 2)`: fades to a level 0..1 (a quieter bed, a lift
    for a cinematic mode); paused, the next play fades up to it. `getLevel()` reads it.
  - `position`: seconds into the track now audible (or loaded to play next), or null
    before any is; a camera timed to a track reads it to meet the music where it is.
  - `hold(index | null)`: holds the playlist on one track, which plays next (blending
    over `skipFade` if something else is playing) and loops until released; released,
    the playlist runs on from it. `getHeld()` reads it.
  - `restart()`: starts the current track again from the top, blending into it over
    `skipFade`, so a staged piece begins at its first bar; returns false when it cannot
    (paused, no graph yet, or a loop crossfade under way).
  - `preload()`: buffers the track that plays next before the first play, e.g. on
    hover or focus of the control. Needs no gesture; skipped under Save-Data.
  - `resumeOnInteraction(ignore)`: if the music was on before a reload, preloads it
    and starts it on the first interaction outside `ignore()` (the controls).
    Returns a cleanup.
  - `dispose()` stops at once and releases the graph, the media-session handlers
    and every listener.
- `equalPowerCurve`, `crossfadeDelay` and `chooseSource` are the pure helpers
  behind the loop and the source choice.

## Audio maps

An `AudioMap` is what a track does over time, measured once and published beside it
(a track's `map` URL): its `duration`, the `period` it plays before looping (the
duration less the player's crossfade), short-term `loudness` (LUFS) and spectral
`brightness` (Hz) one sample per `step` seconds, and `cues`. `detectCues(loudness,
brightness, step, period)` finds the cues from the envelopes alone: `start` and `end`
always, `rise` (the steepest climb), `peak` (the loudest moment), `swell-n` and
`breath-n` (louder and quieter than the music around them), `bright-n` (the brightest
timbre) and `fade` (where the final decline begins); several of a kind are numbered in
time order. `buildAudioMap` makes a map from measured envelopes, `parseAudioMap(json)`
validates a published one (null otherwise), `cueTime(map, id)` reads a cue and
`loadAudioMap(url)` fetches one, resolving null on any failure so a camera can fall
back to the timing it was written with.

Two streaming `<audio>` decks crossfade where a track ends, so there is no codec
gap or decoded-buffer memory cost. Nothing downloads before the first play or a
`preload()`; only
the playing track loads, and the next one buffers `prefetch` seconds before its
blend, or at once on a skip, whose fade waits until it plays. Gains, not element volume, do every
fade, so they work on iOS. A hidden tab fades out and resumes on return. Prepare
tracks without built-in fade-in or fade-out, or the loop point dips.

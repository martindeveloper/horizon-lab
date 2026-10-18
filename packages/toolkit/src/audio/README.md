# Audio

Import from `@horizon/toolkit/audio`. Importing or constructing touches no
browser globals; the Web Audio graph is built on the first `play()`, which must
come from a user gesture.

- `MusicPlayer(tracks, options)`: background music. One track loops; a playlist
  runs on and wraps.
  - `tracks`: a `{ title, artist?, sources }` or an array of them. Sources are in
    order of preference, e.g. Opus/WebM, then AAC/M4A for Safari.
  - `options`: `fadeIn` (3 s), `fadeOut` (1.5 s), `crossfade` (8 s), `skipFade`
    (2.5 s), `prefetch` (30 s) and `storageKey` (default `null`; set it to
    remember "on" in sessionStorage).
  - `play()` resolves to `false` when autoplay policy blocks it. `pause()`,
    `toggle()` and `next()` are bound, as are `getState()`, `getTrack()` (the
    playlist index), `getBuffering()` (playing is wanted but the audible track
    is still loading: the first play, a skip or a stall) and `subscribe()`,
    which suit React's `useSyncExternalStore`.
    `track` is the current track.
  - `resumeOnInteraction(ignore)`: if the music was on before a reload, starts it on
    the first interaction outside `ignore()` (the controls). Returns a cleanup.
  - `dispose()` stops at once and releases the graph, the media-session handlers
    and every listener.
- `equalPowerCurve` and `crossfadeDelay` are the pure helpers behind the loop.

Two streaming `<audio>` decks crossfade where a track ends, so there is no codec
gap or decoded-buffer memory cost. Nothing downloads before the first play; only
the playing track loads, and the next one buffers `prefetch` seconds before its
blend, or at once on a skip, whose fade waits until it plays. Gains, not element volume, do every
fade, so they work on iOS. A hidden tab fades out and resumes on return. Prepare
tracks without built-in fade-in or fade-out, or the loop point dips.

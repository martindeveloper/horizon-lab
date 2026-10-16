# Audio

Import from `@horizon/toolkit/audio`. Importing or constructing touches no
browser globals; the Web Audio graph is built on the first `play()`, which must
come from a user gesture.

- `MusicPlayer(track, options)`: a looping background track.
  - `track`: `{ title, artist?, sources }`. Sources are in order of preference,
    e.g. Opus/WebM, then AAC/M4A for Safari.
  - `options`: `fadeIn` (3 s), `fadeOut` (1.5 s), `crossfade` (8 s) and
    `storageKey` (default `null`; set it to remember "on" in sessionStorage).
  - `play()` resolves to `false` when autoplay policy blocks it. `pause()` and
    `toggle()` are bound, as are `getState()` and `subscribe()`, which suit
    React's `useSyncExternalStore`.
  - `resumeOnInteraction(ignore)`: if the music was on before a reload, starts it on
    the first interaction outside `ignore()` (the toggle itself). Returns a cleanup.
  - `dispose()` stops at once and releases the graph, the media-session handlers
    and every listener.
- `equalPowerCurve` and `crossfadeDelay` are the pure helpers behind the loop.

Two streaming `<audio>` decks crossfade where the track repeats, so the loop has
no codec gap or decoded-buffer memory cost. Gains, not element volume, do every
fade, so they work on iOS. A hidden tab fades out and resumes on return. Prepare
tracks without built-in fade-in or fade-out, or the loop point dips.

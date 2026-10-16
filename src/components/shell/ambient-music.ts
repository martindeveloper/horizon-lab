import { MusicPlayer } from "@horizon/toolkit/audio";

/**
 * The site's ambient track. Session-scoped memory: a reload or language switch
 * keeps the music, a new visit starts silent. See docs/architecture.md to replace it.
 */
export const ambientMusic = new MusicPlayer(
  {
    title: "Interstellar Drift",
    artist: "Horizon",
    sources: [
      { src: "/audio/interstellar-drift.webm", type: 'audio/webm; codecs="opus"' },
      { src: "/audio/interstellar-drift.m4a", type: 'audio/mp4; codecs="mp4a.40.2"' },
    ],
  },
  { storageKey: "horizon:music" },
);

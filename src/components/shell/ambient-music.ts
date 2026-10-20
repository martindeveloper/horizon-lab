import { assetUrl } from "@/lib/assets";
import { MusicPlayer } from "@horizon/toolkit/audio";

/** Playback levels: the everyday bed, and the lift a drift gives it (`useDriftMusic`). */
export const MUSIC_LEVEL = { ambient: 0.75, drift: 1 } as const;

/**
 * The site's ambient playlist. Session-scoped memory: a reload or language switch
 * keeps the music, a new visit starts silent. See docs/architecture.md to add a track.
 */
export const ambientMusic = new MusicPlayer(
  [
    {
      title: "Interstellar Drift",
      artist: "Horizon",
      sources: [
        { src: assetUrl("/audio/interstellar-drift.webm"), type: 'audio/webm; codecs="opus"' },
        { src: assetUrl("/audio/interstellar-drift.m4a"), type: 'audio/mp4; codecs="mp4a.40.2"' },
      ],
    },
    {
      title: "Aeolian Static",
      artist: "Horizon",
      sources: [
        { src: assetUrl("/audio/aeolian-static.webm"), type: 'audio/webm; codecs="opus"' },
        { src: assetUrl("/audio/aeolian-static.m4a"), type: 'audio/mp4; codecs="mp4a.40.2"' },
      ],
    },
    {
      title: "Drifting Probe",
      artist: "Horizon",
      sources: [
        { src: assetUrl("/audio/drifting-probe.webm"), type: 'audio/webm; codecs="opus"' },
        { src: assetUrl("/audio/drifting-probe.m4a"), type: 'audio/mp4; codecs="mp4a.40.2"' },
      ],
    },
    {
      title: "Low Drone Rises",
      artist: "Horizon",
      sources: [
        { src: assetUrl("/audio/low-drone-rises.webm"), type: 'audio/webm; codecs="opus"' },
        { src: assetUrl("/audio/low-drone-rises.m4a"), type: 'audio/mp4; codecs="mp4a.40.2"' },
      ],
    },
  ],
  { storageKey: "music", level: MUSIC_LEVEL.ambient },
);
